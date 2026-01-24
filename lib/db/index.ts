import Database from 'better-sqlite3';
import { initializeDatabase } from './init';

const DATABASE_PATH = process.env.DATABASE_URL || 'sqlite.db';

let db: Database.Database | null = null;
let lastCheckpoint = 0;
const CHECKPOINT_INTERVAL = 60000; // Checkpoint every 60 seconds

export function getDb(): Database.Database {
  if (!db) {
    try {
      db = new Database(DATABASE_PATH, {
        timeout: 5000, // 5 second timeout for locks
      });
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.pragma('busy_timeout = 5000'); // Wait up to 5 seconds for locks
      initializeDatabase(db);
    } catch (error) {
      // If database is locked, try to close and reopen
      if (db) {
        try {
          db.close();
        } catch (e) {
          // Ignore close errors
        }
        db = null;
      }
      throw error;
    }
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    try {
      // Checkpoint WAL before closing to ensure data is written
      db.pragma('wal_checkpoint(FULL)');
      db.close();
    } catch (error) {
      // If checkpoint fails, still try to close
      try {
        db.close();
      } catch (e) {
        // Ignore close errors
      }
    } finally {
      db = null;
    }
  }
}

// Periodic WAL checkpoint to prevent I/O errors
function checkpointIfNeeded(): void {
  if (db && Date.now() - lastCheckpoint > CHECKPOINT_INTERVAL) {
    try {
      db.pragma('wal_checkpoint(PASSIVE)');
      lastCheckpoint = Date.now();
    } catch (error) {
      // Ignore checkpoint errors - not critical
    }
  }
}

// Type-safe query helpers
export function queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
  checkpointIfNeeded();
  const stmt = getDb().prepare(sql);
  return stmt.get(...params) as T | undefined;
}

export function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  checkpointIfNeeded();
  const stmt = getDb().prepare(sql);
  return stmt.all(...params) as T[];
}

export function execute(sql: string, params: unknown[] = []): Database.RunResult {
  checkpointIfNeeded();
  const stmt = getDb().prepare(sql);
  return stmt.run(...params);
}

export function executeReturning<T>(sql: string, params: unknown[] = []): T | undefined {
  checkpointIfNeeded();
  const stmt = getDb().prepare(sql);
  return stmt.get(...params) as T | undefined;
}
