import { Injectable, OnModuleDestroy } from '@nestjs/common';
import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { DbConfig } from './db.config';

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(cfg: DbConfig) {
    this.pool = mysql.createPool({
      ...cfg,
      connectionLimit: 5,
      waitForConnections: true,
      // Without this, 'Jan Platný' arrives as 'Jan PlatnÃ½' — the connection must be utf8mb4.
      charset: 'utf8mb4_general_ci',
      // Return DATE/DATETIME as 'YYYY-MM-DD' strings. Otherwise mysql2 builds a JS Date
      // at midnight LOCAL time, and converting it to UTC takes a day off.
      dateStrings: true,
    });
  }

  async query<T extends RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.query<T[]>(sql, params);
    return rows;
  }

  async exec(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
    const [res] = await this.pool.query<ResultSetHeader>(sql, params);
    return res;
  }

  /** Readiness: can the service reach the database right now? */
  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
