# Rise — Android app

Rise is the native Android version of Routine, built with Expo (React Native). Everything is stored on the
phone in SQLite. No server, no account, no internet needed.

## What's different from the web app

| | Web app (repo root) | Android app (`mobile/`) |
|---|---|---|
| Data | Neon Postgres | SQLite on the phone |
| Health data | Webhook from a sender app | Read directly from Health Connect |
| Access control | Device allow-list + unlock page | None needed (it's your phone) |
| Backups | Neon dashboard | Export / restore a JSON file from Settings |

The habit and scheduling logic (`src/lib/habit-logic.ts`, `src/lib/services/*`) is a straight port of
the web app's `lib/habit-logic.ts` and `app/actions/*`, so behaviour should match.

## Run it

You need **JDK 17** and the **Android SDK** (easiest: install Android Studio, then create an
emulator in Device Manager, or plug in a phone with USB debugging on).

```bash
cd mobile
npm install
npm run android        # builds the native app and opens it on the emulator/phone
```

After the first build, `npm start` is enough for code changes. The native app reloads JS
instantly. Rebuild with `npm run android` only after adding a package with native code or
editing `app.json`.

Health Connect doesn't work in Expo Go. Always use the build from `npm run android`.

## Move your data over from the web app

1. On the laptop, in the repo root (needs `DATABASE_URL` in `.env.local`):
   ```bash
   npm run db:export-mobile
   ```
   This writes `routine-backup-<date>.json` (git-ignored, since it's personal data).
2. Copy the file to the phone (Drive, email, USB).
3. In the app: **Settings → Backup & restore → Restore from file**.

## Health Connect

**Settings → Health Connect → Connect** asks for read access to steps, distance, sleep and active
calories. Any habit with progress tracking and a *Health Connect source* gets filled in
automatically. The app syncs the last 7 days on launch, whenever it comes back to the foreground,
and on pull-to-refresh on Today.

## Checks

```bash
npm run typecheck
npm run lint
npx expo-doctor
```

## Differences from the web app

- Logging time: long-press a card (the web app uses a swipe).
- Theme adds a **System** option that follows the phone; the choice is saved on the phone only and isn't part of backups.
- Steps come from Health Connect's de-duplicated total, so recent days can differ slightly from what the webhook recorded.
