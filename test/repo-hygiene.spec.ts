import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Rules about the repository itself that no compiler checks.
 * They read the files as text — no Docker, no database.
 */
const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const srcFiles = (dir = join(root, 'src')): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? srcFiles(p) : [p];
  });

describe('repository rules', () => {
  it('.env.example lists every variable the code requires (requireText)', () => {
    const required = srcFiles()
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/requireText\(env, '([A-Z_]+)'/g)].map((m) => m[1]))
      .sort();
    const documented = [...read('.env.example').matchAll(/^([A-Z_]+)=/gm)].map((m) => m[1]);
    expect(required.length).toBeGreaterThan(0); // positive control: the regex found something
    expect(required.filter((v) => !documented.includes(v))).toEqual([]);
  });

  it('docker-compose publishes ports on 127.0.0.1 only, never on the whole network', () => {
    const ports = [...read('docker-compose.yml').matchAll(/^\s*-\s*"([^"]+:\d+)"\s*$/gm)].map((m) => m[1]);
    expect(ports.length).toBeGreaterThan(0);
    expect(ports.filter((p) => !p.startsWith('127.0.0.1:'))).toEqual([]);
  });

  it('docker-compose contains no password — only references to .env', () => {
    const lines = read('docker-compose.yml')
      .split('\n')
      .filter((l) => !l.trim().startsWith('#') && /PASSWORD:|(^|[\s"'])-p\S/.test(l));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((l) => !/\$\{[A-Z_]+/.test(l) && /PASSWORD:/.test(l))).toEqual([]);
    expect(lines.filter((l) => /(^|[\s"'])-p\S/.test(l))).toEqual([]); // mysql -pSECRET on a command line
  });

  it('.env is ignored by git', () => {
    expect(read('.gitignore').split('\n')).toContain('.env');
  });

  it('no secret-looking default in source code (password, token, key = "…")', () => {
    const hits = srcFiles().flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => /(pass(word)?|token|secret|api_?key)\s*[:=]\s*['"][^'"]{4,}['"]/i.test(l))
        .map((l) => `${f}: ${l.trim()}`),
    );
    expect(hits).toEqual([]);
  });
});
