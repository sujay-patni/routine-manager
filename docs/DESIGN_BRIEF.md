# Routine Manager — Design Brief

A complete inventory of what the app does and how it currently looks, intended as a starting brief for a designer (working with Claude's design / prompt-based tooling) who will be redesigning the product end-to-end.

---

## 1. Product overview

### What it is

**Routine** is a personal daily-system app for tracking habits, scheduled events, all-day tasks, and deadlines — backed by the user's own Notion workspace. The name shown everywhere in the app is "Routine". The tagline is "Your daily system".

It is installed as a Progressive Web App and is designed primarily for mobile, with a desktop layout on larger screens.

### Who it's for

- A **single user** (one person's data, gated by a passphrase)
- Someone who already uses Notion and wants their habit/routine data to live in their workspace rather than a proprietary silo
- Mobile-first: most use happens on a phone, during the day

### Core jobs-to-be-done

1. **Plan my day** — "What am I supposed to do today, grouped by when?"
2. **Check things off as they happen** — fast, one-tap completion
3. **Track numeric progress** — log steps, minutes, calories, etc. toward a target
4. **See deadlines coming up** — surface deadlines some number of days before they're due
5. **Look at my week / month** — zoom out to see patterns and upcoming commitments
6. **Add / edit / pause items** — manage the routine itself

### Platform

- Progressive Web App (installable, standalone mode, portrait orientation)
- Mobile-first responsive design (breakpoint at `lg` / 1024px switches layout)
- Passphrase authentication, rate-limited
- Offline-ish: data lives in Notion, all reads and writes hit Notion's API via server actions. Not currently offline-first, but snappy because writes are optimistic

---

## 2. How to use this document

**Scope of redesign: full product redesign.** The designer is not constrained to restyling — they may propose:

- New feature ideas, or removing features that don't earn their weight
- Different information architecture (page structure, navigation)
- Different interaction patterns (e.g., replacing sheets with drawers, rethinking the calendar)
- A completely different visual language

Treat the current design documented below as **reference, not spec**. The goal is to communicate (a) what the app does today and (b) what the current design looks like, so the designer can make informed decisions about what to preserve, what to keep as inspiration, and what to throw out.

**For each screen or overlay in this doc:**

- Content is written so that a single section can be pasted into Claude as the standalone context for designing that one screen.
- `[screenshot: <name>]` placeholders mark where to attach a screenshot of the current UI before sharing with the designer. These are important — the text description is a map, the screenshot is the territory.

---

## 3. Data model (user-facing)

The user works with four kinds of items. They are distinct in the UI but some share fields.

### 3.1 Habit

A repeating thing the user wants to do.

- **Name** (required)
- **Description / notes** (optional)
- **Frequency** — one of:
  - `Daily` — every day
  - `Weekly (with target)` — some N days per week, doesn't matter which (e.g., "gym 3× per week")
  - `Specific days (weekly)` — fixed set, e.g., Mon / Wed / Fri
  - `Specific dates (monthly)` — e.g., 1st and 15th of each month
  - `Specific date (yearly)` — e.g., March 5 (supports multiple dates)
- **Timing** (optional) — how it's placed inside the day:
  - A **time of day**: Morning / Afternoon / Evening / Night / Any time
  - Or an **exact time**: e.g., `07:00`
  - If neither is set, the habit appears in the "All Day" section
- **Progress tracking** (optional) — for habits measured numerically rather than just toggled:
  - **Metric / unit** (e.g., "steps", "minutes")
  - **Target** (e.g., 10000)
  - **Start** (optional baseline, usually 0)
  - **Reset period**: Daily, Weekly (Mon–Sun), Monthly (1st of month), Yearly (Jan 1) — how long progress accumulates before resetting
- **Active / paused** — paused habits don't appear in Today
- **Sort order** — manual ordering within a time-of-day section

### 3.2 Event (timed)

Something that happens at a specific time on a specific date, with duration.

- **Title** (required)
- **Description / notes** (optional)
- **Date + start time** (required)
- **End time** (optional)
- **Recurrence** (optional): `No repeat`, `Daily`, `Weekly`, `Weekdays only`, `Specific days (weekly)`, `Monthly`, `Yearly`
- **Completed** (per occurrence)

### 3.3 Task (all-day)

Something you need to do on a particular day, but not at a particular time.

- **Title** (required)
- **Description / notes** (optional)
- **Date** (required)
- **Timing** (optional): time-of-day label OR an exact time
- **Recurrence** (optional): same options as Event
- **Completed**

### 3.4 Deadline

Something due by a particular date, where the user wants to be reminded in advance.

- **Title** (required)
- **Due date** (required)
- **Due time** (optional)
- **Start reminding me**: how many days before the due date to start surfacing this in Today
  - Options: 1 day / 2 / 3 / 5 / 1 week / 2 weeks / 1 month before
- **Recurrence** (optional): `No repeat`, `Weekly`, `Monthly`, `Yearly`
- **Completed**

### 3.5 Completion

A record that a habit was done (or a progress value was logged) on a given date. Not directly manipulated — it's a side effect of tapping the checkbox or logging progress.

### 3.6 Settings

- **Timezone** (IANA, e.g., `America/New_York`)
- **Week starts on**: Monday or Sunday
- **Show deadlines starting — days before due date** (0–30, default 3)

---

## 4. Page inventory

### 4.1 `/unlock` — Passphrase gate

**Purpose.** Keeps a single user's Notion-backed data private. First screen you hit if you aren't authenticated.

`[screenshot: unlock page]`

**Header.** None. It's a full-screen centered card/form.

**Content.**

- 🔐 lock emoji
- Title: **"Routine"**
- Subtitle: **"Enter your passphrase to continue"**
- Input field — type `password`, placeholder `••••••••••••`, auto-focused
- Primary button: **"Unlock"**
  - While submitting, label becomes **"Checking…"** and the button is disabled
- Inline error in red if the passphrase is wrong
- Rate-limit message if too many attempts: **"Too many attempts. Try again in X minute(s)."**

**Behavior.** Correct passphrase sets a signed HTTP-only cookie and redirects to the page the user was trying to reach (default `/today`).

---

### 4.2 `/today` — Daily hub

**Purpose.** The default landing page. Shows today's habits, events, tasks, and surfaced deadlines — grouped by time of day — with one-tap completion and quick access to add or edit.

`[screenshot: today page — default state]`
`[screenshot: today page — with habits completed]`
`[screenshot: today page — This Week expanded]`
`[screenshot: today page — empty state]`

**Header (sticky editorial, with backdrop blur).**

- **Left side — editorial date display:**
  - Tiny uppercase eyebrow: `TODAY` when on the current date, or the relative label (e.g. `Yesterday`)
  - Large Fraunces serif weekday name (44px, normal weight): e.g. `Thursday,`
  - Italic Fraunces serif month + day (32px, light weight, muted): e.g. `April 18`
- **Right side:**
  - `‹` / `›` chevron buttons — navigate one day back / forward
  - **Progress ring** — SVG circular gauge (46×46px) showing `done/total` in the center; arc fills with primary color as items complete
  - **"Go to today"** text link — only visible when not on the current date

**Main content.** Vertical stack, `max-w-2xl` centered, padded, with generous spacing between sections.

**Daily quote.** Below the header, an italic Fraunces serif quote in muted color: *"Small things, daily, become large things."*

**Empty state** (no items at all for this day):

- 🌟 emoji
- Heading: **"Build your routine"**
- Subheading: **"Add habits, tasks, and events to get started."**

**Section headers.** Each time-of-day section has a two-part eyebrow row:
- Left: uppercase tiny label with emoji (e.g. `🌅 MORNING`)
- Right: time range in small muted text (e.g. `4 AM – 12 PM`)

**Section: 🗓 All Day** (renders at the top if non-empty).
Habits and events without a specific time.

**Section: 🌅 Morning · 4 AM – 12 PM.**
**Section: ☀️ Afternoon · 12 PM – 4 PM.**
**Section: 🌆 Evening · 4 PM – 8 PM.**
**Section: 🌙 Night · 8 PM – 4 AM.**

Each time-of-day section renders only if it has items. Within each section, items sort by:

1. Incomplete before complete
2. Untimed before timed (exact-time items come last within the section)
3. Exact time ascending, or manual sort order for untimed

**Section: "WEEKLY GOALS MET ✓"** — eyebrow heading, collects habits that have hit their weekly target. Shows only when there's at least one.

**Section: "THIS WEEK"** — collapsible. Tapping the header (with an animated chevron) toggles open/closed.

When expanded, shows a week grid:

- 7 columns, one per day of the week (respects week-start setting)
- Column headers show single-letter day labels
- Rows are habits, grouped by time of day (Morning / Afternoon / Evening / Night / All Day sub-headers inside the table)
- Each cell is either empty (muted background) or filled (primary background with a white checkmark) to indicate that day's completion
- Each habit row has a thin progress bar underneath showing `X/Y` toward the weekly target

**Floating Action Button (FAB).** Fixed bottom-right. Circular, 56×56, primary color, `+` icon.

- Tap: expands into a dropdown with 4 items. The `+` icon rotates 45° to become `×`.
  - 💪 Habit
  - 📅 Event
  - 📋 Task
  - ⏰ Deadline
- Picking any item opens the **AddItemSheet** (see §5.1) pre-selected to that tab.
- On mobile, the FAB floats above the bottom nav.

**Actions available on this page.**

- Tap checkbox on a habit card — toggle complete / incomplete
- Tap `+` on a progress-tracked habit — log progress (inline editor)
- Tap pencil icon on any item — open the edit sheet
- Tap `‹` / `›` — navigate by day
- Tap the date label — open native date picker
- Tap "Go to today" — jump back to the current date
- Tap the "This Week" header — expand / collapse the grid
- Tap FAB — open add-item menu

---

### 4.3 `/calendar` — Calendar views

**Purpose.** Browsing events across time. Five view modes.

`[screenshot: calendar — month view]`
`[screenshot: calendar — week view]`
`[screenshot: calendar — day view]`
`[screenshot: calendar — year view]`
`[screenshot: calendar — schedule view]`
`[screenshot: calendar — month view day detail sheet]`

**Header (sticky).**

- **Left cluster:**
  - `‹` / `›` chevron buttons — navigate by period (hidden in Schedule view)
  - **Month name** in Fraunces serif (22px, normal weight), with the year as an uppercase eyebrow below it
- **Right cluster:**
  - **View segmented control** — inline pill with three options: `Month` / `Week` / `Schedule`. Active segment has a white background and shadow; inactive is muted text.
  - **Add** — a `+` button (rotates to `×` when open) that opens a dropdown identical to the FAB: Habit / Event / Task / Deadline, opens the AddItemSheet on the corresponding tab. In month view, if the user has a day selected, the date is pre-filled.

**View: Month (default).**

- 7-column grid (Mon–Sun or Sun–Sat per setting), one row per week, typically 5–6 rows
- Each cell shows:
  - Date number (in a small circle, highlighted if today)
  - Up to 2 event chips (colored by event type), with `+N more` if more
- Tap a day cell — opens a bottom sheet with that day's full event list + quick-add buttons:
  - 📅 + Event / 📋 + Task / ⏰ + Deadline (3 columns)
  - List of events below, each tappable to edit
- Tap an event chip — opens EditEventSheet

**View: Week.**

- 7 columns, one per day. Header row shows day abbreviation + date number (today highlighted).
- All-day strip above the time grid if any all-day events
- 24-hour vertical time grid with hour labels down the left
- Timed events render as colored blocks positioned by start time, sized by duration (minimum height ≈ 30px so they stay tappable)
- Red horizontal "now" line on today's column
- Tap empty grid space — opens AddItemSheet on the Event tab with date pre-filled
- Tap an event block — opens EditEventSheet

**View: Day.**

- Same as week, but showing a single day full-width

**View: Year.**

- 3×4 grid of 12 tiny month calendars
- Each mini-month shows a 7-col grid of days; days with events get a dot, today is highlighted
- Tap a month — switches to Month view focused on that month

**View: Schedule.**

- Running list, grouped by date
- Each group header: Fraunces serif weekday name (18px) + uppercase `MMMM D` date label in muted text
- Each entry is a compact card: type icon + title + timing + color dot
- Scope: from today forward through a rolling horizon (currently "through June 30")
- Empty state: **"No upcoming events through June 30."**

---

### 4.4 `/settings` — Preferences & habit management

**Purpose.** User preferences, pausing/reordering habits, and links into the Notion workspace for data export.

`[screenshot: settings page]`
`[screenshot: settings page — habits section with reorder buttons]`

**Header (sticky).** Title: **"Settings"** in Fraunces serif (28px, normal weight).

**Info banner (conditional).** If the Notion Settings DB isn't configured, an amber/yellow tip banner appears at the top explaining how to add the `NOTION_SETTINGS_DB_ID` env var so preferences can persist in-app.

**Section: PREFERENCES** (eyebrow heading).

All preference rows use a two-column layout: label left, control right.

- **Timezone** — standard dropdown of common IANA zones
- **Theme** — inline segmented control: `Light` / `Dark`. Applies immediately and persists to `localStorage`. The preference is also read before first paint to prevent flash.
- **Week starts on** — inline segmented control: `Monday` / `Sunday`
- **Show deadlines** — stepper control with `−` and `+` buttons; current value shown between them; help text below: *"A deadline with '3 days' will appear in your Today view starting 3 days before it's due."*
- Primary button: **"Save preferences"**
  - While saving: **"Saving…"**
  - After save: briefly shows **"Saved ✓"**

**Section: HABITS** (eyebrow heading).

- Header row with an **"+ Add habit"** button (small, outline style) — opens AddItemSheet on the Habit tab
- Habits listed grouped by time-of-day (Morning / Afternoon / Evening / Night / All Day) — same grouping as Today
- For each habit:
  - **Reorder controls** — ↑ and ↓ buttons, disabled at top/bottom
  - **Name** (semibold)
  - **Frequency summary** — e.g., "Daily", "3× per week", "Mon · Wed · Fri", "Monthly"
  - **Metric** (if progress tracking) — e.g., "10000 steps"
  - **"paused"** badge if inactive
  - **"Edit"** button (outline) — opens EditHabitSheet
  - **"Pause"** / **"Resume"** toggle button
- Empty state: **"No habits yet. Add your first one!"**

**Section: DATA & EXPORT** (eyebrow heading).

- Short paragraph of muted body text
- **ExternalLink rows** — full-width bordered buttons: emoji + label (flex) + `↗` arrow. One per Notion database:
  - 📋 **"Open Habits in Notion"**
  - 📅 **"Open Events in Notion"**
- Fallback text if URLs unavailable: **"Open notion.so and find your Routine databases."**

**Footer.** Centered muted text: *"Powered by Notion"*, separated by a top border.

---

## 5. Overlays & sheets

All overlays render as **bottom sheets** on mobile (`< lg`) and **centered dialogs** on desktop (`≥ lg`). Sheets have:
- A **grab handle** — centered pill (38px wide, 4px tall, `bg-border`) at the very top
- **Title** in Fraunces serif (22px, normal weight)
- Rounded top corners (`rounded-t-3xl`), dismissed by tapping outside or a close `×` button
- `max-h-[90vh]` with internal scrolling

Dialogs cap at `max-w-lg` and `max-h-[85vh]`.

### 5.1 AddItemSheet

**Trigger.** FAB on Today, `+` button on Calendar header, "Add habit" button on Settings. The sheet opens pre-focused on the tab that matches how it was triggered.

**Title.** **"Add to your routine"**

**Tabs (4, equal width).** Habit · Event · Task · Deadline.

`[screenshot: AddItemSheet — Habit tab]`
`[screenshot: AddItemSheet — Event tab]`
`[screenshot: AddItemSheet — Task tab]`
`[screenshot: AddItemSheet — Deadline tab]`

#### Habit tab

Fields, in order:

1. **Name** — text input, placeholder "e.g. Morning run"
2. **Progress tracking** — a row with label + a small round toggle button (`+` to enable, `−` to disable)
   - When enabled, reveals a sub-panel:
     - 3-column grid: **Start** (number, min 0, default 0), **Target** (number, min 1, e.g. 10000), **Unit** (text, e.g. "steps")
     - **Reset period** dropdown: Daily / Weekly (Mon–Sun) / Monthly (1st of month) / Yearly (Jan 1)
3. **Frequency** — dropdown: Daily / Weekly (with target) / Specific days (weekly) / Specific dates (monthly) / Specific date (yearly)
   - "Weekly (with target)" is hidden if progress tracking is on (because the target concepts conflict)
4. **Weekly target (days)** — number 1–7 — shown only when frequency = Weekly
5. **Which days?** — 7 toggle chips (Mon–Sun) — shown only when frequency = Specific days (weekly)
6. **Which dates of the month?** — grid of 31 toggle chips — shown only when frequency = Specific dates (monthly)
7. **Which date(s) each year?** — month dropdown + day number, with a `+` button to add more and `×` to remove — shown only when frequency = Specific date (yearly)
8. **Timing** — with a toggle link "Use exact time" ↔ "Use time of day"
   - Time-of-day mode: dropdown (Any time / Morning / Afternoon / Evening / Night)
   - Exact-time mode: time input (HH:MM)
9. **Description** — textarea, placeholder "Any notes…"

Primary button: **"Add Habit"** (full width). While submitting: **"Adding…"**.

#### Event tab (timed)

1. **Title** — placeholder "e.g. Team standup"
2. **Date & Start time** — two columns, both required
3. **End time** — optional
4. **Repeat** — dropdown: No repeat / Daily / Weekly / Weekdays only / Specific days (weekly) / Monthly / Yearly. Specific-days reveals a day-picker strip.
5. **Notes** — textarea, placeholder "Any details…"

Primary button: **"Add Event"**.

#### Task tab (all-day)

1. **Task** — placeholder "e.g. Submit report"
2. **Date**
3. **Timing** — same toggle as habits (time-of-day vs exact time)
4. **Repeat** — same options as Event
5. **Notes**

Primary button: **"Add Task"**.

#### Deadline tab

1. **What's the deadline?** — placeholder "e.g. File taxes"
2. **Due date**
3. **Due time** — optional
4. **Start reminding me** — dropdown: 1 day / 2 / 3 / 5 / 1 week / 2 weeks / 1 month before
5. **Repeat** — No repeat / Weekly / Monthly / Yearly
6. **Notes**

Primary button: **"Add Deadline"**.

---

### 5.2 EditHabitSheet

`[screenshot: EditHabitSheet]`

- Title: **"Edit Habit"**
- Same fields as the Add → Habit tab, pre-filled with the habit's current values
- Two buttons at the bottom:
  - **"Save changes"** (primary)
  - **"Delete habit"** (secondary / destructive text button)
    - First tap changes label to **"Tap again to confirm delete"**
    - Second tap deletes

---

### 5.3 EditEventSheet

`[screenshot: EditEventSheet — timed event]`
`[screenshot: EditEventSheet — task]`
`[screenshot: EditEventSheet — deadline]`

- Title reflects the item type: **"📅 Edit Event"**, **"📋 Edit Task"**, or **"⏰ Edit Deadline"**
- Fields depend on the type (see the matching AddItemSheet tab)
- Delete behavior:
  - **Non-recurring**: single **"Delete event"** button → confirm-again pattern
  - **Recurring**: two buttons — **"Delete just this occurrence"** and **"Delete series"**

---

### 5.4 Day detail sheet (from calendar month view)

`[screenshot: day detail sheet]`

- Triggered by tapping a day cell in Month view
- Header: full date heading (e.g., "Thursday, April 17")
- 3-column quick-add row: **📅 + Event** / **📋 + Task** / **⏰ + Deadline** — tapping pre-fills the date in AddItemSheet
- List of that day's events below; tap any event to open EditEventSheet

---

## 6. Component catalog

### 6.1 HabitCard

`[screenshot: HabitCard — default]`
`[screenshot: HabitCard — done]`
`[screenshot: HabitCard — with progress tracking, in progress]`
`[screenshot: HabitCard — with progress tracking, done]`
`[screenshot: HabitCard — progress inline editor open]`

**Structure (horizontal, single row + optional progress block):**

- **Circular checkbox** on the left — 2px border, `rounded-full`
  - Unchecked: gray border, subtle hover darken
  - Checked: filled green, white checkmark inside
  - Disabled while a request is pending
- **Habit name** (semibold, small) — strikethrough + dimmed when done
  - Inline time appears after the name for exact-time habits (e.g., "· 9:00 AM")
  - For weekly-target habits, a second line shows e.g. "3/5 this week"
- **Status badges** (optional): `optional`, `week done ✓`
- **Edit (pencil) icon button** — low-opacity, lights up on hover
- **Progress tracking cluster** (only for progress habits):
  - If not complete: a `+` circle button to open the inline editor; progress bar + label underneath ("500 / 10000 steps today")
  - If complete: a green check circle; progress bar in emerald; label "Done ✓"
  - Inline editor (when open): a number input pre-filled with today's contribution + a unit label + cancel (`×`) and save (`✓`) buttons, separated by a thin border from the card content

**Card styling.** `rounded-2xl`, `p-4`, subtle border, very subtle shadow, `bg-card`.

**Overall state styling.** Done state → opacity ~65%, title strikethrough. Urgent (e.g. habit that needs action) → orange border tint.

---

### 6.2 EventCard

`[screenshot: EventCard — timed event]`
`[screenshot: EventCard — task]`
`[screenshot: EventCard — deadline upcoming]`
`[screenshot: EventCard — deadline due today]`
`[screenshot: EventCard — deadline overdue]`
`[screenshot: EventCard — completed]`

**Structure.**

- Circular checkbox (same visual language as HabitCard)
- Leading emoji to identify type: 📅 (timed event), 📋 (task), 🔴 (overdue deadline), ⏰ (upcoming deadline)
- **Title** — semibold, strikethrough when completed, with a `↺` marker if it's a recurring occurrence
- **Timing subtitle** (muted, small):
  - Timed: "9:00 AM – 10:30 AM"
  - All-day: "Morning", "All day", or exact time
  - Deadline: "Due today" / "Due in X days" / "Overdue by X days"
- **Status badges**: `overdue` (red), `due today` (orange)
- **Edit (pencil) icon** button

**Card styling.** Same as HabitCard. Semantic variants:

- Overdue deadline → red tint border + background wash
- Due today → orange tint border
- Completed → ~50% opacity

---

### 6.3 Sidebar (desktop only, `≥ lg`)

`[screenshot: sidebar]`

- Fixed left, full height, `w-56` (224px), border-right
- **Top:** app name "Routine" (bold) + tagline "Your daily system" (muted)
- **Middle (nav):** three items, each an emoji + label in a pill-shaped row
  - ☀️ Today
  - 📆 Calendar
  - ⚙️ Settings
  - Active: light blue background + accent text color
  - Inactive: muted foreground, hover raises to `bg-muted`
- **Bottom (footer):** small muted text **"Powered by Notion"**

---

### 6.4 BottomNav (mobile only, `< lg`)

`[screenshot: bottom nav]`

- Fixed bottom, full width, frosted/blurred background (`bg-background/95 backdrop-blur`)
- Respects device safe area (notches)
- 3 equal columns — icon stacked above label
  - ☀️ Today / 📆 Calendar / ⚙️ Settings
- Active state: primary color + semibold label; inactive: muted

---

### 6.5 Floating Action Button (FAB)

`[screenshot: FAB closed]`
`[screenshot: FAB open with menu]`

- Circular, 56×56, primary-filled, bottom-right
- Mobile: floats above the bottom nav
- `+` icon that rotates 45° to `×` when the menu is open
- Open state reveals a card-like dropdown of 4 rows: 💪 Habit / 📅 Event / 📋 Task / ⏰ Deadline

### 6.6 Progress bar

- Very thin (6px, `h-1.5`)
- Muted track, primary-filled fill
- Turns emerald when the habit hits its target
- `rounded-full`

### 6.7 Badges

- Pill-shaped (`rounded-4xl`), `px-2 py-0.5`, `text-xs`
- Variants used in-app:
  - Neutral / "optional" — light gray
  - Success / "week done ✓" — emerald
  - Warning / "due today" — orange
  - Destructive / "overdue" — red
  - "paused" — light gray, shown in Settings

### 6.8 Day-of-week / date chips (used in forms)

- `px-2.5 py-1.5`, `text-xs`, `rounded-lg`
- Selected: primary-filled
- Unselected: outline with muted text

### 6.9 Week grid table (on Today, "This Week" section)

`[screenshot: week grid]`

- Header row: day initials (M, T, W, …) respecting week-start setting
- Body rows: habits, grouped into time-of-day sub-header rows (🌅 Morning, etc.)
- Cell: empty muted square, or primary-filled square with a white checkmark
- Beneath each habit row, a thin progress bar shows total completions toward the week's target

---

## 7. Interaction flows

### 7.1 Completing a habit / event / task

1. User taps the circular checkbox on a card.
2. It immediately fills green with a white checkmark (optimistic).
3. Title gets strikethrough + dimmed.
4. A server action writes to Notion in the background. Toggles use Next.js `after()` so the UI isn't blocked waiting on Notion.
5. Weekly counts in the "This Week" grid and the header progress indicator update.
6. If the habit hit its weekly target, it moves into the "Weekly goals met ✓" section.

### 7.2 Logging numeric progress (progress-tracked habits)

1. User taps the `+` button on the card.
2. An inline editor appears below the card header (the card grows taller — no modal).
3. Input is pre-filled with **today's contribution** (not the total).
4. User types a new value and presses Enter / taps ✓ (or taps `×` to cancel).
5. Progress bar and "X / target unit" label update optimistically.
6. Once the total crosses the target, the `+` becomes a green check circle and the label flips to "Done ✓".

### 7.3 Adding an item

1. Tap FAB (or `+` on calendar, or "Add habit" in settings).
2. Menu appears; pick Habit / Event / Task / Deadline.
3. AddItemSheet opens on that tab. On mobile it's a bottom sheet; on desktop it's a centered dialog.
4. Fill required fields; conditional fields appear as needed (e.g., "Which days?" only after choosing Specific days).
5. Tap the bottom primary button ("Add Habit" / "Add Event" / etc.).
6. Sheet closes; the new item appears in the list optimistically.

### 7.4 Editing and deleting

1. Tap the pencil icon on a card → Edit sheet opens, pre-filled.
2. Modify any fields; "Save changes" (primary).
3. Delete uses a **tap-again-to-confirm** pattern: first tap shows "Tap again to confirm delete", second tap actually deletes.
4. For recurring events, delete shows two buttons instead of one: "Delete just this occurrence" vs "Delete series".

### 7.5 Date navigation (Today page)

- `‹` / `›` arrows jump one day back / forward.
- Tapping the date label triggers a hidden native `<input type="date">` — opens the OS date picker.
- "Go to today" link shows only when the currently-viewed date isn't today.
- Navigation is URL-driven: `?date=YYYY-MM-DD` search param, so dates are bookmarkable / shareable.

### 7.6 Reordering habits (Settings)

- Each habit row in Settings has ↑ and ↓ arrow buttons.
- Buttons are disabled at the top / bottom of the group.
- Reordering happens within a time-of-day group (you can't move a Morning habit into Evening from this UI — you'd edit the habit's timing instead).
- Behind the scenes, order is stored as a `sort_order` number spaced by 10.

### 7.7 Unlock / session

- The unlock page is the only pre-auth page. All others redirect to `/unlock?from=<path>` if no valid session cookie.
- Rate limited per IP — after N failed attempts, a wait message appears.

---

## 8. Current design system

### 8.1 Design philosophy

The UI is **editorial and calm** — quiet on most surfaces so that the typography carries the identity:

- Generous whitespace; content breathes
- Fraunces serif headlines give dates and screen titles a distinct, warm personality; all body text stays in Geist Sans
- Few hard borders; hierarchy comes from color, weight, and very subtle elevation
- Emoji used deliberately for warmth (section headers, item types); SVG chevrons for navigation controls
- Motion is restrained — fades and small translates, no spring bounces or page transitions
- Primary color is a single bright blue; semantic colors (green, orange, red) appear only where they carry meaning
- Light and dark mode both supported, toggled from Settings; theme preference stored in `localStorage` and applied before first paint

The vibe is "a calm editorial daily tool" — closer to a well-designed notebook than a productivity dashboard.

### 8.2 Color tokens (OKLCH, from `app/globals.css`)

**Light mode (`:root`)**

| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(1 0 0)` | Page background (pure white) |
| `--foreground` | `oklch(0.10 0.010 258)` | Primary text (near-black with subtle blue hint) |
| `--card` | `oklch(0.985 0.003 258)` | Card surface |
| `--popover` | `oklch(1 0 0)` | Dialog / sheet surface |
| `--primary` | `oklch(0.56 0.22 248)` | CTAs, active nav, progress fill |
| `--primary-foreground` | `oklch(1 0 0)` | Text on primary |
| `--secondary` | `oklch(0.94 0.005 258)` | Secondary surfaces |
| `--muted` | `oklch(0.94 0.004 258)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.47 0.008 258)` | Secondary text |
| `--accent` | `oklch(0.92 0.025 248)` | Subtle blue background (active nav) |
| `--accent-foreground` | `oklch(0.28 0.10 248)` | Blue accent text |
| `--destructive` | `oklch(0.56 0.22 25)` | Delete / error |
| `--border` | `oklch(0.88 0.004 258)` | Borders / input outlines |
| `--radius` | `0.5rem` | Base radius token |

**Dark mode (`.dark`)**

| Token | Value |
|---|---|
| `--background` | `oklch(0.08 0.006 258)` |
| `--foreground` | `oklch(0.96 0.002 0)` |
| `--card` | `oklch(0.12 0.008 258)` |
| `--primary` | `oklch(0.64 0.20 248)` |
| `--muted` | `oklch(0.18 0.008 258)` |
| `--border` | `oklch(1 0 0 / 8%)` |

**Semantic colors (used directly in components, not as CSS vars)**

- Success / completed → `bg-emerald-500`
- Due today → orange (`border-orange-200 / dark:border-orange-900`)
- Overdue → red (`bg-red-50/40` backdrop, red border)

**Chart palette (5 colors, for potential data viz)**

- `chart-1` blue, `chart-2` green, `chart-3` gold, `chart-4` red-orange, `chart-5` purple

### 8.3 Typography

- Primary font: **Geist** (sans), Google Fonts, via `--font-geist-sans`
- Monospace: Geist Mono (not commonly shown in UI)
- Base size: `text-sm` (0.875rem). Dense but legible.

Scale actually used:

| Role | Class | Weight |
|---|---|---|
| Page title | `text-lg` | `font-bold` + `tracking-tight` |
| Card title / section heading | `text-sm` | `font-semibold` |
| Body | `text-sm` | regular |
| Metadata / labels | `text-xs` | `font-medium` |

### 8.4 Spacing, radius, shadow

- Base radius: `--radius: 0.5rem`. Tailwind radius classes are multiples: `rounded-lg` (0.5), `rounded-xl` (0.7), `rounded-2xl` (0.9), `rounded-3xl` (1.2), `rounded-4xl` (1.5)
- Cards: `rounded-2xl`, padding `p-4`
- Dialogs: `rounded-xl`
- Sheets (mobile bottom): `rounded-t-3xl`
- Badges: pill-shaped `rounded-4xl`
- Shadows are very subtle:
  - `.card-elevated` → `0 1px 2px rgba(0,0,0,5%), 0 1px 3px rgba(0,0,0,3%)`
  - Dark mode doubles shadow opacity for depth

### 8.5 Iconography

- **Lucide** for UI controls (chevrons, close, check, pencil, arrows)
- **Emoji** for semantic labeling — time-of-day, item types, sidebar nav. Emoji aren't decorative; they earn their place as quick visual anchors.

### 8.6 Motion

- No heavy animation. Transitions are:
  - `transition-all` on cards / buttons for color & opacity changes
  - Sheet enter/exit: 200ms slide from bottom + fade
  - Dialog enter/exit: 200ms fade + zoom (95% → 100%)
  - Buttons: `active:scale-90` for a subtle press
  - FAB icon: 45° rotate transition when opening

---

## 9. Responsive & platform

### 9.1 Breakpoints

- Mobile: `< 1024px` (`lg`)
- Desktop: `≥ 1024px` (`lg:`)

### 9.2 Mobile layout

- Main content `max-w-2xl mx-auto`, padded `px-4 py-4`, with `pb-32` to clear the FAB + bottom nav
- Fixed bottom nav (3 tabs), respects safe-area insets
- Add / edit overlays are bottom sheets with rounded top corners, swipe-down dismiss
- Viewport is locked: `maximumScale: 1`, `userScalable: false` (prevents zoom on input focus)

### 9.3 Desktop layout

- Fixed left sidebar (`w-56`) replaces the bottom nav; main content shifts right with `lg:pl-56`
- Add / edit overlays become centered dialogs (`max-w-lg`)
- Hover states are more visible (the mobile UI still includes them but they're rarely seen)

### 9.4 PWA

From `public/manifest.json`:

```json
{
  "name": "Routine",
  "short_name": "Routine",
  "description": "Track your habits, schedule, and goals",
  "start_url": "/today",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6366f1",
  "orientation": "portrait"
}
```

- Installable to home screen on iOS/Android
- Opens in standalone (no browser chrome), portrait-locked
- Icons: `icon-192.png`, `icon-512.png` (both maskable)
- Theme color in status bar: `#6366f1` (indigo). Note this doesn't exactly match the in-app primary (`oklch(0.56 0.22 248)` is a slightly brighter blue) — worth unifying in a redesign.

---

## 10. States & edge cases

### 10.1 Empty states

| Where | Visual |
|---|---|
| Today with no items | 🌟 + "Build your routine" + "Add habits, tasks, and events to get started." |
| Calendar day with no events | "No events on this day." |
| Schedule view | "No upcoming events through June 30." |
| Settings habits list | "No habits yet. Add your first one!" |
| Settings without Notion configured | Amber tip banner explaining how to configure `NOTION_SETTINGS_DB_ID` |

### 10.2 Loading / pending

- Buttons swap text: "Add Habit" → "Adding…", "Save preferences" → "Saving…", "Unlock" → "Checking…", etc.
- Cards mid-request drop to ~70% opacity
- Toggles / checkboxes respond optimistically; if the server write fails, state reverts (no toast / banner currently — quietly reverts)

### 10.3 Errors

- Unlock page: inline red text under the input
- Rate-limited unlock: "Too many attempts. Try again in X minute(s)."
- There is no global toast system today. A redesign might introduce one.

### 10.4 Semantic styling for deadlines

- **Overdue**: red border + red background wash, red "overdue" badge, 🔴 prefix
- **Due today**: orange border, orange "due today" badge
- **Upcoming** (surfaced by N-day setting): neutral card, ⏰ prefix, subtitle like "Due in 3 days"

---

## 11. Open questions for the designer

Areas where the current design has obvious room to move, which the designer may want to rethink:

1. **First-run and onboarding.** The app has no onboarding — the user lands on an empty Today page after entering their passphrase. Is there a first-run experience worth adding?
2. **Overlay pattern.** Current UX uses a 4-tab AddItemSheet for habits/events/tasks/deadlines. Is one sheet with 4 tabs the right unification, or would separate flows be clearer?
3. **Calendar density.** The month view caps at 2 event chips per day with "+N more". Is that the right density? What about people with very full calendars?
4. **Progress tracking visuals.** Progress habits currently look almost identical to toggle habits (just with a `+` button instead of a checkbox). Should they feel more distinct?
5. **Week grid ergonomics.** The "This Week" table is functional but dense. What does a richer historical view look like — month heatmap? streaks? patterns?
6. **Theming.** There's a dark mode but no explicit toggle in-app — it follows system preference. Should users be able to choose?
7. **Widget-like surfacing.** Since this is a PWA, there's no native home-screen widget. Should the Today page itself be designed with glanceability in mind?
8. **Information hierarchy on Today.** 5 time-of-day sections + "Weekly goals met" + "This Week" is a lot of vertical scanning. Is there a more scannable layout?
9. **Brand & personality.** Currently "Routine" is a utilitarian name with a utilitarian tagline. Is there a stronger identity worth pursuing?
10. **Constraints to respect.** Notion is the backend — all items need to persist there. Single-user. PWA-first. Everything else is fair game.

---

## Appendix: Tech constraints the designer should know about (but not be limited by)

- **Backend:** Notion databases (Habits, Completions, Events, optional Settings). The user's data sovereignty is a feature — they can always open the Notion DB directly. A redesign shouldn't pretend the data lives somewhere else.
- **Single user.** No social features, no sharing, no multi-user concerns.
- **PWA, not native.** No OS-level widgets, notifications are limited (no rich push), no background sync.
- **Stack:** Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui + Base UI primitives. Any redesign can be implemented with these — but the designer shouldn't feel constrained to shadcn's look.
