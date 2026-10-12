/**
 * Today's date in the gym's calendar, 'YYYY-MM-DD'. Injected instead of new Date(),
 * so the expiry rule can be tested for any day and any server time zone.
 */
export abstract class Clock {
  abstract today(): string;
}
