# Routine

Routine is a personal daily-system web app for managing habits, events, tasks, deadlines, and tracked progress from Postgres.

It is built for one person, works well on mobile, installs as a PWA, and uses a regular database so day-to-day operations stay fast and reliable.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=111)
![Postgres](https://img.shields.io/badge/Storage-Postgres-336791?logo=postgresql&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-ready-5a0fc8)
[![CI](https://github.com/sujay-patni/routine-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/sujay-patni/routine-manager/actions/workflows/ci.yml)

## What You Can Do

- See a focused Today view of habits, timed events, all-day tasks, and deadlines.
- Group the day into Morning, Afternoon, Evening, Night, and All Day sections.
- Add habits, timed events, all-day tasks, and deadlines without leaving the app.
- Track simple habits with one tap.
- Track progress habits with custom units such as `steps`, `pages`, `reps`, `mins`, or `hrs`.
- Record actual time spent when completing habits and tasks.
- Open a Day Log for any date to see completed items and tracked minutes.
- Browse events and tasks in Calendar month, week, year, and schedule views.
- Change Schedule view between Today, This week, This month, This quarter, and This year.
- Use repeating schedules for habits and events.
- Skip a habit or event for a day, or skip weekly habits for the week.
- Organize habits and events into color-coded groups.
- Pause selected habits with Vacation mode.
- Save vacation presets for trips or recurring breaks.
- Manage habits from a dedicated Settings subpage.
- Manage groups from a dedicated Settings subpage.
- Configure timezone, week start, deadline surfacing, day start time, theme, and progress units.
- Protect the app behind a passphrase.
- Install it as a Progressive Web App on mobile or desktop.

## Screens and Workflows

### Today

The Today page is the main daily hub. It shows the current effective day, progress toward completing the day, planned time, group filters, and each item you need to handle.

Items are grouped into:

- All Day
- Morning
- Afternoon
- Evening
- Night
- Completed
- This Week

From the Today page you can:

- Complete habits and events.
- Swipe or use the time button to log actual time.
- Log numeric progress toward a target.
- Skip items.
- Open detail sheets.
- Edit existing items.
- Add new habits, events, tasks, and deadlines.
- Navigate to past or future dates with `?date=YYYY-MM-DD`.
- Open Day Log to review completed work and tracked time for the selected day.

### Calendar

The Calendar page shows scheduled events, all-day tasks, and deadlines across several views:

- Month
- Week
- Year
- Schedule

Schedule defaults to `This quarter`. You can switch it to `Today`, `This week`, `This month`, or `This year`. Group filters only show groups that have data in the currently visible range.

### Settings

Settings contains app preferences and links to management pages.

You can configure:

- Timezone
- Light/dark theme
- Week start day
- Deadline surface window
- Day start hour
- Progress units
- Database-backed preferences and history

Settings also links to:

- Habits management
- Groups management
- Vacation mode

### Habits Management

The Habits settings subpage lets you:

- Add habits.
- Edit habits.
- Pause or resume habits.
- Reorder habits inside their time-of-day sections.
- See frequency, progress target, group color, and paused state.

### Groups Management

The Groups settings subpage lets you:

- Create color-coded groups.
- Rename groups.
- Change group colors.
- Delete groups.
- See which habits and events belong to a group.

### Vacation Mode

The Vacations settings subpage lets you:

- Create current or upcoming vacations that pause selected habits.
- Pause habits directly, or pause every habit in selected groups.
- Save reusable presets.
- Apply a preset to a new date range.
- End an active vacation early.
- Keep past vacations as history without edit/delete actions.

## Data Model

Routine stores data in Postgres tables. The app expects these core entities:

- Habits: repeating routines.
- Completions: records of habit completions and progress logs.
- Events: timed events, all-day tasks, and deadlines.
- Settings: user preferences.
- Groups: color-coded organization.
- Skips: skipped habits/events for a date or week.
- Vacations: date ranges that pause selected habits or groups.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- shadcn-style UI primitives
- Neon Postgres
- Drizzle ORM and Drizzle Kit
- Serwist service worker for PWA support
- date-fns and date-fns-tz for date logic
- rrule for recurring events

## Requirements

- Node.js `20.9.0` or newer
- npm
- A Postgres database URL. Neon Free works well for a Vercel-hosted personal deployment.
- A deployment target. The documented path uses Vercel, but any host that can run Next.js with environment variables should work.

> Next.js 16 will not build or run correctly on older Node versions. This repo includes `.nvmrc` and the local npm scripts will automatically use an installed nvm Node 20+ when your active shell is older.

## Quick Start

```bash
git clone https://github.com/sujay-patni/routine-manager.git
cd routine-manager
npm install
cp .env.example .env.local
```

Fill in `DATABASE_URL`, `APP_PASSPHRASE`, and `COOKIE_SECRET`, then run:

```bash
npm run db:migrate
npm run db:seed
npm run db:verify
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), unlock with `APP_PASSPHRASE`, and create your first habits, groups, events, tasks, or vacations from the app UI.

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/sujay-patni/routine-manager.git
cd routine-manager
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a Postgres Database

Create a Neon Postgres database and copy its pooled connection string.

Recommended Neon settings:

- Start with the free plan for a personal deployment.
- Use the default database or create one named `routine_manager`.
- Copy the pooled connection string from the Neon dashboard's connection panel.
- Keep `sslmode=require` in the connection string.

The connection string should look like:

```text
postgresql://user:password@host/db?sslmode=require
```

### 4. Create `.env.local`

Copy the example environment file and fill in your database and app secrets:

```bash
cp .env.example .env.local
```

The file should contain values like these:

```bash
DATABASE_URL=postgresql://user:password@host/db?sslmode=require

APP_PASSPHRASE=choose-a-private-passphrase
COOKIE_SECRET=generate-a-long-random-secret

# Optional — required only if you use the Health Connect webhook
HEALTH_WEBHOOK_SECRET=generate-another-long-random-secret

# Optional app defaults used before a settings row exists
TIMEZONE=Asia/Kolkata
WEEK_START_DAY=1
DEADLINE_SURFACE_DAYS=3
DAY_START_HOUR=0
```

Generate a cookie secret with:

```bash
openssl rand -base64 32
```

### Environment Variables

| Variable | Required | Where | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Local and deployment | Postgres connection string. Neon pooled URLs work well on Vercel. |
| `APP_PASSPHRASE` | Yes | Local and deployment | Passphrase used to unlock the private app. |
| `COOKIE_SECRET` | Yes | Local and deployment | Long random string used to sign the auth cookie. |
| `HEALTH_WEBHOOK_SECRET` | Only for Health Connect | Local and deployment | Bearer token for `/api/health/webhook`. |
| `TIMEZONE` | Optional | Local and deployment | Default used before the settings row exists. Defaults to `Asia/Kolkata`. |
| `WEEK_START_DAY` | Optional | Local and deployment | `1` for Monday, `0` for Sunday. |
| `DEADLINE_SURFACE_DAYS` | Optional | Local and deployment | Default number of days before deadlines appear. |
| `DAY_START_HOUR` | Optional | Local and deployment | Logical day boundary, `0` to `23`. |
| `HEALTH_WEBHOOK_DEBUG` | Optional | Local only | Set to `1` for sanitized webhook debug logging. |

### 5. Run Migrations

```bash
npm run db:migrate
```

### 6. Verify the Database

Seed the default settings row first:

```bash
npm run db:seed
```

Then verify:

```bash
npm run db:verify
```

For a fresh database, this command should show zero rows for most tables and one settings row. For an existing database, it prints current table counts and fails if duplicate-sensitive records are invalid.

### 7. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The repo has `.nvmrc` set to Node 20. If your shell is still on Node 18 but Node 20 is installed through nvm, the npm scripts automatically run tools with the compatible installed Node version.

### 8. Unlock

Enter the value from `APP_PASSPHRASE`. The app stores a signed HTTP-only cookie for 30 days.

## Frequency and Date Formats

Habit `Frequency` values:

- `daily`
- `weekly`
- `specific_days_weekly`
- `specific_dates_monthly`
- `specific_dates_yearly`

Habit `Specific Days` examples:

- Weekly: `MO,WE,FR`
- Monthly: `1,15`
- Yearly: `01-15,12-31`

Time fields use 24-hour `HH:MM` text, for example:

```text
07:30
18:45
```

## Actual Time Tracking

Routine stores expected time and actual time separately.

- `Duration` is the planned/default duration.
- `Duration Actual` is what you actually logged when completing the item.

For habits, actual time is stored in the Completions database. For events and tasks, actual time is stored on the event itself.

Use Day Log from the Today page to review what was completed and how much time was tracked on any past date.

## Authentication

Routine uses a simple passphrase gate:

- `APP_PASSPHRASE` is the passphrase users enter.
- `COOKIE_SECRET` signs the auth cookie.
- The cookie lasts 30 days.
- Failed attempts are rate-limited in memory.

This is designed for a private personal app, not multi-user account management.

## Health Connect Sync (Optional)

Routine has no native access to Health Connect — Health Connect is an Android-only API with no web SDK. Instead, the app exposes a webhook receiver that a phone-side bridge app can post to. Synced data is written into the habit's normal Completions, so progress bars on Today auto-fill the same way they would for manual logging.

### Sender app

Use the [**sujay-patni/health-connect-webhook**](https://github.com/sujay-patni/health-connect-webhook) Android app — a fork of [mcnaveen's HC Webhook](https://github.com/mcnaveen/health-connect-webhook) with Routine-friendly sync behavior: **steps are sent as raw per-record entries** (each `StepsRecord` from the phone pedometer, usually small bursts across the day) instead of a single calendar-day aggregate, and interval sync can resend the full recent window.

Why the fork: the receiver attributes every record to a logical day using `Day Start Hour`. With the upstream aggregate, the 00:00–04:00 portion of each calendar day can't be split off, so it's mis-attributed when `Day Start Hour > 0`. With per-record data, each record carries its own precise `start_time` and is bucketed correctly. Routine overwrites the day's Completion on every sync, so interval sync should resend a complete recent window instead of only the delta since the previous sync.

Grab the latest signed-debug APK directly from the fork's [GitHub Releases page](https://github.com/sujay-patni/health-connect-webhook/releases) — the `app-foss-debug.apk` asset attached to each release is what you sideload.

### Setup

1. Set `Health Source` on each auto-fed habit to one of `steps`, `sleep_minutes`, `distance_meters`, or `active_calories`.
2. Set the property on each habit you want auto-fed. For example, a `Daily steps` habit with `Progress Metric=steps` and `Progress Target=10000` would have `Health Source=steps`.
3. Set `HEALTH_WEBHOOK_SECRET` to a long random string in your environment (`openssl rand -base64 32`).
4. Install the [fork's APK](https://github.com/sujay-patni/health-connect-webhook/releases) on your phone, grant it Health Connect read permission for the data types you want.
5. In the app, add a webhook with:
   - URL: `https://<your-deployment>/api/health/webhook`
   - Header: `Authorization: Bearer <HEALTH_WEBHOOK_SECRET>`
   - Sync interval: 1 hour works well; minimum is 15 min on Android.
   - Interval option: enable `Send full 48-hour window` so Routine can recalculate today's total from the complete recent Health Connect records.

### Behavior

- Data is bucketed by your `Day Start Hour` setting. With `Day Start Hour=4`, a step record with `start_time=02:00 May 8` counts toward logical May 7. Sleep is attributed to the day the session ended (sleep ending Tuesday morning counts for Tuesday).
- The webhook is **idempotent**: repeated syncs for the same day overwrite the existing Completion rather than creating duplicates. Multiple records on the same logical day are summed in-memory before a single upsert.
- Habits with `Health Source` unset (or `none`) are unaffected.
- The route returns `{ ok, upserted, unmapped, supportedInputCount }`. `unmapped` counts normalized records whose data type isn't wired to any active habit. Add `?debug=1` to the webhook URL while testing with curl/Postman to include sanitized receiver diagnostics in the JSON response.

### Payload API

Routine consumes this subset of the sender payload and ignores unsupported health arrays:

```json
{
  "timestamp": "2026-05-07T18:30:00Z",
  "app_version": "1.8.3",
  "sync": {
    "trigger": "interval",
    "explicit_range": false,
    "interval_full_lookback": true,
    "used_last_sync_filter": false
  },
  "steps": [
    { "count": 312, "start_time": "2026-05-07T10:00:00Z", "end_time": "2026-05-07T10:05:00Z" }
  ],
  "sleep": [
    { "session_end_time": "2026-05-07T01:30:00Z", "duration_seconds": 28140 }
  ],
  "distance": [
    { "meters": 520.4, "start_time": "2026-05-07T10:00:00Z", "end_time": "2026-05-07T10:15:00Z" }
  ],
  "active_calories": [
    { "calories": 42.5, "start_time": "2026-05-07T10:00:00Z", "end_time": "2026-05-07T10:15:00Z" }
  ]
}
```

### Debug logging

Set `HEALTH_WEBHOOK_DEBUG=1` in `.env.local` and restart the dev server. Each incoming POST logs sanitized counts and normalized upsert summaries as `[health-webhook] ...`. For a one-off local test with curl/Postman, append `?debug=1` to the webhook URL to include the same sanitized diagnostics in the HTTP response body.

### Disabling

Unset `HEALTH_WEBHOOK_SECRET` to reject all webhook requests with `401`. Removing the `Health Source` value from a habit (or setting it to `none`) is enough to stop auto-syncing that one without affecting others.

## Useful Commands

```bash
# Start local development
npm run dev

# Lint
npm run lint

# Typecheck
npm run typecheck

# Generate and apply database migrations
npm run db:generate
npm run db:migrate

# Seed defaults and verify table counts/duplicate-sensitive rows
npm run db:seed
npm run db:verify

# Production build
npm run build

# Start production server after build
npm run start
```

`npm run build` regenerates the Serwist service worker at `public/sw.js`, including the current PWA icon revisions.

## Deploying

The app works well on Vercel.

1. Push this repository to GitHub.
2. Import it into Vercel.
3. Add `DATABASE_URL`, `APP_PASSPHRASE`, `COOKIE_SECRET`, and any webhook/default env vars in Vercel Project Settings.
4. Run `npm run db:migrate` locally against the production database URL, or from a trusted CI/deploy environment that has `DATABASE_URL`.
5. Run `npm run db:seed` and `npm run db:verify` against the same database.
6. Deploy.
7. Open the deployment URL and unlock with `APP_PASSPHRASE`.
8. Create your first data from the UI, or restore data from your own Postgres backup.

For a fuller rebuild checklist, see [docs/REPLICATION.md](docs/REPLICATION.md).

## Security and Privacy

Routine is intended for self-hosting with your own database. Do not commit `.env.local`, database URLs, passphrases, cookie secrets, or private database identifiers.

The passphrase gate is useful for a personal deployment, but it is not a full multi-user authentication system. If you expose the app beyond your own use, put it behind your hosting provider's access controls or add a real auth provider.

## PWA Installation

Routine includes a web app manifest and service worker setup. In production, browsers can offer install prompts for a standalone app experience.

The app starts at `/today`, uses portrait orientation, and includes app icons in `public/icons`.

## Troubleshooting

### `App is not configured. Set APP_PASSPHRASE env var.`

Add `APP_PASSPHRASE` to `.env.local` or your deployment environment.

### Next.js says Node is too old

Install Node.js `20.9.0` or newer. If you use nvm, run:

```bash
nvm install
nvm use
```

### Database migrations fail

Confirm `DATABASE_URL` is set, points at Postgres, and includes SSL settings required by your provider.

### Data does not appear

Confirm:

- `DATABASE_URL` is correct in `.env.local` or your deployment environment.
- `npm run db:migrate` has been run.
- `npm run db:verify` passes.
- The item is active and scheduled for the selected date.

### Device allowlist does not work

Add active rows to the `allowed_devices` table. If the table has no active rows, Routine allows all devices to avoid locking you out.

## Project Structure

```text
app/
  actions/             Server actions for auth, habits, events, groups, settings
  calendar/            Calendar route and UI
  settings/            Settings, habits management, groups management
    vacations/         Vacation mode and presets
  today/               Today route, daily hub, day log
  unlock/              Passphrase screen

components/            Shared cards, sheets, navigation, and UI primitives
drizzle/               Generated SQL migrations and Drizzle metadata
lib/
  db/                  Drizzle schema, client, and Postgres repositories
  domain/              Shared app/domain types
  habit-logic.ts       Scheduling and progress logic
  auth.ts              Passphrase cookie helpers
public/                Manifest, icons, service worker output
scripts/               Runtime helpers and database verification scripts
```

## Notes for Forking

This repository is intentionally personal-first. If you fork it, expect to customize:

- Database schema/defaults
- PWA icons
- Default timezone
- Theme and styling
- Passphrase
- Progress units and conversions
- Groups/colors
- Vacation presets

The app is a strong base for a private routine system, but it is not designed as a hosted multi-tenant SaaS.

## Contributing

Issues and small pull requests are welcome. Please keep changes focused, include screenshots for UI changes, and run these checks before opening a PR:

```bash
npm run lint
npm run typecheck
npm run build
```

For larger features, open an issue first so the approach can be discussed.

## License

MIT. See [LICENSE](LICENSE).
