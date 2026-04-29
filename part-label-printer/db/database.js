const path = require('path');
const { app } = require('electron');
let db;

function getDb() {
  if (!db) throw new Error('Database not initialised');
  return db;
}

function initDatabase() {
  const Database = require('better-sqlite3');
  const dbPath = path.join(app.getPath('userData'), 'parts-label.db');
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS parts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      part_number  TEXT NOT NULL,
      description  TEXT,
      category     TEXT,
      bin_location TEXT,
      updated_at   TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const defaults = [
    ['printer_name', 'POLONO PL60 - FOR REALS on Ne01:'],
    ['label_width_in', '4'],
    ['label_height_in', '6'],
    ['logo_path', ''],
    ['last_import_date', '']
  ];
  const insertDefault = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of defaults) {
    insertDefault.run(key, value);
  }

  return db;
}

function getAllParts() {
  return getDb().prepare('SELECT * FROM parts ORDER BY part_number').all();
}

function getPart(id) {
  return getDb().prepare('SELECT * FROM parts WHERE id = ?').get(id);
}

function updateDescription(id, description, updatedAt) {
  getDb()
    .prepare('UPDATE parts SET description = ?, updated_at = ? WHERE id = ?')
    .run(description, updatedAt, id);
}

function importParts(parts) {
  const d = getDb();
  const transaction = d.transaction(() => {
    d.prepare('DELETE FROM parts').run();
    const insert = d.prepare(
      'INSERT INTO parts (part_number, description, category, bin_location, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    for (const p of parts) {
      insert.run(p.part_number, p.description, p.category, p.bin_location, p.updated_at);
    }
  });
  transaction();
  return parts.length;
}

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, value);
}

function getAllSettings() {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  const result = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

module.exports = {
  initDatabase,
  getAllParts,
  getPart,
  updateDescription,
  importParts,
  getSetting,
  setSetting,
  getAllSettings
};
