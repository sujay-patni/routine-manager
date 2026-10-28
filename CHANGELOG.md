# Changelog

All notable changes to Routine Manager are documented here. This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [2.1.0] - 2026-10-29

### Added

- **Rise, a native Android app** (`mobile/`, Rise 1.0.0). An Expo / React Native version of Routine that stores everything on the phone in SQLite. No server, account, or login. The habit, event, skip, and vacation logic is ported from the web app, and running both apps against the same real data across 50 days gave identical results.
  - Screens: Today (time sections, completed/skipped lists, This Week grid, Day Log, group filters), Calendar (Day, Week, Month, Year, and Schedule views), Settings, and Habits / Groups / Vacations management. Habit and event detail sheets, plus a Light / Dark / System theme switch.
  - **Health Connect:** steps, sleep, distance, and active calories are read straight from the phone (no webhook) and synced into habits with a health source on launch, on resume, and on pull-to-refresh.
  - **Backup & restore:** export everything to a JSON file through the share sheet; restore from a file after a confirmation.
  - Custom app icon (`mobile/scripts/make-icons.cjs`).
- `npm run db:export-mobile` writes your Neon data as a Rise backup file for a one-time move to the phone.

### Changed

- **Mobile UX overhaul (web):** Select dropdowns no longer get cut off on phones; failed habit toggles roll back with an error toast instead of silently freezing; toasts for previously silent failures; inline form validation in the Add/Edit sheets; a layout-matched loading skeleton; bigger touch targets; a This Week grid that fits 320px screens; ARIA labels across checkboxes, progress ring, week dots, and accordions.
- `mobile/` is excluded from the web app's typecheck and ESLint. Exported `routine-backup-*.json` files are git-ignored.

### Fixed

- **Deadline countdown was a day short for most of the day.** "Due in N days" now counts calendar days, so a deadline two days away reads "2 days" at any time.
- **Today's events respect Day Start Hour** (#20).
- **Daily steps no longer drop on later syncs** (#21). Takes the larger of the daily aggregate and the bout sum, so a stale aggregate can't lower the total.

### Notes

- Rise and the web app don't sync with each other. After moving to Rise, log in one app only.
- The Rise APK attached to this release is signed with a development key for personal sideloading, not the Play Store.

---

## [2.0.0] - 2026-05-26

### Breaking

- **Neon/Postgres is now the only data source.** Notion integration code, Notion env vars, and Notion import scripts were removed.

### Added

- Drizzle schema, migrations, a lazy database client, and Postgres repositories for habits, completions, events, settings, groups, skips, vacations, and allowed devices.
- `db:seed` and `db:verify` scripts for reproducible setup and database health checks.
- Setup documentation for Neon, local development, Vercel deployment, backups, and smoke testing.

### Upgrade notes

- Set `DATABASE_URL`, then run `npm run db:migrate`, `npm run db:seed`, and `npm run db:verify` against each database.
- Remove old `NOTION_*` environment variables. Keep `APP_PASSPHRASE`, `COOKIE_SECRET`, and the optional `HEALTH_WEBHOOK_SECRET`.

---

## [1.4.1] - 2026-05-08

### Fixed

- **Step counts now match Samsung Health UI on days with a daily aggregate.** Samsung Health pushes both per-bout step records and a 24-hour merged "Combined" record to Health Connect. The normalizer previously summed these, double-counting; now records spanning ≥ 22 hours are detected as daily aggregates, bucketed by midpoint (so they land on the correct logical day even when the calendar-day window straddles `Day Start Hour`), and override the bout-level sum for the same `dayKey`. Bout durations are still summed independently for `duration_actual`, so "active walking time" stays meaningful.
- **Partial-window syncs no longer overwrite previously-complete past days.** When the sender includes `sync.data_window_start` (hc-connect 1.8.5+), the normalizer skips upserts for past logical days that fall only partially inside `[data_window_start, webhook_timestamp]`. A sync at 1 AM with a 48 h lookback can no longer corrupt yesterday-minus-one with the 3-hour fragment that happens to be in the window. "Today" is always written (in-progress is expected to be partial), and days with a daily aggregate are always considered authoritative regardless of window.

### Sender notes

- Pairs with [sujay-patni/health-connect-webhook v1.8.5](https://github.com/sujay-patni/health-connect-webhook/releases/tag/v1.8.5). Older sender versions still work — the partial-window guard falls back to "always write" when `data_window_start` is missing, preserving prior behavior.

---

## [1.4.0] - 2026-05-07

### Added

- **Health Connect Sync** — Optional `/api/health/webhook` endpoint receives data from the [sujay-patni/health-connect-webhook](https://github.com/sujay-patni/health-connect-webhook) Android app (a fork of mcnaveen's HC Webhook with raw per-record `StepsRecord` reads) and writes Health Connect steps, sleep, distance, and active calories straight into habit Completions. Each habit opts in via a `Health Source` field (`steps`, `sleep_minutes`, `distance_meters`, `active_calories`). Sleep is attributed to the day the session ended; activity to the logical day under `Day Start Hour`. Idempotent — repeated syncs overwrite the day's row instead of duplicating. Auth is a bearer token from `HEALTH_WEBHOOK_SECRET`.
- Health-synced habits show an Activity icon on Today and Settings → Habits, plus an in-app setup guide on the Habits settings page.
- New habits created via the app default `Health Source` to `none`.
- `HEALTH_WEBHOOK_DEBUG=1` env var logs sanitized request summaries for debugging without dumping raw health records.

### Changed

- Layout refactor: extracted `MainContent` so `/blocked` and `/unlock` render full-width without the desktop sidebar offset.

### Setup Notes

- New optional Habits property: `Health Source` (Select). Options: `none`, `steps`, `sleep_minutes`, `distance_meters`, `active_calories`. Required only if you want webhook-driven auto-sync; existing habits work unchanged without it.
- New optional env var: `HEALTH_WEBHOOK_SECRET`. Required only if you wire up the webhook.

### Sender notes

- Recommended sender: [sujay-patni/health-connect-webhook](https://github.com/sujay-patni/health-connect-webhook). The fork emits raw `StepsRecord` entries instead of calendar-day aggregates so `Day Start Hour=4` step attribution is correct down to the minute. Enable its interval-mode `Send full 48-hour window` option when syncing to Routine so each retry overwrites the day with a complete recent total. Pre-built APK on the fork's Releases page.

---

## [1.3.0] - 2026-04-28

### Added

- **Groups** — Organize habits, events, tasks, and deadlines with color-coded group filters.
- **Vacation Mode** — Pause selected habits or entire groups for a date range, with reusable vacation presets.
- **Skip Tracking** — Track skips for habits and events, including weekly skips for weekly habits.
- **Duration Tracking** — Planned/default duration for habits and events; actual duration logged on completion; Day Log totals tracked time for the selected day.
- **Timetable View** — Today page now has a timetable layout with exact-time blocks, a live now-line, and unscheduled items.
- **Day Log** — Panel for reviewing completed habits, events, and tracked minutes for any day.
- **Progress Units** — Configurable progress units including built-in `mins` and `hrs` plus custom units.
- **Day Start Hour** — 4 AM-style day boundaries so habits reset after midnight instead of exactly at midnight.

### Changed

- Today page supports a persisted card/timetable view toggle and shows planned time for the selected day.
- Pending items ordered more naturally by current time section; all-day items appear immediately after the current time section.
- Completed items separated into their own muted section.
- Settings now includes dedicated management pages for habits, groups, and vacations.
- Calendar schedule view supports group filtering and broader date ranges.

### Fixed

- Fixed late-night habit reset behavior with effective-day support.
- Fixed Today navigation when the real calendar date differs from the effective habit date.
- Fixed mobile habit detail sheet spacing.
- Fixed bottom navigation appearing above sheets/modals.
- Suppressed urgent habit styling during late-night carryover windows.

### Setup Notes

New or updated fields:
- Habits: `Duration`, `Group`, `Progress Conversion`, `Progress Conversion Base`
- Completions: `Duration Actual`
- Events: `Duration`, `Duration Actual`, `Group`
- Settings: `Day Start Hour`, `Progress Units`

---

## [1.2.0] - 2026-04-23

### Added

- **Habit & Event Detail Sheets** — Tapping a habit or event card opens a read-only detail view showing all metadata (frequency schedule, progress period, timing, description). An Edit button jumps directly to the edit form.
- **Dark / Light Theme** — Dark mode support with `localStorage` persistence and automatic system-preference detection on first launch. Toggle available in Settings.
- **Settings Context Provider** — App settings available globally via React context (`useSettings()`), eliminating redundant settings fetches across pages.

### Changed

- **Per-page Error Boundaries** — Today, Calendar, and Settings each have their own error UI with a retry button. Errors in one section no longer blank out the entire app.
- **UI & Design Polish** — Refined spacing, typography, and component layouts across Today, Calendar, and Settings. Sheet animation and bottom nav styling updated.

### Fixed

- Fixed layout and state bugs in `TodayClient`
- Fixed card rendering issues in `HabitCard` and `EventCard`
- Fixed settings page fetch and display bugs in `SettingsClient` and `CalendarClient`

---

## [1.1.0] - 2026-04-17

### Added

- **Progress period** (`daily` / `weekly` / `monthly` / `yearly`) per habit — progress resets at the end of each period.
- **Sort order** — ↑↓ reorder buttons in Settings; order persisted as `sort_order`.
- **Edit Habit Sheet** — full in-app editing (name, description, frequency, specific days/dates, timing, progress target + period)
- **Edit Event Sheet** — description field added
- **History navigation** — Today page accepts `?date=YYYY-MM-DD` query param to view any past date

### Changed

- All Day section moved to the top of the Today page (above timed sections)
- Habit cards no longer show time-of-day label; only exact time shown (e.g. "9:00 AM")
- Progress bar shows period label ("this week", "this month", etc.)
- Add Item Sheet is scrollable on mobile (`max-h-[90vh]`)
- Settings habit list grouped by section and includes paused habits

### Removed

- Icon and color picker removed from habit creation; cards no longer show color border or icon

---

## [1.0.0] - 2026-04-15

### Added

- **Calendar view** — dedicated calendar page for browsing events by date
- **Edit Habit Sheet** — edit existing habits without leaving the app
- **Edit Event Sheet** — edit existing events without leaving the app
- **Progress input** — inline numeric progress logging on habit cards
- **Settings** — timezone, week start day, and deadline surface days.
- **Database-backed storage** — habits, completions, events, and settings all persist in the app database.

### Changed

- Today view overhauled with timed sections (morning, afternoon, evening, night) and all-day section
- Add Item Sheet redesigned with full habit and event creation flows
- Habit and event cards rebuilt with completion toggles and progress display
- Bottom navigation replaced sidebar; Schedule and Weekly views removed

### Removed

- Schedule page
- Weekly page
