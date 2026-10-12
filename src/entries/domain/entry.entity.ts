/** How a pass attempt ended. Must equal the ENUM in the database — an integration test compares them. */
export const ENTRY_STATUSES = ['opened', 'denied_expired', 'denied_unknown', 'device_failed'] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];
export type DenyStatus = Extract<EntryStatus, 'denied_unknown' | 'denied_expired'>;

/** One recorded pass attempt, as it is stored. */
export class Entry {
  constructor(
    readonly memberId: number | null,
    readonly cardCode: string,
    readonly status: EntryStatus,
    readonly detail: string | null,
    readonly deviceMs: number | null,
  ) {}
}
