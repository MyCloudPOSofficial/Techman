# Cloud POS — Real Backend

A real Express + PostgreSQL server that replaces the app's old embedded
IndexedDB-simulated backend. It was ported directly from that simulated
backend (`backend.handle()` + its ~50 route methods) — the same routes,
auth rules, role checks, and business logic, just backed by a real database
instead of the browser's local storage.

## What's here

```
pos-backend/
  server.js           Express app — HTTP in/out
  db/schema.sql        Postgres schema (one generic, indexed kv_store table)
  db/pool.js            Postgres connection pool
  db/migrate.js         Run this once to create the schema
  db/store.js            bkGet/bkPut/bkDelete/bkAllByIndex/bkAll — real SQL
  lib/backend-logic.js    The ported route table + all business logic (~1,800 lines)
  lib/request-context.js  Per-request IP/user-agent (used by audit logging)
  .env.example
```

### Why one generic table instead of 27 hand-built tables?

The original app had ~27 IndexedDB "stores" (businesses, users, products,
sales, subscriptions, audit logs, backups, branches, transfers, etc.), each
keyed by one field with a couple of secondary indexes. `kv_store` mirrors
that shape in Postgres: `(store, key)` as primary key, the full record as
`JSONB`, and real indexed columns for every secondary lookup the app
actually does (`business_id`, `email`, `event_key`, etc.) — so lookups are
real indexed queries, not table scans. This let me port ~1,800 lines of
already-correct, already-tested business logic almost unchanged, rather
than rewriting it from scratch against 27 bespoke schemas. Any individual
store (e.g. `lsales`, `lproducts`) can be promoted to a fully normalized
table with foreign keys later, store by store, without touching the others.

## Setup

1. **Get a Postgres database.** Railway, Supabase, and Render all give you
   a connection string in about a minute (matches your existing Railway
   deployment pattern for BackChat).
2. `cd pos-backend && npm install`
3. `cp .env.example .env` and fill in `DATABASE_URL` (and set
   `DATABASE_SSL=true` if your provider requires it — Railway/Supabase/Render
   all do).
4. `npm run migrate` — creates the schema.
5. `npm start` — runs the server (default port 8080, override with `PORT`).

Verify it's up: `curl http://localhost:8080/health` → `{"ok":true}`

### Deploying (e.g. Railway)

Push `pos-backend/` as its own repo/service, set `DATABASE_URL` +
`DATABASE_SSL=true` + `CORS_ORIGIN=https://your-frontend-domain` as
environment variables, and Railway will run `npm start` automatically.

## Connecting the frontend

Open `../config.js` (next to `index.html`, one folder up from this one) and
replace the placeholder with your Railway URL:

```js
window.CLOUD_POS_API_BASE = "https://your-api.up.railway.app";
```

Save it, then open `index.html` — that's it, no browser console needed.
(If `config.js` still has the placeholder URL, it falls back to
`http://localhost:8080` for local dev.)

## What was tested

Ran the full stack locally (Postgres + this server) and confirmed, over
real HTTP against real Postgres rows:
- Business registration → login → session token
- Product creation, listing, validation rules
- Till open
- Dashboard report aggregation

All 84 ported routes share the same auth/session/role-check code path as
these, so they follow the same pattern, but only the ones above were
individually exercised.

## Known gap: the Fresh & Co online storefront module

`window.CloudPOSBridge` and `loadOnlineStore()` (the in-progress storefront
integration) call the old `bkGet`/`bkPut`/`bkAllByIndex` functions **directly**,
bypassing `api()` entirely — that module was never wired through
`backend.handle()` in the original app, so it wasn't part of this port. It
still works, but against the browser's local IndexedDB, disconnected from
this real backend. That means online orders, shop-customer accounts, and
product visibility toggles made through the storefront won't show up in the
real database. This needs its own small set of routes (public storefront
lookup, online orders, shop customer signup/signin) added to
`lib/backend-logic.js` and `CloudPOSBridge` rewired to call them via `api()`
— happy to do that next.

The old simulated backend code (`backend.handle()`, IndexedDB engine, `bk*`
helpers) is still present in the HTML file, unused by the main app now, but
still what powers `CloudPOSBridge` per the gap above. It's safe to delete
once that module is ported too.
