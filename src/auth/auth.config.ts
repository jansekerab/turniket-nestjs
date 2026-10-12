import { requireText } from '../config/env';

/** Two callers, two keys: the turnstile reader may only post passes, the front desk may only read them. */
export class AuthConfig {
  constructor(
    readonly readerKey: string,
    readonly staffKey: string,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): AuthConfig {
    const cfg = new AuthConfig(requireText(env, 'READER_API_KEY', 16), requireText(env, 'STAFF_API_KEY', 16));
    // nosemgrep: plain-compare-of-secret -- two of our own keys at startup, no attacker input, nothing to time
    if (cfg.readerKey === cfg.staffKey) throw new Error('READER_API_KEY a STAFF_API_KEY musí být různé');
    return cfg;
  }
}
