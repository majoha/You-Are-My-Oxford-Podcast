CREATE TABLE IF NOT EXISTS seasons (
    season TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,
    source_key TEXT NOT NULL UNIQUE,
    rage_online_player_id BIGINT,
    display_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS players_rage_online_id_unique
    ON players (rage_online_player_id)
    WHERE rage_online_player_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS season_appearances (
    season TEXT NOT NULL REFERENCES seasons(season) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    starts INTEGER NOT NULL DEFAULT 0 CHECK (starts >= 0),
    substitute_appearances INTEGER NOT NULL DEFAULT 0 CHECK (substitute_appearances >= 0),
    total_appearances INTEGER NOT NULL DEFAULT 0 CHECK (total_appearances >= 0),
    competition_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (season, player_id)
);

CREATE INDEX IF NOT EXISTS season_appearances_valid_roster
    ON season_appearances (season, total_appearances)
    WHERE total_appearances > 0;
