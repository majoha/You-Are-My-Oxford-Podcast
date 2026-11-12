import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seasonPages = [
    { season: '1982/83', pageId: 24 },
    { season: '2002/03', pageId: 41 },
    { season: '2025/26', pageId: 133 },
];

function decodeEntities(value) {
    const named = { amp: '&', apos: "'", nbsp: ' ', quot: '"', lt: '<', gt: '>', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—' };
    return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
        if (entity[0] === '#') {
            const code = entity[1].toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        return named[entity.toLowerCase()] ?? match;
    });
}

function plainText(markup) {
    return decodeEntities(markup.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

function extractAppearanceTable(html, season, sourceUrl) {
    const marker = html.indexOf('Appearance data</span>');
    const end = html.indexOf('</tbody>', marker);
    if (marker < 0 || end < 0) throw new Error(`Could not find the appearance table for ${season}.`);
    const table = html.slice(marker, end);
    const headerMatch = table.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    if (!headerMatch) throw new Error(`Could not find appearance table headings for ${season}.`);
    const headings = [...headerMatch[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(([, cell]) => {
        const desktopLabel = cell.match(/<div[^>]*d-none[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? cell;
        return plainText(desktopLabel).replace(/\s+/g, ' ');
    });
    const competitionNames = headings.slice(1, -1);
    if (!competitionNames.length || headings[0]?.toLowerCase() !== 'player' || headings.at(-1)?.toLowerCase() !== 'total') {
        throw new Error(`Unexpected appearance table columns for ${season}: ${headings.join(', ')}`);
    }

    const players = [];
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const [, row] of rows) {
        const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, cell]) => cell);
        if (cells.length < competitionNames.length + 2) continue;
        const link = cells[0].match(/<a\b[^>]*href=['"][^'"]*\/player\/(\d+)\/?[^'"]*['"][^>]*>([\s\S]*?)<\/a>/i);
        if (!link) continue;
        const competitions = competitionNames.map((competition, index) => {
            const stats = plainText(cells[index + 1]).match(/^(\d+)\s*(?:\((\d+)\))?/);
            if (!stats) throw new Error(`Could not parse ${competition} appearances for ${plainText(link[2])} (${season}).`);
            return {
                competition,
                starts: Number(stats[1]),
                substituteAppearances: Number(stats[2] ?? 0),
            };
        });
        const starts = competitions.reduce((sum, item) => sum + item.starts, 0);
        const substituteAppearances = competitions.reduce((sum, item) => sum + item.substituteAppearances, 0);
        const totalCell = plainText(cells[competitionNames.length + 1]).match(/^(\d+)\s*(?:\((\d+)\))?/);
        if (!totalCell || starts !== Number(totalCell[1]) || substituteAppearances !== Number(totalCell[2] ?? 0)) {
            throw new Error(`Competition totals do not match Rage Online's Total column for ${plainText(link[2])} (${season}).`);
        }
        players.push({
            rageOnlinePlayerId: Number(link[1]),
            name: plainText(link[2]),
            starts,
            substituteAppearances,
            totalAppearances: starts + substituteAppearances,
            competitions,
        });
    }
    if (!players.length) throw new Error(`No players were parsed for ${season}.`);

    return {
        season,
        source: 'Rage Online',
        sourceUrl,
        importedAt: new Date().toISOString(),
        attribution: 'Player appearance data sourced from Rage Online (https://rageonline.co.uk/).',
        extractionNotes: 'Includes every player listed in the season appearance table, including zero-appearance rows. Starts and substitute appearances are recorded separately for every competition shown by Rage Online.',
        competitionColumns: competitionNames,
        sourceRows: players.length,
        includedPlayers: players.length,
        players,
    };
}

await mkdir(path.join(root, 'outputs', 'data'), { recursive: true });
for (const { season, pageId } of seasonPages) {
    const sourceUrl = `https://rageonline.co.uk/mainpage/season/${pageId}`;
    const response = await fetch(sourceUrl, { headers: { 'user-agent': 'JonNarbettGameDataImporter/1.0' } });
    if (!response.ok) throw new Error(`Rage Online returned ${response.status} for ${season}.`);
    const data = extractAppearanceTable(await response.text(), season, sourceUrl);
    const filename = `rage-online-${season.replace('/', '-')}.json`;
    await writeFile(path.join(root, 'outputs', 'data', filename), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    console.log(`${season}: saved ${data.players.length} players (${data.players.filter(player => player.totalAppearances > 0).length} with appearances).`);
}
