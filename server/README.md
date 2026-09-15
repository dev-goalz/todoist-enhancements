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

Completing or closing a recurring task is refused for now, so a series is
never ended by accident.

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
