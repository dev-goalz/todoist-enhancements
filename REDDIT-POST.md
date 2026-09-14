I redesigned Todoist the way I think it should look

Todoist is honestly a very good product, with a clean design and enough functionality to tweak your setup the way you want it ([I shared my setup here earlier](https://www.reddit.com/r/todoist/comments/1fit8rq/i_created_the_perfect_todoist_workflow_for_me/)). But since I discovered how to use their API ([see my post about Rewind](https://www.reddit.com/r/todoist/comments/1wak3s3/todoists_logbook_finally_got_the_update_it_needed/)) I kept thinking: "why couldn't I code my own interface for Todoist, where they are the backend but the features and the design are built around my own needs?"

This is not a public product, though it could be, and it isn't a competitor to Todoist. It's a replacement for the interface you use. Everything gets translated to existing Todoist properties: estimates create a tag, anytime this week does the same, and the rest runs on projects, sections, priorities and dates as they already are.

I also owe you two disclaimers, because my title was deliberately provocative.

The design is pretty generic, since I haven't started doing mine yet. This should be seen as a proof of concept and advanced wireframing, not a final product.

The second one is that I know Todoist can't implement everything. They have user, technical and product constraints that are very different from the freedom I have as a random person building for exactly one user.

* **Task durations and load percentage.** They exist in Todoist, but only when you assign a start and an end time. Now I can write how long a task will take, and get a total for the day with a load percentage telling me whether I'm overplanning. It's transparent in the interface, but in Todoist it translates to a new tag like `est-40` for a forty-minute task.

* **This week and Someday views.** I replaced Today with a view called "My week" that shows the tasks of the day, then the tasks I can do anytime this week. Those have no date because they can be done at any moment, and they're tagged `@week`. Tasks with no date that don't need doing this week sit in the Someday view instead.

* **Behind schedule and quick callouts.** Late tasks get their own block at the top with a red background, so they carry real visual weight instead of being one red date in a list you scroll past. Quick tasks, meaning anything under five minutes, get a blue one. Those are the ones that clean the list: the quick wins you clear first, before the real work and the big tasks start.

* **Visible sub-tasks.** Sub-tasks are expanded by default and sit under their parent, including on a board where a parent and its children stay one card. In Todoist a parent hides its own work behind a chevron, and a task called "redo the home page" looks like one line until you open it and find six. Seeing them is also what makes the estimates honest, since a parent with no duration of its own just adds up its children.

* **A better insights panel.** Every page has an Insights button that summarises that page, not the whole account. How much is late and how long that represents, how far through you are, the split across priorities, what you finished this week, and how many tasks still have no estimate. Todoist's productivity view answers global questions, and most of my questions are about the thing in front of me.

* **A data dashboard and a cleaner logbook.** The dashboard is one board: today with its load, what needs attention, how the week ahead is filling up, and what's been finished lately. The logbook is grouped by day rather than being one long stream, with filters by project and priority, so "what did I actually do last Thursday" takes one glance. This is the part that grew out of Rewind, including the focus score that weighs what you finished by its priority.

* **Quality of life features.** Karma rank and progress in the sidebar, highlighting of potential conflicts in tags (for example a task with two different estimates, or one that's both dated and tagged `@week`), a button to see every unestimated task and fill them all in one pass, descriptions that render their Markdown, and per-view settings so a project doesn't have to be looked at the way a week is.

I built it for myself, and right now it's just running on my machine and as a web app. If enough people would actually use it, I'll consider doing the design pass properly and putting it somewhere public.

What do you think?
