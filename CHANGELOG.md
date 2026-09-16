# Changelog

What changed in each version, newest first.

## 1.1.1

A round of fixes and small additions, all of them things that were reported
after 1.1 went out.

### Added

- **Today can have a page of its own.** My week still holds the whole week by
  default, because deciding what today is means seeing what the week still
  owes; a setting now separates the two for anyone who would rather keep a page
  for the day, either with today left out of the week or still inside it.
- **The tag that means "anytime this week" can be renamed.** Boards that
  already say `this_week` no longer have to be relabelled to be read here.
- **Undo, on the keyboard.** Cmd+Z (Ctrl+Z) reverses the last change — a move,
  a completion, a deletion, a drop — not only while its toast is on screen.
  A deleted task and its subtasks are written back; they return under new ids,
  which is the one thing Todoist gives no way to preserve.
- **Several tasks at once.** Cmd+click (Ctrl+click) picks rows out, and a bar
  at the foot of the window sends the lot to today, to this week, to Someday or
  to a date, or deletes them — one request, one undo.
- **Projects nest by dragging them to the right** in the sidebar, which is
  where the nesting the sidebar already drew was supposed to come from. The
  project menu moves one back out.
- **A date picker on the row.** The three shortcuts in a task's schedule menu
  answer most days and none of them answers "the 14th".
- **The composer reads two more things out of a name**: an estimate in
  brackets — "Call Anne (25)" — and a person with a plus, "+anne", on a shared
  project.

### Fixed

- **What the composer read out of a name never reached the fields below it.**
  Typing "Friday #Work p1" marked those words and left the date, project and
  priority pickers showing something else, so the dialog could hold two
  different tasks at once and only one of them was going to be created. The
  name and the fields are now one reading, made once.
- **"Show subtasks" did nothing.** The switch was drawn, stored and read by
  nobody.
- **Adding to the home screen on an iPhone gave a red tile with an E on it.**
  iOS does not read the web manifest; it needs its own icon, and now has one.
  The manifest also declares an identity and a full set of maskable icons, which
  is what a desktop browser wants before it offers to install anything.
- **A task ticked off vanished under the pointer**, which made a mis-click
  indistinguishable from a correct one. The tick lands, and the row leaves a
  beat later.
- **The "no estimate" tab of Things to settle could only be read.** It now
  holds the same batch editor the page header opens, instead of a weaker copy
  of it.
- **Things to settle was an icon with a dot on it**, equally quiet whether it
  held nothing or fourteen contradictions. It says so in words when there is
  something in it.
- Giving a task a date from a row or a column now takes the week tag off it, as
  dropping it on Today always did — the two together are the contradiction the
  app reports rather than resolves.

## 1.1.0

### Added

- **Daily and weekly review.** One question at a time, in an order, with an
  end. The daily pass asks what is late, what is sitting in the Inbox with no
  project, what you committed to this week without naming a day, what has no
  estimate, and what today holds. The weekly pass asks what you finished, what
  the week amounted to in numbers, what slipped, what is unfiled, what has no
  estimate, which projects have gone quiet, and what is parked in Someday.
  Every answer is a change Todoist already understands, made through the same
  rules a drag makes. The review stores nothing of its own.
- **Project actions**, the ones Todoist gives them, from the sidebar row and
  from the project's own page: add a project above or below, edit, favourite,
  duplicate, archive, delete. A project also renames from its own title.
- **Projects reorder by dragging** them in the sidebar, within their own list
  of siblings.
- **Tags can be created** — from the Tags page, or by typing a name after `@`
  that does not exist yet.
- **A density setting**, chosen by looking at two pictures rather than by
  reading two adjectives. Compact closes the space around a row without taking
  anything out of it: the same type, the same fields, a shorter page.
- **Browse**, a fifth destination on the phone, holding everything a phone has
  no room for: the profile and its menu, search, tags, favourites, projects.
  It is the sidebar rendered as a page, not a second list kept in step by hand.
- The app's **own date picker and own select**, everywhere a task is made or
  edited. No operating-system list opening inside a sheet this app drew.
- Filling in a page's missing estimates is **one pass and one request**: Tab
  walks the column, the foot counts what is filled and what it adds up to, and
  one button saves the lot.

### Fixed

- **Every toast in the product was invisible.** A leftover rule held them at
  zero opacity waiting for a class nothing ever added, so no error and no undo
  had ever reached anyone. This is why a refused change looked like a change
  that never registered the click.
- **Adding a task from the composer could create nothing at all.** Leaving the
  project picker alone sent an empty project id, which Todoist refuses. The
  Inbox was listed twice: once as that empty value, and once as the real
  project it already is.
- **A refusal is now reported rather than swallowed**, and the refused command
  is dropped instead of going out again on every sync for ever — where it also
  took everything queued behind it down with it.
- **A 403 is no longer read as a bad token.** Todoist also answers 403 when a
  command is against the rules of a plan, and reading that as an auth failure
  hid the real reason and signed people out over it.
- **A project nested under another project was never drawn** in the sidebar.
  Only folders disclosed their children.
- **A description with two links showed raw HTML.** The inline renderer ran
  emphasis over a string that already carried generated anchors, so the
  underscore in one `target="_blank"` paired with the next and tore both tags
  in half.
- The phone's navigation bar sat below the fold, behind the browser's own
  furniture and anything above it in the app. It is fixed to the window and
  padded for the phone's hardware.
- The "open navigation" button on a phone opened My week. The "hide sidebar"
  button did nothing at all; there is no column beside the app to hide.
- A new section or tag could appear twice: only tasks and projects had their
  placeholder cleared when the real record came back.

### Changed

- Tags carry their colour onto the task row.
- The user menu gained the feedback form and the coffee link, and closes when
  you click away from it.
- Insights reads a year of history four windows at a time instead of one after
  another.
- Sending a task to a destination is one method in one place, rather than the
  same fifteen lines written out wherever it was needed.

## 1.0.0

### Added

- The insights period can be stepped with arrows: this week, then the week
  before it. The presets are calendar units, so a week starts on the day the
  Todoist account does and the quarter is the calendar quarter. Either date
  can be edited to make a range of your own.
- Tags can be dragged into a new order on the Tags page. The order is
  Todoist's own, so the sidebar's favourites follow it.
- A board with more columns than fit scrolls sideways, with arrows above it.
- A link to the app unfurls with a title, a description and a picture of My
  week.
- An About section in settings, carrying the version, the statement that this
  is not an official Todoist product, and links to the site, the code, this
  changelog and the coffee.

### Changed

- The app is named "Enhanced for Todoist" everywhere, which is the form Todoist's
  brand guidelines ask of a third-party app, and every description of it now
  states that it is not created by, affiliated with, or supported by Todoist.
- The icon is the app's own: three capsules of different heights on one
  baseline, a week read as the load it carries. It replaces Todoist's mark,
  which a project that is not theirs had no business wearing. The browser and
  install colour is the app's own accent rather than Todoist's red.
- Installed on a phone, the icon has a full-bleed version of its own, so the
  system's mask no longer eats its rounded corners.
- A task tagged quick but estimated at more than five minutes is left out of
  the Quick group. The tag is a claim and the estimate is the fact.
- The add-task line at the end of a section takes no room until the section
  is hovered, and unfolds rather than appearing. Behind schedule and Quick no
  longer carry an empty band under their last row.
- On a project board, tasks outside any section are the first column.
- Tags are listed one per row.
- The logbook grouped by priority reads P1 first.
- Upcoming's board uses the same arrows as every other board.

### Fixed

- My week in board mode showed one column holding the whole week. It shows the
  same five buckets the list does.
- A profile photo in the sidebar kept its own square corners on top of the
  round frame, and a portrait that was not square was squashed into it.

### Removed

- Behind schedule no longer accepts drops. Dropping there dated the task
  today, which is not what the heading says.

## 0.9.0

### Changed

- The separate dashboard page is gone. Its charts are the Dashboard tab of the
  insights page, and an old `#/dashboard` link lands there.
- A board column shows its estimated time, how many of its tasks have no
  estimate and, for a day column, how full it is against that day's capacity.
- Board columns use the same width as the list.
- Tasks on a board are laid out as cards rather than as list rows.

### Added

- Dropping a task on the Quick group dates it today and adds the quick tag.

### Fixed

- The click a browser fires at the end of a drag no longer opens the task that
  was dropped.

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
