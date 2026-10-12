import { EntryStatus } from '../domain/entry.entity';

/** What the service answers to a pass attempt. */
export interface EntryOutcome {
  status: EntryStatus;
  member: string | null;
  detail: string | null;
  deviceMs: number | null;
}
