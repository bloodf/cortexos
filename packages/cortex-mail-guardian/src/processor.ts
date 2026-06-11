import type { GuardianConfig, MailAccountConfig } from './config.js';
import type { MailClient, MailMessage } from './imap.js';
import type { GuardianStore } from './store.js';
import type { TelegramClient, TelegramUpdate } from './telegram.js';
import {
  classifyEmail,
  heuristicSpamScore,
  shouldAutoQuarantine,
  shouldKeepInInbox,
} from './model.js';
import { redactEmail } from './redact.js';
import { evaluateRules } from './rules.js';

export interface ProcessDeps {
  config: GuardianConfig;
  mail: MailClient;
  store: GuardianStore;
  telegram: TelegramClient;
}

export function buildReviewMessage(input: {
  accountAddress: string;
  from: string;
  subject: string;
  verdict: string;
  confidence: number;
  reviewId: number;
}): string {
  return [
    '📬 Cortex mail guardian needs a decision.',
    `Account: ${input.accountAddress}`,
    `From: ${input.from || '(unknown sender)'}`,
    `Subject: ${input.subject || '(no subject)'}`,
    `Verdict: ${input.verdict} (${input.confidence})`,
    'Status: moved to the review folder while waiting.',
    '',
    'Reply to Cortex with one of:',
    `mail guardian decide ${input.reviewId} spam`,
    `mail guardian decide ${input.reviewId} keep`,
    `mail guardian decide ${input.reviewId} block_sender`,
    `mail guardian decide ${input.reviewId} allow_sender`,
  ].join('\n');
}

export async function processMessage(
  deps: ProcessDeps,
  account: MailAccountConfig,
  message: MailMessage,
): Promise<'review' | 'kept' | 'skipped' | 'trashed'> {
  if (await deps.store.hasProcessed(account.slug, message.uid)) return 'skipped';
  const redacted = redactEmail({
    from: message.from,
    subject: message.subject,
    text: message.text,
  });

  // Deterministic rule pre-filter — runs BEFORE any AI/model call.
  // A deny (block) rule short-circuits to spam (trash); an allow rule to ham (keep).
  const ruleMatch = await evaluateRules(deps.store, redacted);
  if (ruleMatch) {
    if (ruleMatch.verdict === 'spam') {
      if (!deps.config.dryRun) {
        await deps.mail.moveToTrash(account, message.uid, {
          sourceMailbox: account.inbox,
          messageId: message.messageId,
        });
      }
      await deps.store.markProcessed(
        account.slug,
        message.uid,
        deps.config.dryRun ? 'would_trash' : 'trashed',
        message.messageId,
      );
      return 'trashed';
    }
    await deps.store.markProcessed(account.slug, message.uid, 'kept', message.messageId);
    return 'kept';
  }

  const hasAllowRule = await deps.store.hasAllowRule(redacted.fromHash, redacted.domainHash);
  const heuristicScore = heuristicSpamScore(message);
  const modelConfig = {
    baseUrl: deps.config.nineRouterBaseUrl,
    apiKey: deps.config.nineRouterApiKey,
    model: deps.config.model,
    timeoutMs: deps.config.modelTimeoutMs,
  };
  const classification = await classifyEmail(modelConfig, {
    from: message.from,
    subject: message.subject,
    text: message.text,
  });
  const verification = await classifyEmail(modelConfig, {
    from: message.from,
    subject: message.subject,
    text: message.text,
    feedbackSummary: `Verify this action independently. Prior verdict: ${classification.verdict} at ${classification.confidence}.`,
  });

  if (
    shouldKeepInInbox({
      classification,
      verification,
      hasAllowRule,
      heuristicScore,
    })
  ) {
    await deps.store.markProcessed(account.slug, message.uid, 'kept', message.messageId);
    return 'kept';
  }

  const autoQuarantine = shouldAutoQuarantine({
    classification,
    verification,
    threshold: deps.config.confidenceThreshold,
    hasAllowRule,
    heuristicScore,
  });
  const reviewId = await deps.store.createPendingReview({
    accountSlug: account.slug,
    messageUid: message.uid,
    messageId: message.messageId,
    ...redacted,
    modelVerdict: autoQuarantine ? 'spam' : classification.verdict,
    modelConfidence: classification.confidence,
  });
  if (!deps.config.dryRun) await deps.mail.moveToReview(account, message.uid);
  if (deps.config.telegramOwnerChatId) {
    await deps.telegram.sendMessage(
      deps.config.telegramOwnerChatId,
      buildReviewMessage({
        accountAddress: account.address,
        from: message.from,
        subject: message.subject,
        verdict: classification.verdict,
        confidence: classification.confidence,
        reviewId,
      }),
      {
        inline_keyboard: [
          [
            { text: '🗑️ Spam -> Trash', callback_data: `mg:${reviewId}:spam` },
            { text: '✅ Not spam -> Inbox', callback_data: `mg:${reviewId}:keep` },
          ],
          [
            { text: '🚫 Block sender', callback_data: `mg:${reviewId}:block_sender` },
            { text: '🛡️ Allow sender', callback_data: `mg:${reviewId}:allow_sender` },
          ],
        ],
      },
    );
  }
  await deps.store.markProcessed(account.slug, message.uid, 'pending_review', message.messageId);
  return 'review';
}

export async function applyReviewDecision(
  deps: ProcessDeps,
  reviewId: number,
  decision: string,
  approver: string,
): Promise<void> {
  const review = await deps.store.getReview(reviewId);
  if (!review) throw new Error(`review ${reviewId} is already resolved or missing`);
  const account = deps.config.accounts.find((item) => item.slug === review.account_slug);
  if (!account) throw new Error(`account missing for review ${reviewId}`);
  if (decision === 'spam' || decision === 'block_sender') {
    if (!deps.config.dryRun) {
      await deps.mail.moveToTrash(account, review.message_uid, {
        sourceMailbox: account.reviewMailbox,
        messageId: review.message_id ?? undefined,
      });
    }
    await deps.store.markProcessed(
      account.slug,
      review.message_uid,
      deps.config.dryRun ? 'would_trash' : 'trashed',
    );
    await deps.store.addRule('block', 'sender', review.from_hash);
  } else if (decision === 'keep' || decision === 'allow_sender') {
    if (!deps.config.dryRun) {
      await deps.mail.moveToInbox(account, review.message_uid, {
        sourceMailbox: account.reviewMailbox,
        messageId: review.message_id ?? undefined,
      });
    }
    await deps.store.markProcessed(account.slug, review.message_uid, 'kept');
    if (decision === 'allow_sender') await deps.store.addRule('allow', 'sender', review.from_hash);
  } else {
    throw new Error(`unknown decision: ${decision}`);
  }
  await deps.store.resolveReview(reviewId, decision, approver);
}

export async function sweep(deps: ProcessDeps): Promise<{
  processed: number;
  trashed: number;
  review: number;
  kept: number;
  skipped: number;
  failed: number;
  actions: number;
}> {
  let processed = 0;
  let trashed = 0;
  let review = 0;
  let kept = 0;
  let skipped = 0;
  let failed = 0;
  let actions = 0;
  for (const action of await deps.store.claimPendingActions()) {
    try {
      await applyReviewDecision(deps, action.review_id, action.decision, action.approver);
      await deps.store.completeAction(action.id);
      actions += 1;
    } catch (error) {
      failed += 1;
      await deps.store.failAction(
        action.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  for (const account of deps.config.accounts) {
    let accountProcessed = 0;
    let messages: MailMessage[] = [];
    try {
      messages = await deps.mail.listInbox(account);
    } catch (error) {
      failed += 1;
      process.stderr.write(
        `[mail-guardian] ${account.slug} list failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
    for (const message of messages) {
      if (accountProcessed >= deps.config.maxMessagesPerSweep) break;
      let action: 'review' | 'kept' | 'skipped' | 'trashed' | undefined;
      try {
        action = await processMessage(deps, account, message);
      } catch (error) {
        failed += 1;
        process.stderr.write(
          `[mail-guardian] ${account.slug}:${message.uid} failed: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      }
      if (action) {
        processed += 1;
        if (action === 'skipped') {
          skipped += 1;
        } else {
          accountProcessed += 1;
          if (action === 'review') review += 1;
          else if (action === 'kept') kept += 1;
          else if (action === 'trashed') trashed += 1;
        }
      }
    }
  }
  return { processed, trashed, review, kept, skipped, failed, actions };
}

export async function handleTelegramUpdates(
  deps: ProcessDeps,
  updates: TelegramUpdate[],
): Promise<number> {
  let handled = 0;
  const relevantUpdates = updates.filter((update) => {
    const callback = update.callback_query;
    const data = callback?.data;
    return callback && data?.startsWith('mg:');
  });
  for (const update of relevantUpdates) {
    const callback = update.callback_query!;
    const data = callback.data!;
    const [, reviewIdRaw, decision] = data.split(':');
    const reviewId = Number(reviewIdRaw);
    if (Number.isInteger(reviewId)) {
      const reviewRecord = await deps.store.getReview(reviewId);
      if (reviewRecord) {
        const account = deps.config.accounts.find((item) => item.slug === reviewRecord.account_slug);
        if (account) {
          if (
            decision === 'spam' ||
            decision === 'keep' ||
            decision === 'block_sender' ||
            decision === 'allow_sender'
          ) {
            await applyReviewDecision(
              deps,
              reviewId,
              decision,
              String(callback.message?.chat?.id ?? 'telegram'),
            );
            await deps.telegram.answerCallbackQuery(callback.id, 'Recorded.');
            handled += 1;
          } else {
            await deps.telegram.answerCallbackQuery(callback.id, 'Unknown decision.');
          }
        } else {
          await deps.telegram.answerCallbackQuery(callback.id, 'Account missing.');
        }
      } else {
        await deps.telegram.answerCallbackQuery(callback.id, 'Review already resolved or missing.');
      }
    }
  }
  return handled;
}
