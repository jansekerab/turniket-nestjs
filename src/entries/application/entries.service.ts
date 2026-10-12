import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../domain/clock';
import { DenyStatus, Entry } from '../domain/entry.entity';
import { EntryRepository } from '../domain/entry.repository';
import { Member } from '../domain/member.entity';
import { MemberRepository } from '../domain/member.repository';
import { Turnstile } from '../domain/turnstile';
import { EntryListItem, EntryListQuery } from './entry-list.query';
import { EntryOutcome } from './entry-outcome';

/**
 * Decisions only — no SQL, no HTTP. It depends on the abstractions in domain/;
 * which MySQL repository or HTTP client stands behind them is decided in the module.
 */
@Injectable()
export class EntriesService {
  private readonly log = new Logger(EntriesService.name);

  constructor(
    private readonly members: MemberRepository,
    private readonly entries: EntryRepository,
    private readonly turnstile: Turnstile,
    private readonly clock: Clock,
    private readonly list: EntryListQuery,
  ) {}

  /**
   * A pass through the turnstile. The order is deliberate:
   *   1) decide from the database whether opening is ALLOWED
   *   2) only then touch the device
   *   3) ALWAYS write a record, even when the device failed
   * Step 3 is the whole point — operations need a trace of failed attempts too.
   */
  async enter(cardCode: string): Promise<EntryOutcome> {
    const member = await this.members.findByCardCode(cardCode);

    if (member === null) {
      return this.deny(null, cardCode, 'denied_unknown', 'karta není v evidenci');
    }
    if (member.hasExpiredOn(this.clock.today())) {
      return this.deny(member, cardCode, 'denied_expired', `členství skončilo ${member.validUntil}`);
    }

    const res = await this.turnstile.open(cardCode);

    if (!res.ok) {
      const detail = `zařízení neodpovědělo (${res.reason}, pokusů ${res.attempts})`;
      await this.entries.record(new Entry(member.id, member.cardCode, 'device_failed', detail, res.ms));
      return { status: 'device_failed', member: member.fullName, detail, deviceMs: res.ms };
    }

    // The turnstile is already open — a failed write must not turn a real pass into a 500.
    const detail = `otevřeno na ${res.attempts}. pokus`;
    await this.entries
      .record(new Entry(member.id, member.cardCode, 'opened', detail, res.ms))
      .catch((e: unknown) => this.log.error(`průchod člena ${member.id} se nezapsal: ${String(e)}`));
    return { status: 'opened', member: member.fullName, detail: null, deviceMs: res.ms };
  }

  last(limit: number): Promise<EntryListItem[]> {
    return this.list.latest(limit);
  }

  /** Both refusals are recorded the same way; only the reason differs. */
  private async deny(
    member: Member | null,
    cardCode: string,
    status: DenyStatus,
    detail: string,
  ): Promise<EntryOutcome> {
    await this.entries.record(new Entry(member?.id ?? null, member?.cardCode ?? cardCode, status, detail, null));
    return { status, member: member?.fullName ?? null, detail, deviceMs: null };
  }
}
