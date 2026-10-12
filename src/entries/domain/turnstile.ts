export type TurnstileResult = { ms: number; attempts: number } & ({ ok: true } | { ok: false; reason: string });

/** The physical turnstile, as the domain sees it: ask it to open, get an answer. */
export abstract class Turnstile {
  abstract open(cardCode: string): Promise<TurnstileResult>;
}
