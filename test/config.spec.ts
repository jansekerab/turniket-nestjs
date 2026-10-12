import { AuthConfig } from '../src/auth/auth.config';
import { DbConfig } from '../src/db/db.config';

/** Secrets have no defaults in code: without them the service does not start. */
describe('DbConfig.fromEnv', () => {
  it('refuses to start without DB_PASS', () => {
    expect(() => DbConfig.fromEnv({})).toThrow('DB_PASS');
  });

  it('refuses DB_PORT that is not a whole number', () => {
    expect(() => DbConfig.fromEnv({ DB_PASS: 'x', DB_PORT: 'abc' })).toThrow('DB_PORT');
  });
});

describe('AuthConfig.fromEnv', () => {
  const reader = 'reader-key-0123456789';
  const staff = 'staff-key-0123456789';

  it.each([
    [{ STAFF_API_KEY: staff }, 'READER_API_KEY'],
    [{ READER_API_KEY: reader }, 'STAFF_API_KEY'],
    [{ READER_API_KEY: 'short', STAFF_API_KEY: staff }, 'READER_API_KEY'],
    [{ READER_API_KEY: reader, STAFF_API_KEY: reader }, 'různé'],
  ])('refuses %j', (env, message) => {
    expect(() => AuthConfig.fromEnv(env)).toThrow(message);
  });
});
