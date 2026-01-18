import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/intent/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    host: process.env['VORION_DB_HOST'] ?? 'localhost',
    port: Number(process.env['VORION_DB_PORT'] ?? 5432),
    database: process.env['VORION_DB_NAME'] ?? 'vorion',
    user: process.env['VORION_DB_USER'] ?? 'vorion',
    password: process.env['VORION_DB_PASSWORD'] ?? '',
  },
});
