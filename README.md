<div align="center">

# Enhanced for Todoist

A different front end for Todoist. Todoist stays the backend; this replaces the
interface with one built around planning a week.

[Open it](https://todoistenhanced.julesbertolino.fr) · [Features](#features) ·
[Contributing](#contributing) · [License](#license) ·
[Buy me a coffee](https://buymeacoffee.com/julesbertolino)

![Enhanced for Todoist, My week view](docs/screenshot-my-week.png)

</div>

---

## Why I built it

Todoist is a good product, but it plans one day at a time. My weeks don't work
like that. I commit to things without knowing which afternoon they'll land on,
I want to see whether Thursday is already full before I agree to anything else,
and I want to look back at the end of the week and see where the time went.

This reads the same data differently. Every change is written back to Todoist.
Anything the app adds is stored in properties Todoist already has: an estimate
becomes a label, "anytime this week" becomes a label, and the rest is projects,
sections, priorities and dates. Open the official app afterwards and nothing
will look unusual. If this project stopped working tomorrow your data would be
unaffected, because it never lived anywhere else.

Not affiliated with Doist. Todoist is a trademark of Doist Inc.

## Try it without an account

It runs at **[todoistenhanced.julesbertolino.fr](https://todoistenhanced.julesbertolino.fr)**.
The connect screen has an "Explore with demo data" button. It loads a made-up
workspace so you can look around without a token. Nothing is sent anywhere.

---

## Features

### Planning a week rather than a day

My week splits the week into five buckets: behind schedule, quick, today,
scheduled today, and anytime this week. That last one holds the work you've
committed to without pinning it to a particular day, which is most of it.

![The My week buckets](docs/feature-my-week.gif)

### Estimates and workload

Write down how long a task will take. Each page then shows how many tasks are
on it, how much time that adds up to, and what proportion of the capacity you
set for that day or week. A parent task with no estimate of its own adds up its
subtasks. Anything still unestimated is listed in one place so you can fill
them in together.

![Estimates and the workload figure](docs/feature-estimates.gif)

### Looking back

The dashboard changes with the period you pick. A single day shows the hours
you finished things in. A week adds the shape of the week and a comparison
against the previous one. A year reads month by month. Arrows step back to
the week or month before, and either date can be edited to make your own
range.

It also carries a focus score, which weights what you finished by its priority.
It answers whether your effort went to the work that mattered or to everything
else.

![The insights dashboard](docs/feature-insights.gif)

### Logbook

What you actually finished, grouped by day, filterable by several projects and
priorities at once.

![The logbook](docs/feature-logbook.gif)

### Adding tasks

Type something like `Call Marc tomorrow at 9h p1 #Work @quick`. The date, the
project, the priority and the tag are highlighted inside the field as you type,
so you can see what will be picked up before you save. Typing `@` or `#` opens
the matching list. Subtasks can be typed in the same dialog and are created
along with the parent.

Reading dates from the text can be switched off in settings. `#project`, `p1`
and `@tag` are explicit syntax and always apply.

### Things to settle

Some contradictions can't be resolved automatically: a task that is both dated
and labelled for the week, a task carrying two estimates, a "quick" task
estimated at forty minutes. These are listed with the options that match each
possible intent, and nothing changes until you choose one.

### Also included

- Upcoming, Someday and Inbox views, plus project and tag pages. Tags can be
  dragged into your own order, which is also the order of the sidebar's
  favourites.
- List and board modes, with grouping, sorting and filtering behind a single
  Display control. A board with more columns than fit scrolls sideways.
- Drag and drop, where each destination has one fixed meaning and every drop
  can be undone.
- Search (`⌘K`) across tasks, projects and tags, usable from the keyboard.
- Markdown in descriptions, rendered in the list and in the task panel.
- Offline support: changes are queued and sent when you reconnect.
- English and French.

---

## Where your data goes

There is no server, no database and no account beyond your Todoist one. The
browser talks to the Todoist API directly. Your token is stored in your own
browser and is only ever sent to Todoist.

| What | Where it is stored |
| --- | --- |
| Todoist token | `localStorage`, on that device only |
| Copy of your workspace | IndexedDB, kept current by incremental sync |
| Preferences and per-view settings | IndexedDB |
| Changes made offline | An IndexedDB outbox, replayed on reconnect |

## Built with

React 18, TypeScript and Vite. Zustand for state, `idb` for IndexedDB,
`@dnd-kit` for drag and drop, `date-fns` for dates, and `vite-plugin-pwa` so it
can be installed as an app. No UI or CSS framework.

```bash
npm install
npm run dev      # Node 20+, pinned in .nvmrc
npm run build    # produces a static site in dist/
```

---

## Contributing

I built this for myself, so it is shaped around one person's habits. That is
the main thing it needs help with.

- If you have an idea, open an issue and describe how you plan your week. The
  most useful thing you can tell me is what you do that this app makes
  difficult.
- Bug reports are welcome, with or without a fix attached.
- Pull requests are open. The rules live in `src/domain` and depend on nothing
  else, so most behaviour can be changed without touching the interface.

If it saves you time, you can [buy me a
coffee](https://buymeacoffee.com/julesbertolino).

## Changelog

[CHANGELOG.md](CHANGELOG.md) lists what changed in each version. Each version
is also a [release](https://github.com/julesvbertolino/todoist-enhancements/releases)
with a ready-to-host build attached.

## License

[MIT](LICENSE). Not affiliated with Doist; Todoist is a trademark of Doist Inc.
