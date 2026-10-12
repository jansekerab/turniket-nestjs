import { SystemClock } from '../src/entries/infrastructure/system-clock';

/**
 * Tests run with TZ=UTC (see global-setup.js), like the server in Docker.
 * Just after midnight in Prague, UTC is still on the previous day — the clock must follow Prague.
 */
describe('SystemClock', () => {
  const clock = new SystemClock('Europe/Prague');
  afterEach(() => jest.useRealTimers());

  it('is still the last day at 23:30 Prague time', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-30T21:30:00Z'));
    expect(clock.today()).toBe('2026-09-30');
  });

  it('is already the next day at 00:30 Prague time, while UTC is still on the last day', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-30T22:30:00Z'));
    expect(clock.today()).toBe('2026-10-01');
  });

  it('refuses a misspelled time zone when it is created, not on the first pass', () => {
    expect(() => new SystemClock('Europe/Prauge')).toThrow('Europe/Prauge');
  });
});
