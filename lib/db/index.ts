import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type OfferRow = {
  id: string;
  providerName: string;
  officialUrl: string;
  benefitsJson: string;
  requiresInvite: number;
  inviteCode: string | null;
  claimUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isLongTerm: number;
  notes: string | null;
  modelsJson: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

declare global {
  var __offersDb: Database.Database | undefined;
}

function createDatabase() {
  const configuredPath = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "offers.db");
  const dbPath = configuredPath === ":memory:"
    ? configuredPath
    : path.resolve(/* turbopackIgnore: true */ configuredPath);
  if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      providerName TEXT NOT NULL,
      officialUrl TEXT NOT NULL,
      benefitsJson TEXT NOT NULL,
      requiresInvite INTEGER NOT NULL DEFAULT 0,
      inviteCode TEXT,
      claimUrl TEXT,
      startsAt TEXT,
      endsAt TEXT,
      isLongTerm INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      modelsJson TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS offers_created_idx ON offers (createdAt DESC, id DESC);
    CREATE INDEX IF NOT EXISTS offers_status_created_idx ON offers (status, createdAt DESC, id DESC);
  `);
  return db;
}

export function getDb() {
  if (!globalThis.__offersDb) globalThis.__offersDb = createDatabase();
  return globalThis.__offersDb;
}

export function parseOffer(row: OfferRow) {
  return {
    id: row.id,
    providerName: row.providerName,
    officialUrl: row.officialUrl,
    benefits: JSON.parse(row.benefitsJson),
    requiresInvite: Boolean(row.requiresInvite),
    inviteCode: row.inviteCode,
    claimUrl: row.claimUrl,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isLongTerm: Boolean(row.isLongTerm),
    notes: row.notes,
    models: row.modelsJson ? JSON.parse(row.modelsJson) : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
