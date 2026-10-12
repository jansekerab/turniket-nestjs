import { Injectable, Logger } from '@nestjs/common';
import { Turnstile, TurnstileResult } from '../entries/domain/turnstile';
import { DeviceConfig } from './device.config';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Turnstile client.
 *
 * Four concerns, each a separate layer:
 *  1) TIMEOUT — the device may never answer; without a timeout you wait forever.
 *  2) RETRY   — a single glitch does not mean the device is broken.
 *  3) BACKOFF — wait between attempts, and make the wait grow. Without it,
 *               three attempts are not three chances but one chance taken thrice.
 *  4) BREAKER — when the device keeps failing, stop hammering it.
 *
 * Three different problems: a timeout covers silence, backoff covers a transient
 * fault, the breaker covers a persistent one.
 */
@Injectable()
export class DeviceClient extends Turnstile {
  private readonly log = new Logger(DeviceClient.name);

  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(private readonly cfg: DeviceConfig) {
    super();
  }

  /** Consecutive failures — shown by /health. After the cooldown the count starts again from 0. */
  get failures(): number {
    return this.openedAt !== null && !this.isBreakerOpen() ? 0 : this.consecutiveFailures;
  }

  /** true = breaker is open, the device is not called at all right now. A pure check — no state changes. */
  isBreakerOpen(now = Date.now()): boolean {
    return this.openedAt !== null && now - this.openedAt < this.cfg.breakerCooldownMs;
  }

  async open(cardCode: string): Promise<TurnstileResult> {
    const started = Date.now();

    if (this.isBreakerOpen(started)) {
      return { ok: false, ms: 0, attempts: 0, reason: 'breaker_open' };
    }
    if (this.openedAt !== null) {
      // Cooldown is over: close the breaker and give the device a fresh start.
      this.openedAt = null;
      this.consecutiveFailures = 0;
    }

    const { maxAttempts, backoffMs } = this.cfg;
    let lastReason = 'unknown';
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await this.callOnce(cardCode);
        if (res.ok) {
          this.consecutiveFailures = 0;
          return { ok: true, ms: Date.now() - started, attempts: attempt };
        }
        lastReason = `http_${res.status}`;
        this.log.warn(`pokus ${attempt}/${maxAttempts} selhal: ${lastReason}`);
      } catch (e: unknown) {
        // Checked by name, not instanceof: the timeout is a DOMException, which is not
        // an Error in every runtime (in Jest's sandbox it is not).
        // Only a fixed word goes on into the record and the response; the raw text stays in the log.
        lastReason = (e as { name?: unknown })?.name === 'TimeoutError' ? 'timeout' : 'network';
        this.log.warn(`pokus ${attempt}/${maxAttempts} selhal: ${lastReason} (${String(e)})`);
      }

      // Wait before the next attempt — but not after the last one, that would be waiting for nothing.
      if (backoffMs > 0 && attempt < maxAttempts) {
        await sleep(backoffMs * 2 ** (attempt - 1)); // 100, 200, 400…  (exponential)
      }
    }

    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.cfg.breakerThreshold) this.openedAt = Date.now();
    return { ok: false, ms: Date.now() - started, attempts: maxAttempts, reason: lastReason };
  }

  /** A single call to the device with a hard timeout. On timeout fetch rejects with a TimeoutError. */
  private async callOnce(cardCode: string): Promise<{ ok: boolean; status: number }> {
    const res = await fetch(this.cfg.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.token}` },
      body: JSON.stringify({ cardCode }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    return { ok: res.ok, status: res.status };
  }
}
