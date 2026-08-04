const pool = require('./pool');

// Mirrors the original app's BK_KEYPATHS — which field is the primary key
// for each "store" (this was the IndexedDB keyPath for each object store).
const BK_KEYPATHS = {
  businesses: 'id', users: 'id', lproducts: 'id', suppliers: 'id', purchases: 'id', lsales: 'id',
  customers: 'id', payments: 'id', subscriptions: 'businessId', sessions: 'token', auditLogs: 'id',
  plans: 'id', invoices: 'id', webhookLogs: 'id', renewalLogs: 'id', trialHistory: 'businessId',
  promoCodes: 'code', notifications: 'id', superAdmins: 'email', backups: 'id', branches: 'id',
  transfers: 'id', businessSettings: 'businessId', importLogs: 'id', tillSessions: 'id',
  referrals: 'id', onlineOrders: 'id', shopCustomers: 'id',
};

// Maps the original by_xxx index names to the secondary columns on kv_store.
const INDEX_COLUMNS = {
  by_email: 'email',
  by_business: 'business_id',
  by_event: 'event_key',
  by_referrer: 'referrer_business_id',
  by_referee: 'referee_business_id',
};

function indexValues(val) {
  return {
    business_id: val.businessId != null ? String(val.businessId) : null,
    email: val.email != null ? String(val.email) : null,
    event_key: val.eventKey != null ? String(val.eventKey) : null,
    referrer_business_id: val.referrerBusinessId != null ? String(val.referrerBusinessId) : null,
    referee_business_id: val.refereeBusinessId != null ? String(val.refereeBusinessId) : null,
  };
}

async function bkGet(store, key) {
  if (key == null) return null;
  const { rows } = await pool.query(
    'SELECT data FROM kv_store WHERE store = $1 AND key = $2',
    [store, String(key)]
  );
  return rows[0] ? rows[0].data : null;
}

async function bkPut(store, val) {
  const kp = BK_KEYPATHS[store];
  if (!kp) throw new Error(`Unknown store "${store}" — add it to BK_KEYPATHS in db/store.js`);
  const key = String(val[kp]);
  const idx = indexValues(val);
  await pool.query(
    `INSERT INTO kv_store (store, key, data, business_id, email, event_key, referrer_business_id, referee_business_id, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, now())
     ON CONFLICT (store, key) DO UPDATE SET
       data = $3::jsonb,
       business_id = $4,
       email = $5,
       event_key = $6,
       referrer_business_id = $7,
       referee_business_id = $8,
       updated_at = now()`,
    [store, key, JSON.stringify(val), idx.business_id, idx.email, idx.event_key, idx.referrer_business_id, idx.referee_business_id]
  );
  return val;
}

async function bkDelete(store, key) {
  await pool.query('DELETE FROM kv_store WHERE store = $1 AND key = $2', [store, String(key)]);
  return true;
}

async function bkAllByIndex(store, index, value) {
  const col = INDEX_COLUMNS[index];
  if (!col) throw new Error(`Unknown index "${index}" — add it to INDEX_COLUMNS in db/store.js`);
  const { rows } = await pool.query(
    `SELECT data FROM kv_store WHERE store = $1 AND ${col} = $2`,
    [store, String(value)]
  );
  return rows.map((r) => r.data);
}

async function bkAll(store) {
  const { rows } = await pool.query('SELECT data FROM kv_store WHERE store = $1', [store]);
  return rows.map((r) => r.data);
}

module.exports = { bkGet, bkPut, bkDelete, bkAllByIndex, bkAll, BK_KEYPATHS, INDEX_COLUMNS };
