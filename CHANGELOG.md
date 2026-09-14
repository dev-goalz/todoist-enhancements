# Changelog

Every notable change to Enhanced for Todoist, newest first.

## [0.7.0] — 2026-09-14

### Added

- **Sections can be reordered by dragging them**, tasks and all, into the seam
  between two others — the same seam that creates one.
- **Sections can be deleted**, with a confirmation that states how many tasks
  go with them.

### Changed

- The app wears Todoist's own icon.
- A project's title sits on top of its numbers: an empty description takes no
  room until the header is hovered, which cut the gap from 52px to 22.

## [0.6.0] — 2026-09-14

### Removed

- Section descriptions.

### Fixed

- A new section is created at the position you clicked, not at the bottom.
  It was given the same order as an existing one and left to a stable sort,
  which put it last; everything from the clicked position down now moves one
  place instead.
- A section's name field is sized from its own text rather than filling the
  row, so the duration and the count sit right after the name.

## [0.5.0] — 2026-09-14

### Changed

- The app wears Todoist's own mark.
- The README leads with the goal, then the features, with placeholders for
  screenshots; it links to the ways to help and to Buy me a coffee.
- A section heading's name, duration and count sit closer together, and its
  description is part of the same block.
- An empty description is offered under the pointer rather than stated at rest.

### Fixed

- Adding a section did nothing visible: an empty section was filtered out as
  noise and its heading was only drawn once it had a name, so the thing you
  had just created could be neither seen nor named. A real section now always
  renders, always carries its name field, and the field takes focus.
- Only one add-section seam appears between two sections.
- The white tick in the logbook was being repainted green by a broader rule.
- The tag pickers in the composer and the task panel opened below the fold of
  their own panel.

## [0.4.0] — 2026-09-14

### Added

- **Marks inside the task name.** What the parser will take out — a date, a
  `#project`, `p1`, an `@tag` — is highlighted in the name as it is typed, the
  way Todoist does it, instead of being listed underneath. Typing `@` or `#`
  opens the matching list.
- **Adding a section** from the seam between two of them: a rule appears under
  the pointer where the new section will land, and the name is typed in place.
- **Renaming a section** where it is read.

### Changed

- The tags page is a grid of cards. It had been borrowing the task row's grid,
  which gave every tag an empty checkbox column and an empty actions column.
- A completed task in the logbook is filled in its priority with a white tick,
  and its project keeps its own colour.
- Descriptions are secondary text, sit closer to the heading they belong to,
  and their "see more" is part of the text rather than a line of its own.
  Enter saves; Shift+Enter is a new line.
- My week accepts a drop and means "anytime this week". Upcoming no longer
  does: no single day can be inferred from it.
- The Add task button shows its plus again.

### Fixed

- **Drop targets in the sidebar silently stopped working** whenever the same
  destination existed on the page, and a favourite project shadowed its own row
  under the workspace. Two droppables cannot share an id; the sidebar's are
  scoped now.
- The drop hint was an outline, which the sidebar's own scroll container
  clipped on the left and right. It is an inset ring and a tint.
- Board columns were forced four across, squeezing each to 157px and leaving
  task titles unreadable. The board also keeps the same measure as every other
  view now.
- Collapsing a section only worked on the words themselves; the strip between
  them and the rule did nothing.
- The project description was a `<div>` inside a `<p>`, which is not legal.
- The sidebar's group carets and folder markers line up with the rows below.

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
