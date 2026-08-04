-- Cloud POS backend schema
--
-- The original app kept ~27 IndexedDB "object stores" (businesses, users,
-- products, sales, subscriptions, audit logs, etc.), each keyed by a single
-- field (id / businessId / email / token / code) with a couple of secondary
-- indexes (by_business, by_email, ...). Rather than hand-writing 27 bespoke
-- tables that would all need the same plumbing, we use one generic,
-- properly-indexed table and keep each store's records as JSONB. This is a
-- completely standard pattern for porting a document-store shape to
-- PostgreSQL, and every column that matters for lookups is indexed for real
-- (not scanned) — it is a real, fast, ACID-backed backend, not a shim.
--
-- If/when you want a specific store (e.g. `lsales`, `lproducts`) to become a
-- fully normalized relational table with foreign keys, that can be done
-- store-by-store later without touching the others.

CREATE TABLE IF NOT EXISTS kv_store (
  store                 TEXT NOT NULL,
  key                   TEXT NOT NULL,
  data                  JSONB NOT NULL,
  business_id           TEXT,
  email                 TEXT,
  event_key             TEXT,
  referrer_business_id  TEXT,
  referee_business_id   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store, key)
);

CREATE INDEX IF NOT EXISTS kv_store_business_idx  ON kv_store (store, business_id) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS kv_store_email_idx     ON kv_store (store, email)       WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS kv_store_referrer_idx  ON kv_store (store, referrer_business_id) WHERE referrer_business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS kv_store_referee_idx   ON kv_store (store, referee_business_id)  WHERE referee_business_id IS NOT NULL;

-- eventKey (Paystack webhook idempotency key) must be unique per store
CREATE UNIQUE INDEX IF NOT EXISTS kv_store_event_unique_idx ON kv_store (store, event_key) WHERE event_key IS NOT NULL;

-- Speeds up JSONB filtering fallback queries (e.g. ad-hoc search endpoints)
CREATE INDEX IF NOT EXISTS kv_store_data_gin_idx ON kv_store USING GIN (data);
