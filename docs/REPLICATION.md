# Replication Guide

This guide rebuilds Routine from an empty checkout to a working Postgres-backed deployment.

## 1. Prerequisites

- Node.js `20.9.0` or newer.
- npm.
- A Neon Postgres project, or another Postgres database that accepts SSL connections.
- A Vercel account if you want the same hosting setup.

The repo includes `.nvmrc` and a script wrapper that uses an installed nvm Node 20+ when the active shell is older.

## 2. Create the Database

1. Create a Neon project.
2. Use the default database or create one named `routine_manager`.
3. Open the connection panel.
4. Copy the pooled connection string.
5. Keep `sslmode=require` in the URL.

The value should look like:

```text
postgresql://user:password@host/db?sslmode=require
```

## 3. Configure Local Environment

```bash
cp .env.example .env.local
```

Fill these values first:

```bash
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
APP_PASSPHRASE=choose-a-private-passphrase
COOKIE_SECRET=replace-with-a-long-random-secret
```

Generate `COOKIE_SECRET` with:

```bash
openssl rand -base64 32
```

Optional defaults:

```bash
TIMEZONE=Asia/Kolkata
WEEK_START_DAY=1
DEADLINE_SURFACE_DAYS=3
DAY_START_HOUR=0
```

Optional Health Connect webhook:

```bash
HEALTH_WEBHOOK_SECRET=replace-with-another-long-random-secret
```

## 4. Install and Migrate

```bash
npm install
npm run db:migrate
npm run db:seed
npm run db:verify
```

`db:migrate` applies the Drizzle migrations in `drizzle/`.

`db:seed` creates the default settings row from your environment values if it does not already exist.

`db:verify` prints table counts and checks duplicate-sensitive records:

- one settings row
- no duplicate completion rows for the same habit and date
- no duplicate day skips
- no duplicate week skips

## 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter `APP_PASSPHRASE`, and create data from the app:

1. Create groups from Settings -> Groups.
2. Create habits from Today or Settings -> Habits.
3. Create events, tasks, and deadlines from Today or Calendar.
4. Save settings once so preferences are persisted in Postgres.
5. Optionally create vacation presets from Settings -> Vacation mode.

## 6. Deploy to Vercel

1. Push the branch to GitHub.
2. Import the repository into Vercel.
3. Add these environment variables in Vercel Project Settings:

```bash
DATABASE_URL
APP_PASSPHRASE
COOKIE_SECRET
HEALTH_WEBHOOK_SECRET # optional
TIMEZONE # optional
WEEK_START_DAY # optional
DEADLINE_SURFACE_DAYS # optional
DAY_START_HOUR # optional
```

4. Apply migrations to the production database:

```bash
npm run db:migrate
npm run db:seed
npm run db:verify
```

Run those commands from a trusted machine or CI environment using the same production `DATABASE_URL`.

5. Deploy the app.
6. Open the deployment URL and unlock it with `APP_PASSPHRASE`.

## 7. Production Smoke Test

After deploy, verify:

- `/unlock` accepts the passphrase.
- `/today` loads.
- A new habit can be created and completed.
- Calendar can create an event, task, or deadline.
- Settings save successfully.
- Groups can be created and assigned.
- Vacation mode can create a current or future pause.
- `npm run db:verify` still passes.

If you use Health Connect, send a test webhook request with `Authorization: Bearer <HEALTH_WEBHOOK_SECRET>` and confirm it updates exactly one completion row for the same habit/date on repeated syncs.

## 8. Backups and Restore

Routine is now Postgres-only. Keep backups at the database layer.

For Neon, use the project dashboard features for branches, restore points, and backups available on your plan. For a portable backup, export with `pg_dump` from a machine that can reach your database.

Before risky schema changes:

```bash
npm run db:verify
npm run build
```

Then create a database backup or Neon branch, apply migrations, and run `npm run db:verify` again.

## 9. Common Failure Points

- `DATABASE_URL` missing or pointing at the wrong database.
- Local shell uses Node 18 directly instead of the script wrapper.
- Vercel has env vars in Preview but not Production, or the reverse.
- Migrations were run locally but not against production.
- `COOKIE_SECRET` changed, which signs users out.
- `allowed_devices` has active rows, so unlisted devices are blocked. If the table has no active rows, the app fails open to avoid lockout.
