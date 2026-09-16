<div align="center">

# Enhanced for Todoist

A different front end for Todoist. Todoist stays the backend; this replaces the
interface with one built around planning a week.

**Enhanced for Todoist is an independent project. It is not created by,
affiliated with, or supported by Todoist.**

[Open it](https://todoistenhanced.julesbertolino.fr) ·
[Features](#features) ·
[Changelog](CHANGELOG.md) ·
[Report a bug or an idea](https://tally.so/r/WOLkVN) ·
[Support me](https://buymeacoffee.com/julesbertolino)

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

> This is an independent project. It is not created by, affiliated with, or
> supported by Todoist, and it is not an official Todoist product. See
> [Disclaimer and trademarks](#disclaimer-and-trademarks).

## Try it without an account

It runs at **[todoistenhanced.julesbertolino.fr](https://todoistenhanced.julesbertolino.fr)**.
The connect screen has an "Explore with demo data" button. It loads a made-up
workspace so you can look around without a token. Nothing is sent anywhere.

---

## Features

[Planning a week rather than a day](#planning-a-week-rather-than-a-day) ·
[Estimates and workload](#estimates-and-workload) ·
[Daily and weekly review](#daily-and-weekly-review) ·
[Looking back](#looking-back) ·
[Logbook](#logbook) ·
[Adding tasks](#adding-tasks) ·
[Things to settle](#things-to-settle) ·
[Also included](#also-included)

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

### Daily and weekly review

A planning tool is only worth having if you look at it, and looking at
everything at once is what stops people. The review asks one question at a
time, in an order, with an end.

**The daily pass** takes a few minutes: what is late, your mail, what is
sitting in the Inbox, what you committed to this week without naming a day,
what has no estimate yet, and what today holds against the hours you have.
Mail comes before the Inbox because a good part of what is in the Inbox
arrived as an email — the app cannot see your mail, so it says what to do with
it and takes your word for it.

**The weekly pass** closes the week and then opens the next one. Closing: what
you finished — in a list you can order by date or by priority, with nothing
crossed out, because a review is no place to read your own week struck through
— then the same week in numbers, what is late, and which projects have gone
quiet. Opening: mail, the Inbox, a look back through Someday, what you are
committing to this week, the estimates that are missing, and finally what the
coming week weighs against the capacity you set. It used to end on Someday,
which is the longest list in the app and exactly where people stop.

You choose which week you are closing. Arrows step back, and it opens on the
week that has just ended while the new one is still young — a weekly review is
almost never done inside the week it is about.

Each step asks the question that step is actually about — a task is in the
Inbox because it has no project, so that step files it rather than dating it —
and pressing an answer makes exactly the change dragging the task there would
make. Estimates are typed into a list that holds still and saves in one go.
Any task in a review can be ticked off; sometimes the answer is that you
already did it.

It stores nothing of its own. There is no per-project review interval here,
because there is nowhere in Todoist to keep one, and a review that needs its
own hidden state is a review that breaks the promise the rest of this makes.

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

Type something like `Call Marc tomorrow at 9h p1 #Work @quick (25)`. The date,
the project, the priority, the tag and the estimate in brackets are highlighted
inside the field as you type, and each one fills in the field it belongs to
underneath, so the dialog can never be holding two different tasks at once.
Typing `@` or `#` opens the matching list. Subtasks can be typed in the same
dialog and are created along with the parent.

A repeat is read the same way: `Call Marc every monday`, `every 3 days`,
`every 1st wed`, `tous les jours de semaine`. The rule is handed to Todoist to
resolve rather than worked out here, including `every!`, which counts from the
day a task is completed instead of from the date it was due. The grammar
follows [the list Todoist
publishes](https://www.todoist.com/help/articles/introduction-to-recurring-due-dates-YUYVJJAV),
and anything outside it is refused rather than guessed at — a rule read wrongly
moves every future occurrence and says nothing about it. The rule can be edited
from the task panel afterwards, and giving a repeating task a single date moves
that occurrence without ending the series.

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
- Search (`⌘K`) across tasks, projects, tags and every view in the app, usable
  from the keyboard. Typing "settings" takes you to settings.
- Undo on the keyboard (`⌘Z`): a move, a completion, a deletion, a drop. A
  deleted task comes back with its subtasks.
- `⌘`-click picks out several tasks at once; a bar at the foot of the window
  gives the lot a date, a project, a tag or a priority — one request and one
  undo each — and Escape gives the selection back. A tag carried by only some
  of the selection shows as a half-tick, and clearing it takes the tag off all
  of them.
- A task's date can be typed from its row — "tomorrow", "next sunday", or a
  bare "15" for the next three fifteenths — or picked from a calendar.
- Where a task lives is typed from the same row: the move menu narrows on a
  project's name or a section's as you type, and a section is a destination in
  its own right. A project page leads with the tasks that are in no section.
- Projects nest by dragging them to the right in the sidebar, or onto a folder.
- Light, dark, or whichever the device is set to, following it when it
  changes. Ten accent colours, including one you pick yourself, each of them
  drawn in both schemes and checked for contrast rather than chosen by eye.
- A first run that asks three questions on one page — scheme, colour, density
  — and then points at four things in the app rather than describing them. It
  is remembered per Todoist account, so signing out and back in does not ask
  again, and it can be run again from settings.
- Markdown in descriptions, rendered in the list and in the task panel.
- Offline support: changes are queued and sent when you reconnect.
- English and French, and settings for the things people disagree about: which
  order a date is written in, whether Today has a page of its own beside My
  week, and what the "anytime this week" tag is called on your own board.

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

### Uploading a build

Upload the **whole** of `dist/`, `assets/` and the dotfile included. Every
other file sits at the root, which is deliberate: the icons used to live in
`dist/icons/`, that folder was dropped by an upload twice, and the second
failure left a directory on the server that could not be read into or
repaired by re-uploading. A manifest whose icons all 404 fails the browser's
installability check silently — the app looks and works perfectly, it simply
stops offering to install and the installed copy has no icon of its own.

Two things to check after an upload:

```bash
curl -o /dev/null -w '%{http_code}\n' https://<host>/icon-192.png   # 200
curl -o /dev/null -w '%{content_type}\n' https://<host>/manifest.webmanifest
```

The second should say `application/manifest+json`. It comes from `.htaccess`,
which ships in `dist/` — a dotfile, so a client set to hide them will skip it.

---

## Contributing

I built this for myself, so it is shaped around one person's habits. That is
the main thing it needs help with.

- If you have an idea, open an issue and describe how you plan your week. The
  most useful thing you can tell me is what you do that this app makes
  difficult.
- Bug reports are welcome, with or without a fix attached.
- No GitHub account, or would rather not open an issue? There is a short form:
  **[submit a bug or an idea](https://tally.so/r/WOLkVN)**. It is the same form
  the app links to from the user menu, and it reaches me just as well.
- Pull requests are open. The rules live in `src/domain` and depend on nothing
  else, so most behaviour can be changed without touching the interface.

If it saves you time, you can [buy me a
coffee](https://buymeacoffee.com/julesbertolino).

## Changelog

[CHANGELOG.md](CHANGELOG.md) lists what changed in each version. Each version
is also a [release](https://github.com/julesvbertolino/todoist-enhancements/releases)
with a ready-to-host build attached.

## Disclaimer and trademarks

Enhanced for Todoist is an independent project. **It is not created by,
affiliated with, or supported by Todoist.** It is not an official Todoist
product and it carries no endorsement.

"Todoist" is a trademark of Todoist Inc. Any reference to it here is descriptive,
to say what this connects to, and implies no association. The project is named
in the `x for Todoist` form that Todoist's
[brand usage guidelines](https://developer.todoist.com/api/v1/#section/Developing-with-Todoist/Brand-usage)
ask of third-party apps, and the same statement appears on the sign-in screen
and under Settings, About, inside the app itself.

The app's icon, name and interface are its own work. No Todoist logo, icon or
other brand asset is used or reproduced anywhere in this project.

This project uses the public Todoist API as any account holder may. It asks for
your own personal API token, stores it in your own browser, and sends it to
nobody but Todoist. It is provided as is, with no warranty, and it is not a
support channel for Todoist: if something is wrong with your account or with
Todoist itself, ask Todoist, not me.

If anyone at Todoist would like something here changed, open an issue and I will
change it.

## License

[MIT](LICENSE).
