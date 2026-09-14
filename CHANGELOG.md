# Changelog

Every notable change to Enhancements for Todoist, newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-09-14

A second review pass: the app gets its own mark, the composer learns to read
prose, and Insights stops showing the same charts whatever you asked it.

### Added

- **Natural-language dates** in the composer — *tomorrow*, *lundi*, *in 3
  days*, *10 sept*, *demain à 9h* — shown back as a chip before the task is
  created, and switchable off in Settings. `#project`, `p1` and `@tag` are
  explicit syntax and always apply.
- **Subtasks in the composer**, sent with the parent in one batch so the tree
  can never half-exist.
- **Keyboard-driven search**: arrows move a cursor through the results, Enter
  opens the one under it, and the footer says so. The quick-add shortcut now
  prints itself on the Add task button.
- **Multi-select filters in the logbook** — several projects and several
  priorities at once, in a panel matching Display.
- **Paged day columns in Upcoming**, four at a time with arrows, so the page
  keeps one width.
- **An app mark of its own**, in the Todoist family rather than a copy of it.

### Changed

- **Insights follows the period it is given.** A single day shows the hours
  work happened in and no series of days; a week or a month adds the week's
  shape and a day-by-day comparison; a quarter reads by week and a year by
  month, both without the week card.
- Tags wear a tag, not a flag — in the sidebar, the composer, search, the task
  panel and the Display filters.
- The Insights button is white: a filled red one read as "you are here".
- The drag preview hangs off the pointer's left, so the cursor leads and the
  destination stays readable.
- The sidebar's disclosure caret ends its row, with the add button inside it.
- The Insights overview tab is named Dashboard, and the tab is part of the
  address, so the sidebar can link straight to the Logbook.
- The logbook's day headings carry a section heading's weight, and its ticks
  are squared like every other completion mark.
- The Display panel's estimate filter says Estimated / Unestimated.
- The README describes what the app does and what it is built from.

### Fixed

- Board columns wrapped onto a second row instead of scrolling sideways.
  Grouped by project or tag, most of the board had been off-screen with the
  visible columns cut in half.
- Cards sharing a row now share a height.
- The tag picker in the composer floats above the sheet instead of growing it,
  so choosing a tag no longer scrolls the fields out from under the pointer,
  and its rows are laid out again after the Display panel stopped using them.
- A project's description gets the header's full measure instead of a ribbon
  beside the buttons.
- The logbook's filter panel opened off the left edge of the page.
- "Anytime this week" no longer carries a sentence explaining its own heading,
  and a section that does have a description keeps it above the rule.

### Removed

- Calendar mode in Upcoming, which answered nothing the day columns did not.

## [0.2.0] — 2026-09-14

The design pass: the interface now follows a single design system taken from
the Figma file, and the analytics pages were rebuilt around it.

### Added

- **A ring split by project and by priority.** Part-to-whole is drawn as an arc
  with a legend that names every slice and states its value and share, so the
  reading never depends on telling two hues apart.
- **Period comparison.** Completions per day are drawn against the same day one
  period earlier — a bar for now, a dot for then, both on one axis. The history
  request was widened to cover both windows, so the comparison costs no extra
  round trip.
- **Tasks per day**, **time of day** as a graph rather than a heat strip, and a
  **tag ranking** that includes the untagged share.
- **A summary strip** on Insights: the share completed, then completed, active
  and streak, each with an icon beside the number.
- **A homepage setting.** The app opens on the view you pick. A link in the
  address bar still wins.
- **A way back to the default capacities** in My week.

### Changed

- **Tokens now carry the Figma palette** rather than an approximation of it:
  four warm reds each with one job — a solid mark, a quiet fill, a surface
  wash, an outline — a pink-warm sidebar, and a 10px control radius.
- **Controls follow the design system.** Navigation rows take the Figma pill,
  the search field its keycap, buttons gain the tint and outline variants, and
  Behind schedule becomes a flat wash instead of a framed box.
- **Every selector is drawn by the app.** The native control stays underneath
  for the keyboard and the mobile picker; only the face is ours.
- **Settings is one page you read downwards**, with a sticky menu that marks
  where you are and entries that are real anchors.
- **The focus score is one card everywhere** — heading, number, priority split —
  on the dashboard, in Insights and in the side panel.
- **The logbook matches the rest of the app**: designed filters, a tick in the
  colour of the priority it closed, day headings with counts.
- Chart marks are capped at 40px, so a seven-day chart draws data rather than
  seven card-wide blocks.

### Fixed

- The settings row-hint rule was unscoped and reformatted the text inside any
  control placed in a row, which broke every select on the page.
- The weekday labels in Settings were built from a Sunday, so the capacity grid
  and the week-start row both read one day early.
- The prototype's hard-coded ring is gone. Its hole literally printed `78%`
  whatever the data said, and it was fighting the real legend for the same
  class name.

### Removed

- The prototype's private bar chart, priority lines and heat strip. The shared
  chart components draw all of those now.

## [0.1.0] — 2026-09-14

First working build.

### Added

- **My week** as the home view: behind schedule, quick, today untimed, today
  timed, then the flexible "anytime this week" tasks.
- **Estimates** stored as the label `est-<minutes>`, shown as durations rather
  than tags, with load and capacity computed from them.
- **Upcoming**, **Someday**, **Inbox**, project pages and tag pages.
- **Display modes** — list, board, focus and calendar — offered only where each
  one makes sense.
- **Drag and drop** with one fixed meaning per destination, every drop undoable.
- **Insights**, in the spirit of Todoist Rewind, including the focus score.
- **Things to settle**: tasks missing an estimate, and conflicts inside a task
  that the app refuses to resolve silently.
- **Offline support**: an IndexedDB mirror refreshed by incremental sync, and an
  outbox replayed on reconnect.
- French and English, chosen from the browser and changeable in settings.
