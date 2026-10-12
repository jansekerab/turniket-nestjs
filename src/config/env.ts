/**
 * Reading settings from the environment, checked once at startup. A bad value stops the
 * service before it serves anyone, instead of breaking every pass later.
 */
export function requireText(env: NodeJS.ProcessEnv, name: string, minLength = 1): string {
  const v = env[name];
  if (v === undefined || v.length < minLength) {
    throw new Error(`${name} musí být nastaveno (aspoň ${minLength} znaků)`);
  }
  return v;
}

export function intFrom(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number): number {
  const raw = env[name];
  const v = raw === undefined ? fallback : Number(raw);
  if (raw === '' || !Number.isInteger(v) || v < min) {
    throw new Error(`${name} musí být celé číslo ≥ ${min}, je "${raw}"`);
  }
  return v;
}
