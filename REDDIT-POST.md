# Reddit post draft — r/todoist

Paste-ready. Reddit renders Markdown.
Screenshot slots are marked in square brackets, remove the brackets when you post.

---

## Title

**This is the Todoist design and the features I wish it had**

Alternatives, if that one feels too flat:

- This is the Todoist I wish existed, so I built the front end for it
- I made the Todoist interface I keep wishing for. Same data, different front end

---

## Post

I've used Todoist for years and I have no intention of leaving. It holds
everything, it syncs everywhere, and the API is genuinely pleasant. But there's
one question it has never been able to answer for me, and after a while I got
tired of working around it.

Here's the question. My Today view shows nine tasks. Nine sounds fine. Nine
sounds like a normal Tuesday. Then the day ends and four of them are still
sitting there, because those nine tasks were really six hours of work and I had
three.

Todoist knows what I said yes to. It doesn't know how much I said yes to.

So I built a different front end for it. Not a replacement. Todoist stays the
place where everything lives, and anything I change here gets written straight
back through the API. It runs in the browser, there's no server, and my data
never goes anywhere except between my laptop and Todoist.

[screenshot: My week, the main view]

### Time estimates, without waiting for Todoist to add them

An estimate is just a label. `est-40` means forty minutes. `est-90` means an
hour and a half. That's the whole thing.

I know the obvious question is why not use the native duration field. I tried.
Duration is tied to putting a task in a time slot, and most of my work isn't
scheduled, it just takes a while. Labels are free, they sync everywhere, and if
I ever stop using this front end my data is still readable in Todoist.

In the interface you never see the label. `est-40` shows up as "40 min" with a
little clock next to it. You hover a task, type 25 or 1h15 or 90 min, and it
normalises whatever you typed. If a task has subtasks with estimates and no
estimate of its own, it adds them up for you.

[screenshot: a task row with its estimate]

### Which means every page can tell you if it fits

Every view now has a line at the top: how many tasks, how much time that adds
up to, and what percentage of your capacity that is.

Capacity is something you set per weekday. Mine is five hours. Not eight,
because a working day isn't eight hours of tasks, and pretending it is was
exactly how my weeks kept breaking.

Under 80% it's grey. Between 80 and 100 it turns amber. Over 100 it goes red,
and I move something before the day starts instead of finding out at six in the
evening.

The number of unestimated tasks is a link. Click it and you get just those
tasks, one small field each, and you can tab down the list. A page goes from
half-filled to done in about twenty seconds, which was the only way I was ever
going to keep this habit up.

[screenshot: the fill-in-estimates dialog]

### Today is gone, and I don't miss it

The home view is My week now, and it holds two things.

The first is today, in the order I actually work through a day. Anything late,
in a red box with a button to move it all to today. Then quick things, meaning
anything under five minutes or labelled `quick`, in a blue box. Then today's
untimed tasks. Then today's timed ones, always last, because those are
appointments, not decisions.

The second is the part I'd been missing without being able to name it. Tasks
with a `week` label and no date at all. Work I've committed to this week but
deliberately haven't pinned to a day. Todoist gives you today, and it gives you
a backlog, and there's nothing in between for the thing you'll definitely get
to by Friday.

[screenshot: the Anytime this week section]

Around those two, Upcoming is strictly the future, fifteen days at a time.
Someday is the real backlog, no date and no `week` label, and it deliberately
shows no percentage because a backlog has no deadline to measure against.

One rule sorts all of it: a real date beats the `week` label. A task carrying
both lands under its date and gets flagged, which brings me to the bit I like
most.

### It never quietly fixes your data

There's a small badge in the sidebar that collects contradictions. Two estimate
labels on one task. An estimate that isn't a number. A date and a `week` label
at the same time. A task labelled `quick` that you've estimated at 25 minutes.
A parent and its subtasks both estimated.

None of it gets corrected automatically. Each one is shown with the two or
three choices that match what you might have meant, and nothing changes until
you pick. Remove the label, or remove the date. Keep 45 minutes, or keep an
hour.

An app that silently tidies my data behind my back is an app I stop trusting
about a week later, so I made a rule for myself early on that this thing never
guesses.

The second tab in there lists tasks with no estimate, and I was careful not to
call it errors. A task without an estimate isn't wrong. It's just not filled in
yet.

[screenshot: the conflicts panel]

### Moving things around

Dragging a task somewhere does one specific thing, and only one.

Drop it on today and it gets today's date and loses the `week` label. Drop it on
anytime this week and it loses its date and gains the label. Drop it on someday
and it loses both. Drop it on a day column in Upcoming and it gets that date. On
a project or section it moves. On a tag it gains that tag and keeps the others.

Everything can be undone from the little bar that appears afterwards. And
because dragging on a phone is miserable, every task also has a plain menu with
the same destinations.

### The rest of it

Views are per page rather than global, because the way I look at a client
project has nothing to do with how I look at my week. List everywhere, a board
where sections exist, a calendar for anything dated. All of it behind one
Display button, filters as real checkboxes so you can see what's on.

Descriptions render their Markdown, so bold is bold and lists are lists instead
of asterisks. Project and section descriptions are editable too.

There's an insights side, built on the same idea as a smaller thing I made a
while back called Todoist Rewind. Completed tasks over time, which hours of the
day you actually finish things, breakdowns by project and priority, and a focus
score that weighs each finished task by its priority. A week spent on P1s reads
100, a week spent on P4s reads 25. It's a blunt measure and I like it for that,
because it answers whether I did the work that mattered or just the work that
was easy.

[screenshot: insights]

Plus the small stuff that adds up. Subtasks open by default. Projects and tags
in their own colours everywhere. Karma rank in the sidebar. Add a task straight
into a section. Confirmations that live inside the app instead of browser
popups. French and English.

### How it works, for anyone curious

No server, no database, no account. The browser talks to the Todoist API
directly, which their CORS setup allows, including the sync endpoint. Your token
is entered once and stays on your device. Everything else sits in IndexedDB.

Reads use a sync token, so after the first load only what changed comes down.
Writes go out as sync commands and appear on screen immediately, rolling back if
Todoist refuses them. Offline, changes queue up and go out when you're back.

It installs as a PWA, so it works from the home screen and offline.

There's a demo mode on the login screen with a made up account and a year of
invented history, so you can click around the whole thing without handing over a
token.

### What I'd actually like to hear

Does the label trick for estimates bother anyone? I still go back and forth on
whether I should have fought harder to make native duration work.

Is five hours a sane default, or is that just me and my particular brand of
optimism?

And what would you put in "anytime this week" that I haven't thought of? That
section changed how I plan more than anything else here, and I suspect I'm only
using half of it.

Happy to answer anything about the API side. The sync layer took me longer than
the entire interface did.

---

## Before you post

- **Check Doist's trademark and developer terms.** The name mustn't suggest an official product. Something that leads with your own name is safer than "Enhancements for Todoist".
- Read the subreddit sidebar the day you post. Self-promotion rules there expect substance over a bare link, which this has, but the rules move.
- Post it as a gallery. This kind of post lives or dies on the first image, so lead with My week full of colour and a load percentage sitting in the amber band.
- Weekday morning US time gives the widest window.
- If you cross-post to r/productivity, cut the moving-things-around section and the technical one. That audience wants the idea, not the controls.
