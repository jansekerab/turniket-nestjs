import { EntryStatus } from '../domain/entry.entity';

/** One row of the listing shown to the front desk. The card code is masked — it opens the turnstile. */
export interface EntryListItem {
  id: number;
  cardCodeMasked: string;
  fullName: string | null;
  status: EntryStatus;
  detail: string | null;
  deviceMs: number | null;
  createdAt: string;
}

/**
 * Read side: a ready-made listing, not entities. No business decisions here, so it does not
 * need the domain — it is an application need, implemented by an SQL query in infrastructure/.
 */
export abstract class EntryListQuery {
  abstract latest(limit: number): Promise<EntryListItem[]>;
}
