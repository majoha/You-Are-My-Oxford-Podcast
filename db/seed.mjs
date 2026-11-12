import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function normalizeName(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function seedDatabase(pool) {
    const dataDir = path.join(root, 'outputs', 'data');
    const files = (await readdir(dataDir)).filter(file => /^rage-online-.*\.json$/i.test(file)).sort();
    if (!files.length) throw new Error(`No Rage Online season JSON files found in ${dataDir}.`);

    const summaries = [];
    for (const file of files) {
        const data = JSON.parse(await readFile(path.join(dataDir, file), 'utf8'));
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(
                `INSERT INTO seasons (season, source_url, imported_at)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (season) DO UPDATE
                 SET source_url = EXCLUDED.source_url, imported_at = EXCLUDED.imported_at`,
                [data.season, data.sourceUrl, data.importedAt]
            );
            await client.query('DELETE FROM season_appearances WHERE season = $1', [data.season]);

            for (const player of data.players) {
                const sourceKey = player.rageOnlinePlayerId
                    ? `rage-${player.rageOnlinePlayerId}`
                    : `name-${normalizeName(player.name)}`;
                const { rows } = await client.query(
                    `INSERT INTO players (source_key, rage_online_player_id, display_name, normalized_name)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (source_key) DO UPDATE
                     SET display_name = EXCLUDED.display_name,
                         normalized_name = EXCLUDED.normalized_name,
                         rage_online_player_id = COALESCE(EXCLUDED.rage_online_player_id, players.rage_online_player_id)
                     RETURNING id`,
                    [sourceKey, player.rageOnlinePlayerId ?? null, player.name, normalizeName(player.name)]
                );
                await client.query(
                    `INSERT INTO season_appearances
                       (season, player_id, starts, substitute_appearances, total_appearances, competition_data)
                     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
                    [data.season, rows[0].id, player.starts, player.substituteAppearances, player.totalAppearances, JSON.stringify(player.competitions)]
                );
            }
            await client.query('COMMIT');
            summaries.push(`${data.season}: ${data.players.length} listed players, ${data.players.filter(player => player.totalAppearances > 0).length} eligible picks`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    return summaries;
}
