<div align="center">

# Enhanced for Todoist

**A different front end for the Todoist you already use.**

Todoist stays the backend. This is the interface, rebuilt around planning a
week instead of surviving a day.

[Try the demo](#try-it-without-an-account) · [Features](#what-it-does) ·
[Contributing](#help-make-it-better) · [Buy me a coffee](https://buymeacoffee.com/julesbertolino)

<!-- TODO: replace with a screenshot of My week -->
![Enhanced for Todoist — My week](docs/screenshot-my-week.png)

</div>

---

## Why

Todoist is a genuinely good product. But it plans a **day** at a time, and most
weeks do not arrive one day at a time. You commit to things this week without
knowing which afternoon they will land on. You want to know whether Thursday is
already full before you say yes to something else. You want to look back and
see where the week actually went.

So this is the same data, read differently. Every change here is written back
to Todoist, and everything it adds is stored in properties Todoist already has
— an estimate is a label, "anytime this week" is a label, the rest is projects,
sections, priorities and dates. Open the official app afterwards and nothing
looks strange. If this project disappeared tomorrow, your data would be
untouched, because it was never anywhere else.

> **Not affiliated with Doist.** This is an independent project. Todoist is a
> trademark of Doist Inc.

## Try it without an account

The connect screen has an **Explore with demo data** button. It loads a made-up
workspace so you can look around without a token. Nothing is sent anywhere.

---

## What it does

### Plan a week, not a day

**My week** splits the week into the buckets you actually think in: *behind
schedule*, *quick*, *today*, *scheduled today*, and *anytime this week* — the
work you committed to but did not pin to a particular day.

<!-- TODO: replace with a screenshot or gif of the My week buckets -->
![My week](docs/feature-my-week.png)

### Know what fits

Write how long a task takes. Every page then tells you how much is on it, how
much time that is, and what share of the capacity you set for that day or week.
A parent with no estimate of its own sums its subtasks, and anything still
unestimated is one list and one keystroke away.

<!-- TODO: replace with a screenshot of the load bar and the estimate field -->
![Estimates and load](docs/feature-estimates.png)

### See where the week went

A **dashboard** that changes with the period you ask for — a single day shows
the hours work happened in, a week adds the week's shape and a comparison
against the week before, a year reads month by month. Plus a **focus score**
that weights what you finished by its priority: the honest answer to whether
the effort went to what mattered or to busy work.

<!-- TODO: replace with a screenshot of the insights dashboard -->
![Insights](docs/feature-insights.png)

### A logbook worth reading

What you actually finished, grouped by day, filterable by several projects and
priorities at once. "What did I do last Thursday" takes one glance.

<!-- TODO: replace with a screenshot of the logbook -->
![Logbook](docs/feature-logbook.png)

### Add a task the way you talk

Type `Call Marc tomorrow at 9h p1 #Work @quick`. The date, the project, the
priority and the tag are marked inside the field as you type them, so nothing
is a surprise when you save. `@` and `#` open the matching list. Subtasks can
be typed right there and are created with the parent.

Natural-language dates can be switched off; `#project`, `p1` and `@tag` are
explicit syntax and always apply.

<!-- TODO: replace with a gif of typing a task with natural language -->
![Adding a task](docs/feature-add-task.png)

### Things to settle

Contradictions the app refuses to resolve on its own — a task both dated and
labelled for the week, two estimates on one task, a "quick" task estimated at
forty minutes. It shows the options and changes nothing until you pick one.

### And the rest

- **Upcoming, Someday, Inbox**, project pages and tag pages.
- **List, board and calendar** modes, with grouping, sorting and filtering
  behind one Display control.
- **Drag and drop** with one fixed meaning per destination, every drop undoable.
- **Search** (`⌘K`) across tasks, projects and tags, driven from the keyboard.
- **Markdown** in descriptions, rendered in the list and in the task panel.
- **Works offline** — changes queue and replay when you reconnect.
- **English and French.**

---

## Your data stays yours

No server, no database, no account of its own. The browser talks to the Todoist
API directly. Your token lives in your own browser and goes to exactly one
place: Todoist. There is nowhere else for it to go, because there is no
backend.

| Concern | Where it lives |
| --- | --- |
| Todoist token | `localStorage`, on this device only |
| Mirror of your workspace | IndexedDB, refreshed by incremental sync |
| Preferences and per-view settings | IndexedDB |
| Changes made offline | An IndexedDB outbox, replayed on reconnect |

## Built with

React 18, TypeScript and Vite. Zustand for state, `idb` for IndexedDB,
`@dnd-kit` for drag and drop, `date-fns` for dates, `vite-plugin-pwa` so it
installs as an app. No UI framework and no CSS framework.

```bash
npm install
npm run dev      # Node 20+, pinned in .nvmrc
npm run build    # a static site in dist/
```

---

## Help make it better

This started as a tool for one person, which means it is shaped by one
person's habits. **That is exactly what it needs help with.**

- **Have an idea?** [Open an issue](../../issues/new) and describe how you plan
  your week. The most useful thing you can tell me is what you do that this
  app makes awkward.
- **Found something broken?** Issues are welcome, with or without a fix
  attached.
- **Want to build it?** Pull requests are open. `src/domain` holds the rules
  and depends on nothing else, so most behaviour can be changed without
  touching the interface.

If it saves you time, you can
[buy me a coffee](https://buymeacoffee.com/julesbertolino). Entirely optional,
genuinely appreciated.

## Changelog

[CHANGELOG.md](CHANGELOG.md) records what changed in each version.
