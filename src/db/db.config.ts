import { intFrom, requireText } from '../config/env';

/** Database connection. No default password — a missing one stops the service at startup. */
export class DbConfig {
  constructor(
    readonly host: string,
    readonly port: number,
    readonly user: string,
    readonly password: string,
    readonly database: string,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): DbConfig {
    return new DbConfig(
      env.DB_HOST ?? '127.0.0.1',
      intFrom(env, 'DB_PORT', 3307, 1),
      env.DB_USER ?? 'gym',
      requireText(env, 'DB_PASS'),
      env.DB_NAME ?? 'gym',
    );
  }
}
