/**
 * Fake turnstile. Run it separately: npm run device — or start it from a test with startFakeDevice().
 *
 * Knobs via environment variables (or options):
 *   DEVICE_MODE=ok     answers 200 immediately        (happy path)
 *   DEVICE_MODE=slow   answers after DEVICE_DELAY_MS  (produces a timeout)
 *   DEVICE_MODE=fail   answers 500                    (produces a fault)
 *   DEVICE_MODE=flaky  alternates 200 and 500
 *   DEVICE_TOKEN=…     when set, answers 401 to calls without 'Authorization: Bearer <token>'
 *
 * This is the POSITIVE CONTROL of the whole exercise: before trusting that the
 * error handling works, you must be able to produce the error on demand.
 */
import http from 'node:http';
import { AddressInfo } from 'node:net';

export type DeviceMode = 'ok' | 'slow' | 'fail' | 'flaky';

export interface FakeDevice {
  url: string;
  /** How many calls reached the device (after the token check). */
  calls: () => number;
  close: () => Promise<void>;
}

export function startFakeDevice(opts: {
  mode: DeviceMode;
  token?: string;
  delayMs?: number;
  port?: number;
}): Promise<FakeDevice> {
  const { mode, token, delayMs = 3000, port = 0 } = opts;
  let n = 0;
  const server = http.createServer((req, res) => {
    if (token && req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401).end();
      return;
    }
    n++;
    const answer = (code: number, text: string) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: code === 200, text, request: n }));
    };
    if (mode === 'slow') return void setTimeout(() => answer(200, 'otevřeno pozdě'), delayMs);
    if (mode === 'fail') return answer(500, 'zařízení hlásí poruchu');
    if (mode === 'flaky') return n % 2 ? answer(500, 'porucha') : answer(200, 'otevřeno');
    return answer(200, 'otevřeno');
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${actual}/open`,
        calls: () => n,
        close: () =>
          new Promise<void>((r) => {
            server.closeAllConnections();
            server.close(() => r());
          }),
      });
    });
  });
}

if (require.main === module) {
  const mode = (process.env.DEVICE_MODE ?? 'ok') as DeviceMode;
  const port = Number(process.env.DEVICE_PORT ?? 4000);
  void startFakeDevice({
    mode,
    port,
    token: process.env.DEVICE_TOKEN,
    delayMs: Number(process.env.DEVICE_DELAY_MS ?? 3000),
  }).then(
    // eslint-disable-next-line no-console
    (d) => console.log(`falešný turniket na ${d.url}, režim ${mode}`),
  );
}
