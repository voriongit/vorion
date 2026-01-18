import { readFileSync, existsSync } from 'node:fs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const envFile = process.env['VORION_ENV_FILE'] ?? '.env';
if (existsSync(envFile)) {
  const fileContents = readFileSync(envFile, 'utf8');
  for (const line of fileContents.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    const value = line.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, '../drizzle/migrations');

const dbConfig = {
  host: process.env['VORION_DB_HOST'] ?? 'localhost',
  port: Number(process.env['VORION_DB_PORT'] ?? 5432),
  database: process.env['VORION_DB_NAME'] ?? 'vorion',
  user: process.env['VORION_DB_USER'] ?? 'vorion',
  password: process.env['VORION_DB_PASSWORD'] ?? '',
};

async function main() {
  console.log('[migrate] using database config', {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
  });

  const pool = new Pool(dbConfig);
  const db = drizzle(pool);

  try {
    await migrate(db, { migrationsFolder });
    console.log('[migrate] completed successfully');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[migrate] failed', error);
  process.exit(1);
});
