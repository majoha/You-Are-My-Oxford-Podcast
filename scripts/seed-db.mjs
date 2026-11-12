import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { seedDatabase } from '../db/seed.mjs';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before importing season data.');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
    await pool.query(await readFile(path.join(root, 'db', 'schema.sql'), 'utf8'));
    for (const summary of await seedDatabase(pool)) console.log(`${summary}.`);
} finally {
    await pool.end();
}
