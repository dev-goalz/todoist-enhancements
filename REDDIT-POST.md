I redesigned Todoist the way I think it should look

Two disclaimers before anything else, because that title is deliberately provocative and I'd rather set expectations myself.

First, the design isn't refined. I haven't done the design pass at all. What you're looking at is structure, logic and behaviour running against real data, with the visual side sitting somewhere between a proof of concept and a very detailed wireframe. It's a base, not a finished look.

Second, and more importantly: I'm not claiming Doist should ship any of this. I'm one person building for exactly one user, which is an absurdly easy problem compared to theirs. They're supporting millions of people with completely different ways of working, across a dozen platforms, without breaking anyone's existing setup, while staying simple enough that a newcomer isn't frightened off on day one. Half of what's below would be wrong for most of their users. I get to be opinionated precisely because I don't carry any of that.

With that said, here's what I'd want.

Todoist has a genuinely great design, and I've built my whole system around it over the years ([here's how I use it](https://www.reddit.com/r/todoist/comments/1fit8rq/i_created_the_perfect_todoist_workflow_for_me/)). A while back I started playing with their API for a small side thing that reworked the logbook ([post here](https://www.reddit.com/r/todoist/comments/1wak3s3/todoists_logbook_finally_got_the_update_it_needed/)), and once you've spent a weekend inside someone's API you start having opinions. Eventually I thought: why not just build myself the interface I keep wishing for?

So that's what this is. A different front end for my own Todoist account. Not a replacement, not a competitor. Everything still lives in Todoist, everything I do here is written straight back through the API, and the official apps keep working exactly as before. The only thing that changes is what I'm looking at.

## What's in it

- Time estimates. This is the thing I wanted most and the reason the rest exists. An estimate is a label, `@est-40` for forty minutes, `@est-90` for an hour and a half. It never shows up as a tag, it renders as "40 min" with a small clock. You hover a task, type 25 or 1h15 or 90 min, and it sorts out the format. I did try the native duration field first, but duration is really about putting a task in a time slot, and most of my work isn't scheduled, it just takes a while.

- A load percentage on every view. Once tasks have estimates, every page can tell you whether it actually fits. The header reads how many tasks, how much time that adds up to, and what share of your capacity that is. Grey under 80%, amber up to 100, red above. My old failure mode was looking at nine tasks, thinking "that's a normal Tuesday", and discovering at six in the evening that nine tasks was six hours of work.

- Capacity you set per weekday. Mine is five hours, not eight, because a working day isn't eight hours of tasks and pretending otherwise is how my weeks kept breaking. Yours might be three, or nine. The point is that the number is yours and everything measures against it.

- A shortcut for filling in estimates. The count of unestimated tasks is clickable. It gives you a list of exactly those tasks, one small field each, and you can tab straight down it. A page goes from half-filled to done in about twenty seconds. Without this I'd have abandoned the whole estimate habit inside a week.

- Anytime this week. Tasks carrying `@week` with no date at all. This is work I've committed to this week but deliberately haven't pinned to a day. Todoist gives you today, and it gives you a backlog, and there's nothing in between for the thing you know you'll get to by Friday. This section changed how I plan more than anything else here.

- My week replaces Today. The home view holds today plus that undated week work, and today is ordered the way I actually move through a day. Anything late first, in its own callout with a button to move it all forward. Then quick things. Then today's untimed tasks. Then today's timed ones last, because those are appointments rather than decisions.

- A quick section. Anything labelled `@quick` or estimated under five minutes gets collected together. There's a particular kind of afternoon where you have twenty minutes and no brain left, and this is the section for it.

- A place for contradictions, which never fixes them for you. A small badge collects tasks that argue with themselves. Two estimate labels on one task. A date and `@week` at the same time. A `@quick` task you've estimated at 25 minutes. A parent and its subtasks both estimated. Each one is shown with the two or three choices that match what you might have meant, and nothing changes until you pick one. An app that quietly tidies my data behind my back is an app I stop trusting about a week later.

- Tasks without estimates are listed separately, and that tab isn't called errors. A task without an estimate isn't wrong. It just isn't filled in yet, and the wording matters more than it sounds like it should.

- Dragging that means one specific thing per destination. Drop something on today and it gets today's date and loses `@week`. Drop it on anytime and it loses the date and gains the label. Drop it on someday and it loses both. Drop it on a tag and it gains that tag without disturbing the others. Everything is undoable from the bar that appears afterwards, and because dragging on a phone is genuinely unpleasant, every task also has a plain menu with the same destinations.

- View settings that are remembered per page. The way I look at a client project has nothing to do with how I look at my week, so list, board, calendar, grouping, sorting and filters are all stored per view rather than globally. It's behind one Display button, with filters as real checkboxes so you can see what's switched on.

- Descriptions that render their Markdown. Bold is bold, lists are lists, links are links. Editing shows you the source, reading shows you the result. Project and section descriptions are editable too, which I kept expecting to exist already.

- A stats side, grown out of the logbook project linked up top. Completed tasks over any period, which hours of the day you actually finish things, breakdowns by project and priority, and a focus score that weighs each finished task by its priority. A week spent on P1s reads 100, a week spent on P4s reads 25. It's a blunt measure and I like it for that, because it answers whether I did the work that mattered or the work that was easy.

- Smaller things that add up. Subtasks open by default. Projects and tags in their own Todoist colours everywhere. Karma rank in the sidebar. Adding a task straight into a section. Confirmations inside the app instead of browser popups. It installs as a PWA and works offline. French and English.

## Why it's actually compatible

This is the part I think matters most, and the reason I'd trust it with my own account.

Every single feature translates to something that already exists in Todoist's back end. Nothing here is stored in a private database that only my version understands. What decides whether a task sits in Someday or in Anytime this week is the `@week` label. Estimates are labels. Quick is a label. Everything else runs on projects, sections, priorities, dates and deadlines exactly as they already are.

Which means two things. The official apps keep working normally while I use this, because there's nothing for them to fail to understand. And if I dropped this front end tomorrow, my account would still make complete sense in Todoist. No migration, no export, no lock-in. The worst case is that I have some labels I no longer use.

On the technical side there's no server and no database. The browser talks to the Todoist API directly, your token stays on your device, and the local copy lives in the browser's own storage. Changes queue up when you're offline and go out when you're back.

There's a demo mode with a made up account and a year of invented history, so anyone can click through the whole thing without handing over a token.

## If you'd want this

I built it for myself, and right now it's just running on my machine. If enough people would actually use it, I'll do the design pass properly and put it somewhere public.

In the meantime I'd like to hear a few things. Does the label approach for estimates bother anyone, or does it seem reasonable? Is five hours a sane default daily capacity or is that just my particular brand of optimism? And what would you put in "anytime this week" that I haven't thought of?

Happy to answer anything about the API side too. The sync layer took me longer than the entire interface did.
