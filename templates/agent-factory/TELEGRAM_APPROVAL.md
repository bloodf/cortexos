# Telegram Approval

Telegram inline approval is an owner-only fallback when Slack or GitHub approval is unavailable.

Accepted text fallback tokens:

- `APPROVE`
- `APPROVED`
- `MERGE`
- `REJECT`

Never treat ambiguous chat text as approval. Record the approved subject, actor, channel, and timestamp in the work item.
