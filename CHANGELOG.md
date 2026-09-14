# Changelog

Every notable change to Enhancements for Todoist, newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

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
