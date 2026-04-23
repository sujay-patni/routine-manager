# Changelog

All notable changes to Routine Manager are documented here.

## [1.2] — 2026-04-23

### New Features

- **Habit & Event Detail Sheets** — Tapping a habit or event card opens a read-only detail view showing all metadata (frequency schedule, progress period, timing, description). An Edit button jumps directly to the edit form.
- **Dark / Light Theme** — Dark mode support with `localStorage` persistence and automatic system-preference detection on first launch. Toggle available in Settings.
- **Settings Context Provider** — App settings available globally via React context (`useSettings()`), eliminating redundant Notion fetches across pages.

### Improvements

- **Per-page Error Boundaries** — Today, Calendar, and Settings each have their own error UI with a retry button. Errors in one section no longer blank out the entire app.
- **UI & Design Polish** — Refined spacing, typography, and component layouts across Today, Calendar, and Settings. Sheet animation and bottom nav styling updated.

### Bug Fixes

- Fixed layout and state bugs in `TodayClient`
- Fixed card rendering issues in `HabitCard` and `EventCard`
- Fixed settings page fetch and display bugs in `SettingsClient` and `CalendarClient`

---

## [1.1] — 2026-04-17

### New Features

- **Progress period** (`daily` / `weekly` / `monthly` / `yearly`) per habit — progress resets at the end of each period; requires `Progress Period` (Select) field added to Notion Habits DB
- **Sort order** — ↑↓ reorder buttons in Settings; order persisted to Notion as `sort_order`; requires `Sort Order` (Number) field added to Notion Habits DB
- **Edit Habit Sheet** — full in-app editing (name, description, frequency, specific days/dates, timing, progress target + period)
- **Edit Event Sheet** — description field added
- **History navigation** — Today page accepts `?date=YYYY-MM-DD` query param to view any past date

### Improvements

- All Day section moved to the top of the Today page (above timed sections)
- Habit cards no longer show time-of-day label; only exact time shown (e.g. "9:00 AM")
- Progress bar shows period label ("this week", "this month", etc.)
- Add Item Sheet is scrollable on mobile (`max-h-[90vh]`)
- Settings habit list grouped by section and includes paused habits

### Removed

- Icon and color picker removed from habit creation; cards no longer show color border or icon

---

## [1.0] — 2026-04-15

### New Features

- **Calendar view** — dedicated calendar page for browsing events by date
- **Edit Habit Sheet** — edit existing habits without leaving the app
- **Edit Event Sheet** — edit existing events without leaving the app
- **Progress input** — inline numeric progress logging on habit cards
- **Settings** — timezone, week start day, and deadline surface days; stored in Notion Settings DB or env vars
- **Notion-backed storage** — habits, completions, events, and settings all backed by Notion databases

### Improvements

- Today view overhauled with timed sections (morning, afternoon, evening, night) and all-day section
- Add Item Sheet redesigned with full habit and event creation flows
- Habit and event cards rebuilt with completion toggles and progress display
- Bottom navigation replaced sidebar; Schedule and Weekly views removed

### Removed

- Schedule page
- Weekly page
