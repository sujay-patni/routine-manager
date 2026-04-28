# Routine

Routine is a personal daily-system web app for managing habits, events, tasks, deadlines, and tracked progress from your own Notion workspace.

It is built for one person, works well on mobile, installs as a PWA, and keeps the source of truth in Notion instead of locking your routine data inside a proprietary database.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=111)
![Notion](https://img.shields.io/badge/Storage-Notion-black?logo=notion)
![PWA](https://img.shields.io/badge/PWA-ready-5a0fc8)

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
- Notion export links

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

Routine stores data in Notion databases. The app expects these core entities:

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
- Notion API
- Serwist service worker for PWA support
- date-fns and date-fns-tz for date logic
- rrule for recurring events

## Requirements

- Node.js `20.9.0` or newer
- npm
- A Notion account
- A Notion integration token
- Notion databases for the app data

> Next.js 16 will not build or run correctly on older Node versions. This repo includes `.nvmrc` and the local npm scripts will automatically use an installed nvm Node 20+ when your active shell is older.

## Local Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd routine-manager
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations).
2. Create a new internal integration.
3. Copy the integration secret.
4. Share every Routine database with this integration.

The integration needs access to read, create, update, and archive pages in the databases you use.

### 4. Create `.env.local`

Create a `.env.local` file in the project root:

```bash
NOTION_API_KEY=secret_xxx

NOTION_HABITS_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_COMPLETIONS_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_EVENTS_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional but recommended
NOTION_SETTINGS_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_GROUPS_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_SKIPS_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_VACATIONS_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

APP_PASSPHRASE=choose-a-private-passphrase
COOKIE_SECRET=generate-a-long-random-secret

# Used only when NOTION_SETTINGS_DB_ID is missing
TIMEZONE=Asia/Kolkata
WEEK_START_DAY=1
DEADLINE_SURFACE_DAYS=3
DAY_START_HOUR=0
```

Database IDs can be copied from Notion database URLs. They are the long identifier in the URL. Dashes are fine.

Generate a cookie secret with:

```bash
openssl rand -base64 32
```

### 5. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The repo has `.nvmrc` set to Node 20. If your shell is still on Node 18 but Node 20 is installed through nvm, the `dev`, `build`, and `start` npm scripts automatically run Next.js with the compatible installed Node version.

### 6. Unlock

Enter the value from `APP_PASSPHRASE`. The app stores a signed HTTP-only cookie for 30 days.

## Notion Database Setup

Property names matter. Create the databases below and use the exact property names.

### Habits Database

Required environment variable: `NOTION_HABITS_DB_ID`

| Property | Type | Notes |
| --- | --- | --- |
| `Name` | Title | Habit name |
| `Description` | Rich text | Optional notes |
| `Frequency` | Select | `daily`, `weekly`, `specific_days_weekly`, `specific_dates_monthly`, `specific_dates_yearly` |
| `Weekly Target` | Number | Used for weekly habits |
| `Color` | Select | Legacy/display fallback |
| `Icon` | Rich text | Legacy/display fallback |
| `Active` | Checkbox | Paused habits are inactive |
| `Time of Day` | Select | `morning`, `afternoon`, `evening`, `night` |
| `Exact Time` | Rich text | `HH:MM` format |
| `Specific Days` | Rich text | Weekly days, monthly dates, or yearly dates |
| `Progress Metric` | Rich text | Unit such as `steps`, `mins`, `hrs`, `pages` |
| `Progress Target` | Number | Target value |
| `Progress Start` | Number | Optional baseline |
| `Progress Period` | Select | `daily`, `weekly`, `monthly`, `yearly` |
| `Progress Conversion` | Number | Minutes per unit for non-time progress |
| `Progress Conversion Base` | Number | Optional conversion base |
| `Duration` | Number | Default expected minutes |
| `Sort Order` | Number | Used for manual ordering |
| `Group` | Relation | Relation to Groups database |

### Completions Database

Required environment variable: `NOTION_COMPLETIONS_DB_ID`

| Property | Type | Notes |
| --- | --- | --- |
| `Title` | Title | Generated from habit and date |
| `Habit` | Relation | Relation to Habits database |
| `Date` | Date | Completion date |
| `Note` | Rich text | Optional |
| `Progress Value` | Number | Logged progress value |
| `Duration Actual` | Number | Actual minutes spent |

### Events Database

Required environment variable: `NOTION_EVENTS_DB_ID`

| Property | Type | Notes |
| --- | --- | --- |
| `Title` | Title | Event/task/deadline title |
| `Description` | Rich text | Optional notes |
| `Type` | Select | `timed`, `all_day`, `deadline` |
| `Start Time` | Date | Timed events |
| `End Time` | Date | Optional timed event end |
| `Due Date` | Date | Tasks and deadlines |
| `Recurring` | Checkbox | Enables recurrence |
| `Recurrence Rule` | Rich text | RRULE text |
| `Surface Days` | Number | Days before deadline appears |
| `Completed` | Checkbox | Completion state |
| `Time of Day` | Select | `morning`, `afternoon`, `evening`, `night` |
| `Due Time` | Rich text | `HH:MM` for tasks/deadlines |
| `Group` | Relation | Relation to Groups database |
| `Duration` | Number | Default expected minutes |
| `Duration Actual` | Number | Actual minutes logged |

### Settings Database

Optional but recommended environment variable: `NOTION_SETTINGS_DB_ID`

If this database is not configured, Routine falls back to environment variables for settings. In-app settings changes will not persist across deploys unless this database exists.

| Property | Type | Notes |
| --- | --- | --- |
| `Title` | Title | Use something like `App Settings` |
| `Timezone` | Rich text | IANA timezone, e.g. `Asia/Kolkata` |
| `Week Start Day` | Number | `1` for Monday, `0` for Sunday |
| `Deadline Surface Days` | Number | Default deadline lookahead |
| `Day Start Hour` | Number | `0` to `23` |
| `Progress Units` | Rich text | Comma-separated custom units; `mins` and `hrs` are always included |

### Groups Database

Optional environment variable: `NOTION_GROUPS_DB_ID`

| Property | Type | Notes |
| --- | --- | --- |
| `Name` | Title | Group name |
| `Color` | Rich text | Hex color, e.g. `#8b5cf6` |
| `Sort Order` | Number | Optional ordering |

### Skips Database

Optional environment variable: `NOTION_SKIPS_DB_ID`

Without this database, skipping is disabled or unavailable for persisted skip history.

| Property | Type | Notes |
| --- | --- | --- |
| `Title` | Title | Item title |
| `Item Type` | Select | `habit` or `event` |
| `Item ID` | Rich text | Notion page ID of skipped item |
| `Scope` | Select | `day` or `week` |
| `Date` | Date | Skip date |
| `Week Start` | Date | For weekly skips |
| `Week End` | Date | For weekly skips |

### Vacations Database

Optional but recommended environment variable: `NOTION_VACATIONS_DB_ID`

Without this database, Vacation mode is unavailable and paused-habit history cannot be stored.

| Property | Type | Notes |
| --- | --- | --- |
| `Title` | Title | Vacation or preset name |
| `Is Template` | Checkbox | Checked rows are reusable presets |
| `Start Date` | Date | Vacation start date; blank for presets |
| `End Date` | Date | Vacation end date; blank for presets |
| `Habit IDs` | Rich text | Comma-separated Notion habit page IDs |
| `Group IDs` | Rich text | Comma-separated Notion group page IDs |
| `Note` | Rich text | Optional notes |

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

## Useful Commands

```bash
# Start local development
npm run dev

# Lint
npm run lint

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
3. Add all required environment variables in Vercel Project Settings.
4. Deploy.
5. Open the deployment URL and unlock with `APP_PASSPHRASE`.

Make sure your Notion integration has access to every database you configured.

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

### Notion returns missing property errors

Check that the database property names exactly match the tables above. Notion property names are case-sensitive.

### Data does not appear

Confirm:

- The correct database IDs are in `.env.local`.
- The Notion integration has been shared with each database.
- `NOTION_API_KEY` is valid.
- The item is active and scheduled for the selected date.

### Settings do not persist

Add `NOTION_SETTINGS_DB_ID` and create the Settings database. Without it, settings fall back to environment variables.

### Groups or skips do not work

Create the optional Groups or Skips database and set `NOTION_GROUPS_DB_ID` or `NOTION_SKIPS_DB_ID`.

### Vacation mode does not work

Create the optional Vacations database and set `NOTION_VACATIONS_DB_ID`. Share the database with the same Notion integration as the other databases.

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
lib/
  notion/              Notion API mappers and database helpers
  habit-logic.ts       Scheduling and progress logic
  auth.ts              Passphrase cookie helpers
public/                Manifest, icons, service worker output
```

## Notes for Forking

This repository is intentionally personal-first. If you fork it, expect to customize:

- Notion schema/views
- PWA icons
- Default timezone
- Theme and styling
- Passphrase
- Progress units and conversions
- Groups/colors
- Vacation presets

The app is a strong base for a private routine system, but it is not designed as a hosted multi-tenant SaaS.
