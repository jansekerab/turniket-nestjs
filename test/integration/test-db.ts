import mysql, { Pool } from 'mysql2/promise';
import { DbConfig } from '../../src/db/db.config';

// Locally the compose service mysql-test on 127.0.0.1:3308; in CI the "mysql" service (see .gitlab-ci.yml).
export const TEST_DB_HOST = process.env.TEST_DB_HOST ?? '127.0.0.1';
export const TEST_DB_PORT = Number(process.env.TEST_DB_PORT ?? 3308);

/** The application user — the same rights as in production (SELECT members, SELECT/INSERT entries). */
export const appDbConfig = () => new DbConfig(TEST_DB_HOST, TEST_DB_PORT, 'gym', process.env.DB_PASS!, 'gym');

/** Root, only for preparing data the application itself may not write (members). */
export function rootPool(): Pool {
  return mysql.createPool({
    host: TEST_DB_HOST,
    port: TEST_DB_PORT,
    user: 'root',
    password: process.env.MYSQL_ROOT_PASSWORD,
    database: 'gym',
    charset: 'utf8mb4_general_ci',
    dateStrings: true,
  });
}

/** Fresh tables with two known members, so tests do not depend on each other. */
export async function resetData(root: Pool): Promise<void> {
  await root.query('DELETE FROM entries');
  await root.query('DELETE FROM members');
  await root.query(
    `INSERT INTO members (id, card_code, full_name, valid_until) VALUES
       (1, 'CARD-001', 'Jan Platný', '2099-12-31'),
       (2, 'CARD-002', 'Eva Propadlá', '2000-01-31')`,
  );
}
