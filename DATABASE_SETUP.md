# Render database setup

The game asks `/api/game/new` for a random season, its eligible roster, and players from other seasons that the computer can use as wrong picks. The web service creates/checks the database schema at startup but does not import season JSON files. This keeps ordinary code deploys from reimporting the dataset. Season data is imported only when `npm run db:seed` is run deliberately.

## Deploy the API and game on Render

1. Push this repository to GitHub.
2. In Render, choose **New + → Web Service** and connect this repository.
3. Leave **Root Directory** empty. Set **Build Command** to `npm install` and **Start Command** to `npm start`.
4. Choose the same region as the Postgres database.
5. In the service’s **Environment** settings, add `DATABASE_URL` using the database’s **Internal Database URL**. Keep it in Render; it does not belong in the game files or GitHub.
6. Deploy. The service creates/checks the tables and serves the landing page, game page, and API from one service. It does not import season data automatically.

The health endpoint is `/api/health`. The randomly selected game payload is `/api/game/new`.

## Import or update season data

Put files named `rage-online-*.json` in `outputs/data/`. To import or update the database, run `npm run db:seed` in an environment where `DATABASE_URL` points to the intended Postgres database. In Render, run the command from the web service shell; the service environment already provides its `DATABASE_URL`. Use the database's Internal Database URL for commands run from another Render service in the same region, or its External Database URL when connecting from your PC.

The seed command imports every matching season file. It retains all players listed in each source appearance table, including zero-appearance records. The game treats only players with one or more appearances as valid picks. Computer bluffs are drawn from known Oxford players who did not appear in the selected season.

To refresh the three original trial source files, run `npm run import:rage`; to add or refresh your full archive, place the exported JSON files in `outputs/data/` and run `npm run db:seed`.
