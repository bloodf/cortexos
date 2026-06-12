import { describe, expect, it } from 'vitest';
import { accountFromRow, decodeBase64Secret, loadConfig, mergeAccounts } from '../src/config.js';

function baseEnv(): NodeJS.ProcessEnv {
  const password = Buffer.from('dummy#password;with.symbols', 'utf8').toString('base64');
  return {
    MAIL_GUARDIAN_ACCOUNT_COUNT: '3',
    MAIL_GUARDIAN_ACCOUNT_1_SLUG: 'geeks-heitor',
    MAIL_GUARDIAN_ACCOUNT_1_ADDRESS: 'heitor@geekspropaganda.com.br',
    MAIL_GUARDIAN_ACCOUNT_1_HOST: 'mail.geekspropaganda.com.br',
    MAIL_GUARDIAN_ACCOUNT_1_PORT: '993',
    MAIL_GUARDIAN_ACCOUNT_1_USERNAME: 'heitor@geekspropaganda.com.br',
    MAIL_GUARDIAN_ACCOUNT_1_PASSWORD_B64: password,
    MAIL_GUARDIAN_ACCOUNT_2_SLUG: 'geeks-contato',
    MAIL_GUARDIAN_ACCOUNT_2_ADDRESS: 'contato@geekspropaganda.com.br',
    MAIL_GUARDIAN_ACCOUNT_2_HOST: 'mail.geekspropaganda.com.br',
    MAIL_GUARDIAN_ACCOUNT_2_PORT: '993',
    MAIL_GUARDIAN_ACCOUNT_2_USERNAME: 'contato@geekspropaganda.com.br',
    MAIL_GUARDIAN_ACCOUNT_2_PASSWORD_B64: password,
    MAIL_GUARDIAN_ACCOUNT_3_SLUG: 'heitorramon-eu',
    MAIL_GUARDIAN_ACCOUNT_3_ADDRESS: 'eu@heitorramon.com',
    MAIL_GUARDIAN_ACCOUNT_3_HOST: 'mail.heitorramon.com',
    MAIL_GUARDIAN_ACCOUNT_3_PORT: '993',
    MAIL_GUARDIAN_ACCOUNT_3_USERNAME: 'eu@heitorramon.com',
    MAIL_GUARDIAN_ACCOUNT_3_PASSWORD_B64: password,
    TELEGRAM_BOT_TOKEN: 'token',
    NINEROUTER_API_KEY: 'key',
  };
}

describe('config', () => {
  it('loads configured base64 password accounts', () => {
    const config = loadConfig(baseEnv());
    expect(config.accounts).toHaveLength(3);
    expect(config.accounts[0].password).toBe('dummy#password;with.symbols');
    expect(config.accounts[2].host).toBe('mail.heitorramon.com');
    expect(config.accounts[2].reviewMailbox).toBe('INBOX.Cortex Mail Guardian Review');
    expect(config.model).toBe('minimax/MiniMax-M3');
    expect(config.confidenceThreshold).toBe(0.95);
  });

  it('rejects invalid base64', () => {
    expect(() => decodeBase64Secret('SECRET', 'not-base64')).toThrow(/base64/);
  });

  it('rejects a zero account count', () => {
    const input = baseEnv();
    input.MAIL_GUARDIAN_ACCOUNT_COUNT = '0';
    expect(() => loadConfig(input)).toThrow(/positive integer/);
  });

  it('loads with no env accounts when the count is absent (DB-only mode)', () => {
    const config = loadConfig({ NINEROUTER_API_KEY: 'key' });
    expect(config.accounts).toHaveLength(0);
  });
});

describe('model and fallback configuration', () => {
  it('defaults to MiniMax-M3 when MAIL_GUARDIAN_MODEL is not set', () => {
    const config = loadConfig({ NINEROUTER_API_KEY: 'key' });
    expect(config.model).toBe('minimax/MiniMax-M3');
  });

  it('defaults fallbackModel to cx/gpt-5.5 when MAIL_GUARDIAN_FALLBACK_MODEL is not set', () => {
    const config = loadConfig({ NINEROUTER_API_KEY: 'key' });
    expect(config.fallbackModel).toBe('cx/gpt-5.5');
  });

  it('respects env overrides for model and fallbackModel', () => {
    const config = loadConfig({
      NINEROUTER_API_KEY: 'key',
      MAIL_GUARDIAN_MODEL: 'custom/primary',
      MAIL_GUARDIAN_FALLBACK_MODEL: 'custom/fallback',
    });
    expect(config.model).toBe('custom/primary');
    expect(config.fallbackModel).toBe('custom/fallback');
  });

  it('keeps model and fallbackModel distinct when no env overrides are set', () => {
    const config = loadConfig({ NINEROUTER_API_KEY: 'key' });
    expect(config.fallbackModel).not.toBe(config.model);
  });
});

describe('DB-backed accounts', () => {
  const row = {
    slug: 'db-inbox',
    address: 'db@example.com',
    host: 'mail.example.com',
    port: 993,
    secure: true,
    username: 'db@example.com',
    password_b64: Buffer.from('db-secret', 'utf8').toString('base64'),
    inbox: 'INBOX',
    trash_mailbox: null,
    review_mailbox: 'INBOX.Cortex Mail Guardian Review',
  };

  it('maps a DB row to a runtime account and decodes the password', () => {
    const account = accountFromRow(row);
    expect(account.slug).toBe('db-inbox');
    expect(account.password).toBe('db-secret');
    expect(account.trashMailbox).toBeUndefined();
  });

  it('lets DB accounts override env accounts by slug', () => {
    const envAccount = accountFromRow({ ...row, slug: 'shared', host: 'env-host' });
    const dbAccount = accountFromRow({ ...row, slug: 'shared', host: 'db-host' });
    const merged = mergeAccounts([envAccount], [dbAccount]);
    expect(merged).toHaveLength(1);
    expect(merged[0].host).toBe('db-host');
  });

  it('keeps env accounts not present in the DB', () => {
    const envOnly = accountFromRow({ ...row, slug: 'env-only' });
    const dbOnly = accountFromRow({ ...row, slug: 'db-only' });
    const merged = mergeAccounts([envOnly], [dbOnly]);
    expect(merged.map((a) => a.slug).sort()).toEqual(['db-only', 'env-only']);
  });
});
