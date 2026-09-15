# Self-hosted server

A server that answers the part of the Todoist API v1 the app uses, so the app
can run against your own machine instead of Todoist's cloud. Data is kept in
SQLite by default, or in Postgres when `DATABASE_URL` is a `postgres://` URL.
Both run the same queries through Kysely, and the test suite passes on both.

## What it supports

| Call | Notes |
| --- | --- |
| `POST /api/v1/sync` (read) | `sync_token` `*` for everything, or the last token for changes since. |
| `POST /api/v1/sync` (commands) | `item_add`, `item_update`, `item_move`, `item_reorder`, `item_complete`, `item_uncomplete`, `item_close`, `item_delete`, `project_add`, `project_update`, `section_add`, `section_update`, `section_delete`, `label_update`, `label_update_orders`. |
| `GET /api/v1/tasks/completed/by_completion_date` | `since`, `until`, `limit`, `cursor`. Days are UTC. |

## Recurring tasks

Whether a due date recurs is read from its `string`, as in Todoist. The
commands behave as the Todoist API defines them:

| Command | Recurring task |
| --- | --- |
| `item_close` | Moves to its next date and stays open. The occurrence is recorded in the history. Subtasks keep their state. When an `until` date has passed, the task is completed instead. |
| `item_complete` | Completed and archived, ending the series. |

`every` counts from the current due date and `every!` from today. An overdue
task skips to the first date after today. The time of day and the shape of the
date (plain, floating or fixed to a timezone) are kept. "Today" is the user's
timezone.

Understood, in English, Dutch and French (`elke maandag`, `tous les 2 jours`):

| Kind | Examples |
| --- | --- |
| Days | `every day`, `daily`, `every 3 days`, `every other day`, `every! 3 days` |
| Workdays | `every workday`, `every weekday`, `every 2 workdays`, `every weekend` (Saturday and Sunday) |
| Weeks | `every week`, `weekly`, `every 2 weeks`, `every mon, fri`, `every other fri` |
| Months | `every month`, `monthly`, `every 15th`, `every 1, 15`, `every last day`, `every quarter` |
| Years | `every year`, `yearly`, `every jan 14`, `every 14 jan, 14 jul` |
| Modifiers | `at 9am`, `at 20:00`, `starting sep 19`, `until 2026-12-31`, `ending aug 3` |

Not understood: hours (`every hour`), weekday ordinals (`every 2nd monday`,
`every last friday`), workday ordinals, holidays and `for 3 weeks`. A task
cannot be given such a date. One that already has it can still be moved to
another date, but closing it is refused with an error, so a series is never
moved to a wrong date.

## Running it

Node 22 or later.

```sh
cd server
npm install
npm run create-user -- --email alice@example.com --name "Alice" --timezone Europe/Amsterdam
npm run dev
```

`create-user` prints the API token once. Paste it into the app's connect screen.

Then start the app pointed at the server:

```sh
VITE_API_BASE=/api/v1 npm run dev
```

The Vite dev server hands `/api` to `http://127.0.0.1:8787`
(override with `API_PROXY_TARGET`).

## Production

Build the app with `VITE_API_BASE=/api/v1 npm run build` and let the server
serve it next to the API:

```sh
STATIC_DIR=../dist HOST=0.0.0.0 npm start
```

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `8787` | |
| `HOST` | `127.0.0.1` | |
| `DATABASE_URL` | unset | `postgres://user:pass@host/db`. Takes precedence over `DB_PATH`. |
| `DB_PATH` | `data/tasks.db` | SQLite file, created on first start. |
| `STATIC_DIR` | unset | Built app to serve at `/`. |
| `CORS_ORIGIN` | unset | Comma-separated origins, when the app is hosted elsewhere. |

## Tests

```sh
npm test
npm run typecheck
TEST_DATABASE_URL=postgres://user:pass@localhost/test_db npm test
```

With `TEST_DATABASE_URL` set the same tests run against Postgres. Use an empty
database meant for testing; tests leave their rows behind.

`test/contract.test.ts` runs the app's own API client (`src/api`) against a
live server, so a change that would break the app fails here.
