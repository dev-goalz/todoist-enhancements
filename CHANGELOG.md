# Changelog

What changed in each version, newest first.

## 0.8.1

### Changed

- A project's description is always visible as a single line. Hovering it
  opens a panel with the full text, where links can be clicked.

### Fixed

- The capacity grid in settings had lost its layout and its inputs ran off the
  page.
- Selects in settings could not shrink below their content.
- Page controls wrap under the title in a narrow column instead of overflowing.
- A chart with two dozen marks scrolls inside its own card.

## 0.8.0

### Added

- Sections can be reordered by dragging them, with their tasks, into the gap
  between two other sections. The gaps open up while a section is being
  dragged so they can actually be hit.
- Sections can be deleted. The confirmation says how many tasks go with the
  section.

### Changed

- The app uses Todoist's icon.
- A new build takes effect on the next reload. The service worker used to keep
  serving the old one until every tab had been closed, which made fixes look
  like they had not been applied.
- Calendar mode is removed from every view.
- Section descriptions are removed.
- A section's name field is sized to its own text instead of filling the row,
  so the duration and the count sit next to the name.
- A project with no description takes no vertical space until the header is
  hovered, which closed a 52px gap between the title and the figures below it.

### Fixed

- A new section is created where you clicked rather than at the bottom.
- Dragging a task onto Today also highlighted the Behind schedule and Quick
  sections, because sections offering the same destination shared one
  identifier.

## 0.7.0

### Fixed

- Drop targets in the sidebar stopped working whenever the page offered the
  same destination, because two drop targets cannot share an identifier. A
  favourite project also shadowed its own row under the workspace.
- The drop indicator was drawn outside the element, so the sidebar's scroll
  container cut off its left and right edges.
- Board columns were forced four across and squeezed to 157px, which left task
  titles unreadable. The board sizes its own columns again.
- Collapsing a section only worked on the heading text, not on the space
  between it and the rule underneath.
- The project description rendered a `div` inside a `p`.

## 0.6.0

### Added

- Dates are read from the task name as you type: `tomorrow`, `lundi`,
  `in 3 days`, `10 sept`, `demain à 9h`. What was recognised is highlighted in
  the field before the task is saved, and the whole thing can be switched off
  in settings. `#project`, `p1` and `@tag` always apply.
- Subtasks can be typed in the add-task dialog and are created with the parent.
- Search is usable from the keyboard: arrows move through the results, Enter
  opens one.
- Multi-select filters in the logbook.
- Upcoming shows four day columns at a time, with arrows to move between them.

### Changed

- The insights dashboard follows the period. A day shows the hours work
  happened in; a week or month adds the week's shape and a day-by-day
  comparison; a quarter reads by week and a year by month.
- Tags use a tag icon instead of a flag.
- The Insights button is white. Filled red read as a selected state.
- The drag preview sits beside the pointer so the cursor stays visible.
- The Insights overview tab is called Dashboard, and the tab is part of the URL.

### Fixed

- Board columns wrap onto a second row instead of running off the page.
  Grouped by project or tag, most of the board had been off-screen.
- Cards sharing a row share a height.
- The tag picker grew the dialog and scrolled the fields out of view.
- The project description was given the full width of the header.

## 0.5.0

### Added

- Project and priority shown as ring charts, tasks per day, time of day, a tag
  ranking, and a comparison against the previous period.
- A homepage setting.

### Changed

- The interface follows the design file: a warm red palette with one role per
  shade, a pink-tinted sidebar, and a 10px control radius.
- The sign-in screen matches the design, with the privacy note between the
  field and the button.
- The dashboard shows charts and figures only. The task list that used to sit
  in the middle of it belonged in a view.
- Settings is one page you scroll, with a menu that tracks your position.
- Every select is drawn by the app rather than by the operating system.

### Fixed

- Hover controls sat in the middle of a task row because the grid reserved a
  column that nothing filled.
- Dropping a task on Inbox, Upcoming or Someday did nothing.
- The estimate field in the task panel had no unit beside it.
- The repeat, flag, stack and group icons were drawn incorrectly.

## 0.1.0

First working version.

- My week as the home view, splitting the week into behind schedule, quick,
  today, scheduled today and anytime this week.
- Estimates stored as the label `est-<minutes>` and shown as durations, with
  workload and capacity calculated from them.
- Upcoming, Someday, Inbox, project pages and tag pages.
- List, board and focus modes.
- Drag and drop with one meaning per destination, every drop undoable.
- Insights, including the focus score.
- Things to settle: missing estimates, and contradictions inside a task.
- Offline support through an IndexedDB copy and an outbox.
- English and French.
