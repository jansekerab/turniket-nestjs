import { Logger } from '@nestjs/common';
import { EntriesService } from '../src/entries/application/entries.service';
import { Member } from '../src/entries/domain/member.entity';
import { TurnstileResult } from '../src/entries/domain/turnstile';

/**
 * The gate of the whole service: who gets through, and that every attempt leaves a record.
 * Everything behind the domain abstractions is a stub — no database, no network, no real clock.
 */
describe('EntriesService.enter', () => {
  const member = new Member(3, 'CARD-003', 'Jana Nováková', '2026-09-30');
  const members = { findByCardCode: jest.fn() };
  const entries = { record: jest.fn() };
  const turnstile = { open: jest.fn() };
  const clock = { today: jest.fn() };
  const list = { latest: jest.fn() };
  const service = new EntriesService(members, entries, turnstile, clock, list);

  beforeEach(() => {
    members.findByCardCode.mockResolvedValue(member);
    entries.record.mockResolvedValue(undefined);
    turnstile.open.mockResolvedValue({ ok: true, ms: 5, attempts: 1 } satisfies TurnstileResult);
    clock.today.mockReturnValue('2026-09-30');
  });
  afterEach(() => jest.resetAllMocks());

  it('lets the member through on the last day of membership', async () => {
    await expect(service.enter('CARD-003')).resolves.toMatchObject({ status: 'opened' });
    expect(entries.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'opened' }));
  });

  it('refuses the member the day after, records it and does not touch the turnstile', async () => {
    clock.today.mockReturnValue('2026-10-01');
    await expect(service.enter('CARD-003')).resolves.toMatchObject({ status: 'denied_expired' });
    expect(entries.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'denied_expired', memberId: 3 }));
    expect(turnstile.open).not.toHaveBeenCalled();
  });

  it('refuses an unknown card and records it without a member', async () => {
    members.findByCardCode.mockResolvedValue(null);
    await expect(service.enter('CARD-999')).resolves.toMatchObject({ status: 'denied_unknown', member: null });
    expect(entries.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'denied_unknown', memberId: null }));
    expect(turnstile.open).not.toHaveBeenCalled();
  });

  it('records the attempt when the device fails', async () => {
    turnstile.open.mockResolvedValue({ ok: false, ms: 2100, attempts: 3, reason: 'timeout' } satisfies TurnstileResult);
    await expect(service.enter('CARD-003')).resolves.toMatchObject({ status: 'device_failed' });
    expect(entries.record).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'device_failed', memberId: 3, cardCode: 'CARD-003', deviceMs: 2100 }),
    );
  });

  it('still answers "opened" when the turnstile opened but the record could not be written', async () => {
    entries.record.mockRejectedValue(new Error('db down'));
    await expect(service.enter('CARD-003')).resolves.toMatchObject({ status: 'opened' });
  });

  it('logs the failed write without the card code — it opens the turnstile (GDPR, log access)', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    entries.record.mockRejectedValue(new Error('db down'));
    await service.enter('CARD-003');
    expect(error).toHaveBeenCalledTimes(1); // positive control: something was logged
    expect(String(error.mock.calls[0][0])).not.toContain('CARD-003');
  });

  it('hands the front-desk listing over from the read side unchanged', async () => {
    const rows = [{ id: 1 }];
    list.latest.mockResolvedValue(rows);
    await expect(service.last(5)).resolves.toBe(rows);
    expect(list.latest).toHaveBeenCalledWith(5);
  });

  describe('the detail the front desk reads says why', () => {
    const detailOf = () => (entries.record.mock.calls[0][0] as { detail: string }).detail;

    it('unknown card: says the card is not registered', async () => {
      members.findByCardCode.mockResolvedValue(null);
      await service.enter('CARD-999');
      expect(detailOf()).toMatch(/evidenc/);
    });

    it('expired: names the last valid day', async () => {
      clock.today.mockReturnValue('2026-10-01');
      await service.enter('CARD-003');
      expect(detailOf()).toContain('2026-09-30');
    });

    it('device failed: names the reason and the number of attempts', async () => {
      turnstile.open.mockResolvedValue({
        ok: false,
        ms: 2100,
        attempts: 3,
        reason: 'timeout',
      } satisfies TurnstileResult);
      await service.enter('CARD-003');
      expect(detailOf()).toEqual(expect.stringContaining('timeout'));
      expect(detailOf()).toEqual(expect.stringContaining('3'));
    });

    it('opened: names the attempt that succeeded', async () => {
      turnstile.open.mockResolvedValue({ ok: true, ms: 5, attempts: 2 } satisfies TurnstileResult);
      await service.enter('CARD-003');
      expect(detailOf()).toContain('2');
    });

    it('failed write: the log names the member and the cause, so it can be followed up', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      entries.record.mockRejectedValue(new Error('db down'));
      await service.enter('CARD-003');
      expect(String(error.mock.calls[0][0])).toEqual(expect.stringMatching(/3.*db down/));
    });
  });
});
