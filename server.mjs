import express from 'express';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 10000);

app.get('/api/health', async (_request, response) => {
    try {
        await pool.query('SELECT 1');
        response.json({ ok: true });
    } catch {
        response.status(503).json({ ok: false, error: 'Database unavailable' });
    }
});

app.get('/api/game/new', async (_request, response) => {
    try {
        const { rows: seasons } = await pool.query(
            'SELECT season FROM seasons ORDER BY random() LIMIT 1'
        );
        if (!seasons.length) return response.status(503).json({ error: 'No seasons have been imported yet.' });
        const season = seasons[0].season;

        const [{ rows: players }, { rows: wrongPickCandidates }] = await Promise.all([
            pool.query(
                `SELECT p.display_name AS name, a.total_appearances AS "totalAppearances"
                 FROM season_appearances a
                 JOIN players p ON p.id = a.player_id
                 WHERE a.season = $1 AND a.total_appearances > 0
                 ORDER BY p.display_name`,
                [season]
            ),
            pool.query(
                `SELECT DISTINCT p.display_name AS name
                 FROM players p
                 JOIN season_appearances other_seasons
                   ON other_seasons.player_id = p.id AND other_seasons.total_appearances > 0
                 WHERE NOT EXISTS (
                   SELECT 1 FROM season_appearances current_season
                   WHERE current_season.player_id = p.id
                     AND current_season.season = $1
                     AND current_season.total_appearances > 0
                 )
                 ORDER BY name`,
                [season]
            ),
        ]);

        response.set('Cache-Control', 'no-store');
        response.json({ season, players, wrongPickCandidates: wrongPickCandidates.map(row => row.name) });
    } catch (error) {
        console.error('Could not create game:', error);
        response.status(500).json({ error: 'Could not load a game season.' });
    }
});

app.use(express.static(path.join(root, 'outputs')));

async function start() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
    const schema = await readFile(path.join(root, 'db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    app.listen(port, '0.0.0.0', () => console.log(`Jon Narbett game listening on ${port}.`));
}

start().catch(error => {
    console.error('Server startup failed:', error);
    process.exit(1);
});
