# Reddit post draft — r/todoist

Paste-ready. Reddit renders Markdown.
Screenshot slots are in square brackets, remove them when you post.

---

## Title

**This is what would make Todoist perfect for me**

---

## Post

I've used Todoist for years and I'm not leaving it. But there were a handful of
things I kept wishing for, so I built a front end for my own account using the
API. The important part, and the reason it's actually usable day to day: I
didn't invent any new concepts. Every feature here maps onto something Todoist
already has. Time estimates are labels like `@est-40`. "This week without a
specific day" is the `@week` label with no date. Quick wins are `@quick`.
Everything else runs on projects, sections, priorities, dates and deadlines as
they already exist. Todoist stays the source of truth, everything I do here
writes straight back, and if I stopped using this tomorrow my data would still
read perfectly fine in the normal app.

[screenshot: My week, the main view]

### The things I wished for

- Time estimates, written as `@est-40` for forty minutes or `@est-90` for an hour and a half. The label is never shown as a tag, it renders as "40 min" with a clock. You hover a task and type 25, or 1h15, or 90 min
- A load percentage on every view, so a page tells me if it actually fits. Grey under 80%, amber to 100%, red above
- Daily capacity I set per weekday. Mine is five hours, because a working day isn't eight hours of tasks
- Estimates that roll up, so a parent with no estimate shows the sum of its subtasks
- A count of unestimated tasks that's clickable, giving me just those tasks with one small field each so I can fill a whole page in twenty seconds
- "Anytime this week", meaning `@week` with no date. Work I've committed to this week but haven't pinned to a day. Todoist gives me today and it gives me a backlog, with nothing in between
- A quick section that catches anything under five minutes or labelled `@quick`, in its own callout
- A behind-schedule callout with one button to move everything to today
- A real backlog view, `@week`-less and dateless, with no percentage because a backlog has no deadline to measure against

[screenshot: the Anytime this week section and the load line]

### Things it refuses to do for me

- It never silently fixes my data. A sidebar badge collects contradictions and asks rather than guesses
- The contradictions it catches: two estimate labels on one task, an estimate that isn't a number, a date and `@week` at the same time, a `@quick` task estimated at 25 minutes, a parent and its subtasks both estimated
- Each one is offered with the two or three choices that match what I might have meant. Remove the label or remove the date. Keep 45 minutes or keep an hour
- Tasks with no estimate live in a separate tab that isn't called errors, because a missing estimate isn't a mistake

[screenshot: the conflicts panel]

### Interface changes

- Today is gone as a standalone view. The home view is My week, holding today plus the undated `@week` work
- Today is ordered the way I work through a day: late, then quick, then untimed, then timed last because those are appointments
- One rule sorts everything, and a real date always beats `@week`
- Dragging does exactly one thing per destination. Today sets today's date and removes `@week`. Anytime clears the date and adds `@week`. Someday clears both. A day column sets that date. A tag adds itself without touching the others
- Everything is undoable from the bar that appears after
- The same destinations exist as a plain menu on each row, because dragging on a phone is miserable
- List, board and calendar per page rather than globally, with the board only where sections exist
- One Display button for presentation, grouping, sorting and filters, filters as real checkboxes
- Every setting remembered per view, because a client project isn't looked at the way a week is
- Descriptions render their Markdown, so bold is bold and lists are lists. Project and section descriptions are editable too
- Subtasks open by default, and a parent plus its subtasks stay one card on a board
- Projects and tags in their own Todoist colours everywhere
- Karma rank in the sidebar with a bar to the next one
- Add a task straight into a section from that section
- Confirmations inside the app, no browser popups
- French and English

[screenshot: the Display panel]

### The stats side

- Built on the same idea as a smaller thing I made a while back, Todoist Rewind
- Completed tasks over any period from today to a year
- Which hours of the day I actually finish things
- Breakdowns by project and by priority
- Estimate coverage, and how much estimated time is still sitting in the backlog
- A focus score that weighs each finished task by its priority. A week on P1s reads 100, a week on P4s reads 25. Blunt, but it answers whether I did the work that mattered or the work that was easy
- A logbook grouped by day, with filters

[screenshot: insights]

### How it runs

- No server, no database, no account. The browser talks to the Todoist API directly, which their CORS setup allows, including the sync endpoint
- My token is entered once and stays on my device. Everything else sits in IndexedDB
- Reads use a sync token, so after the first load only what changed comes down
- Writes go out as sync commands and show immediately, rolling back if Todoist refuses them
- Offline, changes queue and go out when I'm back
- It installs as a PWA
- There's a demo mode with a made up account and a year of invented history, so you can click through everything without handing over a token

### What I'd like to hear

- Does the label trick for estimates bother anyone? I still go back and forth on whether I should have fought harder to make native duration work
- Is five hours a sane daily default, or is that just me and my particular brand of optimism?
- What would you put in "anytime this week" that I haven't thought of? That one changed how I plan more than anything else here

Happy to answer anything about the API side. The sync layer took longer than the
whole interface did.

---

## Before you post

- **Check Doist's trademark and developer terms.** The name mustn't suggest an official product. Leading with your own name is safer than "Enhancements for Todoist".
- Read the subreddit sidebar the day you post. Self-promotion rules expect substance over a bare link, which this has, but rules move.
- Post it as a gallery. This kind of post lives or dies on the first image, so lead with My week full of colour and a load percentage sitting in the amber band.
- Weekday morning US time gives the widest window.
- If you cross-post to r/productivity, cut the interface and how-it-runs lists. That audience wants the idea, not the controls.
