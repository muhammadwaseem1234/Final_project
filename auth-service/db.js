const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

let db;
let dbFilePath;

const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'auth.db');

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const saveDb = () => {
  if (!db || !dbFilePath) return;
  const data = db.export();
  fs.writeFileSync(dbFilePath, Buffer.from(data));
};

const initDb = async (dbPath = DEFAULT_DB_PATH) => {
  dbFilePath = dbPath ? path.resolve(dbPath) : DEFAULT_DB_PATH;
  ensureDir(dbFilePath);

  const SQL = await initSqlJs();
  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      commitment TEXT NOT NULL,
      status TEXT NOT NULL,
      registered_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_seen INTEGER
    );
  `);
  saveDb();
  return db;
};

const getDevice = async (deviceId) => {
  const stmt = db.prepare('SELECT * FROM devices WHERE device_id = ?');
  stmt.bind([deviceId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return {
    deviceId: row.device_id,
    commitment: row.commitment,
    status: row.status,
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
    lastSeen: row.last_seen
  };
};

const upsertDevice = async ({ deviceId, commitment, status, registeredAt, updatedAt }) => {
  const stmt = db.prepare(
    `
    INSERT INTO devices (device_id, commitment, status, registered_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      commitment = excluded.commitment,
      status = excluded.status,
      updated_at = excluded.updated_at
  `
  );
  stmt.run([deviceId, commitment, status, registeredAt, updatedAt]);
  stmt.free();
  saveDb();
};

const updateDeviceStatus = async (deviceId, status) => {
  const stmt = db.prepare('UPDATE devices SET status = ?, updated_at = ? WHERE device_id = ?');
  stmt.run([status, Date.now(), deviceId]);
  stmt.free();
  saveDb();
};

const markLastSeen = async (deviceId, timestamp) => {
  const stmt = db.prepare('UPDATE devices SET last_seen = ?, updated_at = ? WHERE device_id = ?');
  stmt.run([timestamp, timestamp, deviceId]);
  stmt.free();
  saveDb();
};

module.exports = { initDb, getDevice, upsertDevice, updateDeviceStatus, markLastSeen };
