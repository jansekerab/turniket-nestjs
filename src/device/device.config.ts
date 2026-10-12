import { intFrom, requireText } from '../config/env';

/**
 * Turnstile settings. Read from the environment ONCE, at startup, and checked:
 * DEVICE_ATTEMPTS=0 or =abc would otherwise make the retry loop run zero times
 * and every pass would end as device_failed without the device ever being asked.
 */
export class DeviceConfig {
  constructor(
    readonly url: string,
    /** Sent to the device on every call — the device must not open for anyone else on the LAN. */
    readonly token: string,
    readonly timeoutMs: number,
    readonly maxAttempts: number,
    /** Delay before the SECOND attempt; each further one doubles. 0 disables it. */
    readonly backoffMs: number,
    readonly breakerThreshold: number,
    readonly breakerCooldownMs: number,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): DeviceConfig {
    const url = env.DEVICE_URL ?? 'http://127.0.0.1:4000/open';
    if (!URL.canParse(url)) throw new Error(`DEVICE_URL není platná adresa: "${url}"`);
    return new DeviceConfig(
      url,
      requireText(env, 'DEVICE_TOKEN', 16),
      intFrom(env, 'DEVICE_TIMEOUT_MS', 700, 1),
      intFrom(env, 'DEVICE_ATTEMPTS', 3, 1),
      intFrom(env, 'DEVICE_BACKOFF_MS', 100, 0),
      intFrom(env, 'DEVICE_BREAKER_FAILS', 5, 1),
      intFrom(env, 'DEVICE_BREAKER_COOLDOWN_MS', 10_000, 1),
    );
  }
}
