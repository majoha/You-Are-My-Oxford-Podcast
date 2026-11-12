# Render database prototype

The prototype has three Rage Online season files in `outputs/data/`. The game randomly draws from those seasons. When the app is served by the Node web service, it asks `/api/game/new` for a random season, its eligible roster, and players from other seasons that the computer can use as wrong picks. The static-site version falls back to the same three files while the API is not deployed.

## Deploy the API and game on Render

1. Push this repository to GitHub.
2. In Render, choose **New + → Web Service** and connect this repository.
3. Leave **Root Directory** empty. Set **Build Command** to `npm install` and **Start Command** to `npm start`.
4. Choose the same region as the Postgres database.
5. In the service’s **Environment** settings, add `DATABASE_URL` using the database’s **Internal Database URL**. Keep it in Render; it does not belong in the game files or GitHub.
6. Deploy. On startup, the service creates the tables and imports the three JSON season files. It serves the landing page, game page, and API from one service.

The health endpoint is `/api/health`. The randomly selected game payload is `/api/game/new`.

## Included trial seasons

- 1982/83
- 2002/03
- 2025/26

Season imports retain all players listed in the source appearance table, including zero-appearance records. The game treats only players with one or more appearances as valid picks. Computer bluffs are drawn from known Oxford players who did not appear in the selected season.

To refresh the three source files, run `npm run import:rage`. To manually seed a database from a machine with Node.js and network access, set `DATABASE_URL` and run `npm run db:seed`. The Render app also imports the bundled files on startup.
