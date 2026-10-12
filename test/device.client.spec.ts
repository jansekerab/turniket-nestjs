import { DeviceClient } from '../src/device/device.client';
import { DeviceConfig } from '../src/device/device.config';

/**
 * Only the logic around the call is tested — not HTTP, not the database.
 * fetch is replaced with a stub, so the tests run without network or Docker.
 * Config is passed in directly — no process.env, nothing leaks between tests.
 */
describe('DeviceClient', () => {
  function client(cfg: Partial<DeviceConfig> = {}) {
    return new DeviceClient({
      url: 'http://device.test/open',
      token: 'device-token-0123456789',
      timeoutMs: 50,
      maxAttempts: 3,
      backoffMs: 0,
      breakerThreshold: 2,
      breakerCooldownMs: 1000,
      ...cfg,
    });
  }
  const fetchAnswers = (status: number) =>
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: status === 200, status } as Response);

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('succeeds on the first attempt and does not retry', async () => {
    const spy = fetchAnswers(200);
    await expect(client().open('CARD-001')).resolves.toMatchObject({ ok: true, attempts: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('sends the device token with every call', async () => {
    const spy = fetchAnswers(200);
    await client().open('CARD-001');
    expect(spy.mock.calls[0][1]?.headers).toMatchObject({ authorization: 'Bearer device-token-0123456789' });
  });

  it('reports a network error as the fixed word "network", not the raw exception text', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed: connect ECONNREFUSED 10.0.0.7:4000'));
    await expect(client({ maxAttempts: 1 }).open('CARD-001')).resolves.toMatchObject({ ok: false, reason: 'network' });
  });

  it('retries after an error and fails once the attempts run out', async () => {
    const spy = fetchAnswers(500);
    await expect(client().open('CARD-001')).resolves.toMatchObject({ ok: false, reason: 'http_500' });
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('counts a timeout as a failure and does not hang', async () => {
    // Like real fetch: it never answers, and rejects with the signal's reason once the timeout fires.
    jest.spyOn(global, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- fetch rejects with signal.reason (a DOMException)
          init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason)),
        ),
    );
    await expect(client({ maxAttempts: 2 }).open('CARD-001')).resolves.toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('waits 100 ms, then 200 ms between attempts, and not after the last one (backoff)', async () => {
    jest.useFakeTimers();
    const spy = fetchAnswers(500);
    const done = client({ backoffMs: 100 }).open('CARD-001');

    await jest.advanceTimersByTimeAsync(0);
    expect(spy).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(99);
    expect(spy).toHaveBeenCalledTimes(1); // still waiting
    await jest.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(2); // after 100 ms
    await jest.advanceTimersByTimeAsync(199);
    expect(spy).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(3); // after another 200 ms

    await expect(done).resolves.toMatchObject({ ok: false });
    expect(jest.getTimerCount()).toBe(0); // no wait after the last attempt
  });

  it('opens the breaker after two failures and stops calling the device', async () => {
    const spy = fetchAnswers(500);
    const c = client({ maxAttempts: 1 });

    await c.open('A');
    await c.open('B');
    expect(c.isBreakerOpen()).toBe(true);

    spy.mockClear();
    await expect(c.open('C')).resolves.toMatchObject({ ok: false, reason: 'breaker_open' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('with the breaker open, 10 passes at once do not reach the device', async () => {
    const spy = fetchAnswers(500);
    const c = client({ maxAttempts: 1 });
    await c.open('A');
    await c.open('B');
    spy.mockClear();

    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => c.open(`C${i}`)));
    expect(spy).not.toHaveBeenCalled();
    expect(results.every((r) => !r.ok && r.reason === 'breaker_open')).toBe(true);
  });

  it('after the cooldown starts counting failures from zero, and checking it changes nothing', async () => {
    jest.useFakeTimers();
    const spy = fetchAnswers(500);
    const c = client({ maxAttempts: 1 });
    await c.open('A');
    await c.open('B');
    expect(c.isBreakerOpen()).toBe(true);

    jest.advanceTimersByTime(1000);
    expect(c.isBreakerOpen()).toBe(false);
    expect(c.isBreakerOpen()).toBe(false); // asking twice must not change anything
    expect(c.failures).toBe(0); // /health shows a fresh start, not the old count

    spy.mockClear();
    await c.open('C'); // one failure after the cooldown
    expect(spy).toHaveBeenCalledTimes(1);
    expect(c.failures).toBe(1);
    expect(c.isBreakerOpen()).toBe(false); // one failure is not two — the breaker stays closed
  });
});

describe('DeviceConfig.fromEnv', () => {
  const base = { DEVICE_TOKEN: 'device-token-0123456789' };

  it('refuses to start without a device token, or with a short one', () => {
    expect(() => DeviceConfig.fromEnv({})).toThrow('DEVICE_TOKEN');
    expect(() => DeviceConfig.fromEnv({ DEVICE_TOKEN: 'short' })).toThrow('DEVICE_TOKEN');
  });

  it.each([
    ['DEVICE_ATTEMPTS', 'abc'],
    ['DEVICE_ATTEMPTS', ''],
    ['DEVICE_ATTEMPTS', '0'],
    ['DEVICE_ATTEMPTS', '2.5'],
    ['DEVICE_TIMEOUT_MS', '0'],
    ['DEVICE_BREAKER_FAILS', '0'],
    ['DEVICE_BACKOFF_MS', '-1'],
    ['DEVICE_URL', 'not a url'],
  ])('refuses %s=%p at startup instead of breaking every pass later', (name, value) => {
    expect(() => DeviceConfig.fromEnv({ ...base, [name]: value })).toThrow(name);
  });

  it('accepts DEVICE_BACKOFF_MS=0 — no waiting is a valid choice', () => {
    expect(DeviceConfig.fromEnv({ ...base, DEVICE_BACKOFF_MS: '0' })).toMatchObject({ backoffMs: 0 });
  });

  it('uses the defaults when nothing is set', () => {
    expect(DeviceConfig.fromEnv(base)).toMatchObject({ timeoutMs: 700, maxAttempts: 3, backoffMs: 100 });
  });
});
