import { Entry } from './entry.entity';

/** Writing pass records. Implemented in infrastructure/. Reading for the front desk is in application/. */
export abstract class EntryRepository {
  abstract record(entry: Entry): Promise<void>;
}
