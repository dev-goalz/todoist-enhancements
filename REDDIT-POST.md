# Reddit post draft — r/todoist

Paste-ready Markdown. Reddit renders `#` headings, `**bold**`, lists and links.
Image placeholders are marked; on Reddit, upload them as a gallery post and drop
one per section, or post the first screenshot as the lead image.

---

## Title options

1. **I rebuilt the Todoist interface around time estimates and weekly capacity**
2. **My Todoist redesign: same data, an interface that tells me whether the week actually fits**
3. **I spent a while redesigning the Todoist UI around one question: does this week fit?**

*(Pick one. The first is the safest for r/todoist — it says what changed and why in one line.)*

---

## Post body

I have used Todoist for years and I am not trying to replace it. Todoist stays
the source of truth: every task, project, label and date still lives there, and
anything I change in my version is written straight back through the API.

What I wanted was a different **front end** — one that answers a question Todoist
doesn't ask: *does this week actually fit?*

So I built one. It runs entirely in the browser, talks to the Todoist API
directly, and stores nothing on a server. Screenshots and the reasoning behind
each piece below.

> Not affiliated with, endorsed by, or approved by Doist.

---

### The problem I kept hitting

My "Today" view would show nine tasks. Nine feels fine. Then the day would end
with four of them untouched, because those nine tasks were really six hours of
work and I had three.

Todoist knows *what* I committed to. It does not know *how much* I committed to.
Every fix I tried — durations, sub-projects, priority discipline — worked around
that instead of solving it.

---

### 1. Time estimates, stored as labels

**[screenshot: a task row showing "40 min" beside the title]**

An estimate is just a label: `est-40` means forty minutes. `est-90` means an
hour and a half. That is the whole convention.

Why a label and not Todoist's native duration? Because native duration is tied
to scheduling a time slot, and most of my work isn't scheduled — it just takes
a while. Labels are free, sync everywhere, and survive whatever I do next.

In the interface they never appear as tags. `est-40` renders as **40 min**, with
a clock icon, and the raw label is hidden. You edit it inline: hover a row, type
`25` or `1h15` or `90 min`, done.

If a parent task has an estimate, that wins. If it doesn't, the app sums its
subtasks and shows the total as a computed estimate.

---

### 2. Load and capacity

**[screenshot: page header showing "11 tasks · 5h 23 estimated · 72%"]**

Every page header now reads:

> 11 tasks · 5 h 23 estimated · **72 %** · 1 unestimated

The percentage is estimated time against capacity. I set capacity per weekday in
settings — five hours a day by default, because a working day is not eight hours
of tasks and pretending otherwise is how the week breaks.

Under 80 % is grey. 80 to 100 % is amber. Over 100 % is red, and I go and move
something before the day starts rather than discovering it at 6 pm.

The unestimated count is a **link**. Click it and you get a list of exactly the
tasks on that page with no estimate, one minute field each, tab down the list.
A page goes from half-estimated to fully estimated in about twenty seconds.

---

### 3. "My week" replaces Today

**[screenshot: My week, with its sections]**

The standalone Today view is gone. The home view is **My week**, and it holds
two things:

**Today**, in a fixed order that matches how I actually work through a day:

- **Behind schedule** — a red callout, with a "move all to today" button
- **Quick** — a blue callout, anything labelled `quick` or estimated under five minutes
- **Today** — dated today, no time set
- **Scheduled today** — dated today with a time, always last, because those are appointments not choices

**Anytime this week** — tasks carrying a `week` label and *no date*. This is the
part I missed most in stock Todoist: work I have committed to this week but
deliberately have not pinned to a day. Not "today", not "someday". This week.

**[screenshot: the Anytime this week section]**

---

### 4. The rest of the structure

- **Upcoming** — strictly future dates, fifteen days at a time, with a day-column board you can drag between
- **Someday** — no date and no `week` label. The genuine backlog. No capacity percentage here, because a backlog has no deadline to measure against
- **Inbox** — unchanged in spirit, just not the main character

One rule decides where everything lands, and it is never applied silently: a
real date beats the `week` label. A task carrying both appears under its date
*and* shows up as a conflict, which brings me to the part I am most pleased with.

---

### 5. Things to settle

**[screenshot: the conflicts dialog]**

A persistent badge in the sidebar, with two tabs.

**Conflicts** are contradictions inside a task itself:

- two `est-` labels on one task
- an `est-` label that isn't a number
- a date *and* a `week` label
- a `quick` task estimated at 25 minutes
- a parent and its subtasks both estimated

**Nothing is auto-corrected.** Each conflict is shown with the choices that
match the possible intents — "remove the label" or "remove the date" — and
nothing changes until I pick one. An app that quietly fixes my data is an app I
stop trusting.

**No time estimate** is the second tab, and it is deliberately *not* called
errors. A task without an estimate is not wrong, it is just not filled in yet.

---

### 6. One Display panel

**[screenshot: the Display panel open]**

Presentation, grouping, sorting and filtering live behind a single **Display**
button, the way Todoist already does it — list / board / calendar, then grouping
and sort, then filters as actual checkboxes so I can see what is on. Reset is at
the top in red. The button carries a count of whatever differs from the default,
so a filtered view never lies about being filtered.

Every setting is remembered **per view**. The way I look at a client project is
not the way I look at my week.

---

### 7. Views that make sense per page

**[screenshot: the board view of a project]**

- **List** everywhere
- **Board** where sections exist — moving a card between columns changes the Todoist section, and a parent plus its subtasks stay one card rather than scattering
- **Calendar** for anything dated

A project opens grouped by its own sections by default, because that is how the
work is already organised. "Scheduled and available" is still there as an
explicit choice.

---

### 8. Drag and drop with exactly one meaning per destination

Drop a task on:

| Destination | What happens |
| --- | --- |
| Today | today's date, `week` label removed, time of day kept |
| Anytime this week | date cleared, `week` added |
| Someday | date and `week` both cleared |
| A day column | that date |
| A project or section | moved there |
| A tag | tag added, others untouched |

Every drop is undoable from a toast. And because dragging is miserable on a
phone, each row also has a **Move to** menu with the same destinations, running
the same rules.

---

### 9. Insights

**[screenshot: the Insights overview]**

Built on the same idea as my earlier project, Todoist Rewind. Two tabs:

**Overview** — completed tasks, estimated time completed, Focus Score, active
days and streak, activity over time, estimate coverage, breakdown by project and
by priority, and a heat row showing which hours of the day I actually finish
things. Period selector from today to this year.

**Focus Score** is the one I care about: each completed task weighted by its
priority, against what the same count of P1s would score. A week spent entirely
on P1 reads 100. A week spent entirely on P4 reads 25. It answers whether the
effort went to priorities or to busy work.

**Logbook** — what was actually finished, grouped by day, with grouping and
filters.

---

### 10. Smaller things that add up

- **Descriptions render their Markdown.** Bold is bold, lists are lists, links are links. Editing shows the source, reading shows the result
- **Project and section descriptions are editable**, folded to two lines with "see more"
- Subtasks are expanded by default, and the disclosure chevron sits at the *end* of the row so it never interrupts the title
- Recurring tasks carry a small coloured marker matching their date
- Projects and tags render in their own Todoist colour, everywhere
- Karma rank in the sidebar with a progress bar to the next one
- Add a task straight into a section from that section
- Every confirmation is in-app, never a browser alert
- Full keyboard: ⌘K for search, Q for quick add
- French and English

---

### How it actually works

No server. No database. No account.

The browser talks to the Todoist API directly — their CORS policy allows it,
including the sync endpoint. A personal API token is entered once and stays in
`localStorage` on that device. The Todoist mirror, preferences and per-view
settings live in IndexedDB.

Reads use the sync endpoint with a `sync_token`, so after the first load only
what changed comes down. Writes go out as sync commands, applied optimistically
on screen and rolled back if Todoist refuses them. Offline, changes queue in an
outbox and replay when the network returns.

It's a PWA, so it installs to the home screen and works offline.

---

### Try it without connecting anything

There's a **demo mode** on the login screen: a made-up account with a year of
plausible history, so you can click through everything without handing over a
token. Nothing in demo mode reaches Todoist.

**[screenshot: demo mode]**

---

### What I'd like feedback on

1. Does the `est-<minutes>` label convention bother anyone? I keep wondering whether I should have fought harder to use native duration
2. Is five hours a sensible default daily capacity, or is that just me?
3. What would you put in "Anytime this week" that I haven't thought of?

Happy to answer anything about the API side — the sync layer took longer than
the entire interface.

---

## Notes before posting

- **Check Doist's trademark and developer terms first.** The rule of thumb is that the name must not suggest an official product. "Enhancements for Todoist" is borderline; something that leads with your own name is safer.
- r/todoist rules currently expect self-promotion to be substantive rather than a bare link. This post is, but read the sidebar the day you post.
- Post as a **gallery** with the screenshots in the order above. Posts in this style live or die on the first image, so lead with My week showing a full, colourful set of sections and a load percentage in the amber band.
- Post on a weekday morning US time for the widest window.
- If you cross-post to r/productivity, cut sections 6, 7 and 8 — that audience cares about the concept, not the controls.
