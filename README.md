# Enhancements for Todoist

An alternative, local-first client for Todoist. Todoist stays the source of
truth: every change made here is written back to Todoist, and every change made
in Todoist is read back here.

This project is not affiliated with, endorsed by, or approved by Doist Inc.

## What it does

- **My week** as the home view: behind schedule, quick, today untimed, today
  timed, then the flexible "anytime this week" tasks.
- **Estimates** stored as the label `est-<minutes>`, shown as durations rather
  than tags, with load and capacity computed from them.
- **Upcoming**, **Someday**, **Inbox**, project pages and tag pages.
- **Display modes**: list, board, focus and calendar, offered only where each
  one makes sense.
- **Drag and drop** with one fixed meaning per destination: today, anytime,
  someday, a day column, a project, a section or a tag. Every drop can be undone.
- **Insights** in the spirit of Todoist Rewind, including the Focus score.
- **Things to settle**: tasks missing an estimate, and conflicts inside a task
  that the app refuses to resolve silently.
- French and English, chosen from the browser and changeable in settings.

## How it is put together

No server, no database, no application account. The browser talks to the
Todoist API directly, which its CORS policy allows. Everything else lives on
the device:

| Concern | Where it lives |
| --- | --- |
| Todoist token | `localStorage` on this device |
| Todoist mirror | IndexedDB, refreshed by incremental sync |
| Preferences, filters, per-view settings | IndexedDB |
| Changes made offline | An IndexedDB outbox, replayed on reconnect |

Reads use the sync endpoint with a `sync_token`, so after the first load only
what changed is transferred. Writes go out as sync commands, applied optimistically
on screen and rolled back if Todoist refuses them. Polling runs every 45 seconds
while the tab is visible, and immediately on focus or when the network returns.

### Layout

```
src/
  api/        auth, HTTP client, sync, command queue, completed-task history
  db/         IndexedDB cache, preferences and outbox
  domain/     the rules: estimates, dates, view buckets, load, conflicts, insights
  store/      application state and derived selectors
  i18n/       English and French dictionaries
  components/ shared interface pieces and dialogs
  views/      one file per page
```

The rules live in `src/domain` and depend on nothing else, so they can be read
and changed without touching the interface. `src/domain/dnd.ts` holds the one
table that says what each drop destination means.

## Running it

```bash
npm install
npm run dev
```

Requires Node 20 or newer. Open the app, then paste a personal API token from
Todoist under Settings, Integrations, Developer.

```bash
npm run build
```

The result is a static site in `dist/`.

## Deploying to Infomaniak

The build is plain static files, so it needs a web hosting plan and nothing
else. No database, no Node runtime, no server-side configuration.

1. Run `npm run build` locally.
2. Upload the **contents** of `dist/` to the folder your domain serves, for
   example `/web/` or a subdomain's root.
3. Open the site over HTTPS and connect your token.

Navigation uses URL hashes, so no rewrite rules are needed. `base` is set to
`./` in the Vite configuration, which means the same build also works from a
subfolder.

To install it as an app, open it in Safari or Chrome and choose Add to Home
Screen or Install.

## If this is ever published for other people

The single change required is authentication. A personal token cannot be shared,
so a multi-user version needs Todoist OAuth, and OAuth needs a server-side secret
and a refresh flow because access tokens issued to new applications expire after
an hour. That work is confined to `src/api/auth.ts`, which every other module
reaches through the `AuthProvider` interface.

Before publishing, check Todoist's trademark rules and developer terms.
