# Enhanced for Todoist

An alternative, local-first client for Todoist. Todoist stays the source of
truth: every change made here is written back to it, and every change made in
Todoist is read back here.

This project is not created by, affiliated with, or supported by Doist. Todoist
is a trademark of Doist Inc.

> Try it without an account: the connect screen has an **Explore with demo
> data** button that loads a made-up workspace. Nothing is sent anywhere.

---

## What it does

### Planning a week, not a day

**My week** is the home view, and it is the reason the project exists. It
splits the week into the buckets you actually think in: *behind schedule*,
*quick*, *today*, *scheduled today*, and *anytime this week* — the tasks you
committed to but did not pin to a day.

**Upcoming** shows strictly future dates as day columns, four at a time, moved
through with arrows. **Someday** holds what is undated and uncommitted, and
**Inbox** what has not been filed yet.

### Estimates, and what they add up to

A task's estimate is stored as the Todoist label `est-<minutes>` — so it stays
on the task wherever you open it — and shown as a duration, never as a tag.
Everything else follows from that:

- a **load** figure on every page: how many tasks, how much time, what share of
  the capacity you set for that day or week;
- a parent's estimate **summed from its subtasks** when it has none of its own;
- a list of everything **still unestimated**, one keystroke from being filled in.

### Insights

A **Dashboard** of what a period actually looked like, and a **Logbook** of
what was finished in it. The dashboard adapts to the period you pick: a single
day shows the hours work happened in, a week adds the week's shape and a
day-by-day comparison against the week before, a year drops both and reads
month by month instead.

It carries the **focus score** — the share of completed work weighted by
priority, which answers whether the effort went to what mattered or to busy
work — plus completions per day, work by time of day, project and priority as
ring splits, and which tags you actually use.

### Things to settle

Contradictions inside a task that the app refuses to resolve on its own: a
task both dated and labelled for the week, two estimates on one task, a "quick"
task estimated at forty minutes, an estimate on both a parent and its children.
Each is shown with the choices that match the possible intents, and nothing
changes until you pick one.

### The rest

- **Display modes** — list, board and calendar — offered only where each makes
  sense, with grouping, sorting and filtering behind one Display control.
- **Drag and drop** with one fixed meaning per destination: today, anytime,
  someday, upcoming, a day column, a project, a section or a tag. Every drop
  can be undone.
- **Natural-language dates** while adding a task: *tomorrow*, *lundi*, *in 3
  days*, *10 sept*, *demain à 9h*. Switchable off in settings — `#project`,
  `p1` and `@tag` are explicit syntax and always apply.
- **Subtasks in the composer**, created with the parent in one round trip.
- **Search** (`⌘K`) over tasks, projects and tags, driven from the keyboard.
- **Markdown** in descriptions, rendered in the list and in the task panel.
- **English and French**, picked from the browser and changeable in settings.

---

## How it works

No server, no database, no account of its own. The browser talks to the Todoist
API directly, which its CORS policy allows. Everything else lives on the device:

| Concern | Where it lives |
| --- | --- |
| Todoist token | `localStorage`, on this device only |
| Mirror of your workspace | IndexedDB, refreshed by incremental sync |
| Preferences, filters, per-view settings | IndexedDB |
| Changes made offline | An IndexedDB outbox, replayed on reconnect |

Reads use the sync endpoint with a `sync_token`, so after the first load only
what changed is transferred. Writes go out as sync commands, applied
optimistically on screen and rolled back if Todoist refuses them. Polling runs
every 45 seconds while the tab is visible, and immediately on focus or when the
network returns.

Your token is never sent anywhere except to Todoist. There is nowhere else for
it to go — there is no backend.

## Tech

React 18, TypeScript and Vite. Zustand for state, `idb` for the IndexedDB
layer, `@dnd-kit` for drag and drop, `date-fns` for dates, and
`vite-plugin-pwa` so it installs as an app. No UI framework and no CSS
framework: the interface is plain CSS over one set of design tokens.

```
src/
  api/        auth, HTTP client, sync, command queue, completed-task history
  db/         IndexedDB cache, preferences and outbox
  domain/     the rules — estimates, dates, view buckets, load, conflicts,
              insights, natural-language dates, drop targets
  store/      application state and derived selectors
  i18n/       English and French dictionaries
  components/ shared interface pieces, chart marks and dialogs
  views/      one file per page
  styles/     tokens, then two layers over them
```

`src/domain` depends on nothing else, so the rules can be read and changed
without touching the interface. `src/domain/dnd.ts` is the one table that says
what each drop destination means, and both drag-and-drop and the row's move
menu read from it, so they can never disagree.

### Design system

One set of tokens in `src/styles/app.css` carries the whole interface: five
radii, eight type sizes, about thirty colours. Four warm reds do the brand
work, each with exactly one job — `--accent` paints a solid mark,
`--accent-tint` fills a quiet control, `--accent-wash` tints a surface,
`--accent-line` draws an outline. `theme.css` and `additions.css` layer over
that file and introduce no second system.

Charts share one categorical palette, assigned in a fixed order and never
cycled, so a colour always means the same entity. Priority keeps Todoist's own
four colours and every chart names each one in its legend, so the grey of P4
carries meaning without relying on its hue.

## Running it

```bash
npm install
npm run dev
```

Node 20 or newer — `.nvmrc` pins it, so `nvm use` is enough.

Then either press **Explore with demo data**, or paste a personal API token
from Todoist under Settings → Integrations → Developer.

```bash
npm run build      # a static site in dist/
npm run typecheck
```

The build is plain static files: any static host will serve it. `base` is `./`
and navigation uses URL hashes, so it also works from a subfolder with no
rewrite rules.

## If this is ever opened to other people

The one change required is authentication. A personal token cannot be shared,
so a multi-user version needs Todoist OAuth, which needs a server-side secret
and a refresh flow. That work is confined to `src/api/auth.ts`, which every
other module reaches through the `AuthProvider` interface.

## Changelog

[CHANGELOG.md](CHANGELOG.md) records what changed in each version.
