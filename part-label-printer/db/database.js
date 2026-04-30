const fs = require('fs');
const path = require('path');
const { app } = require('electron');
let db;

const DATA_FILE = 'parts-label.json';
const DEFAULT_SETTINGS = {
  printer_name: 'POLONO PL60 - FOR REALS on Ne01:',
  label_width_in: '4',
  label_height_in: '3',
  logo_path: '',
  last_import_date: ''
};

function getDb() {
  if (!db) throw new Error('Database not initialised');
  return db;
}

function loadStorage(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function saveStorage(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function initDatabase() {
  const dataPath = path.join(app.getPath('userData'), DATA_FILE);
  const existing = loadStorage(dataPath);

  db = {
    parts: [],
    settings: { ...DEFAULT_SETTINGS },
    nextId: 1,
    dataPath
  };

  if (existing && typeof existing === 'object') {
    if (Array.isArray(existing.parts)) db.parts = existing.parts;
    if (existing.settings && typeof existing.settings === 'object') {
      db.settings = { ...db.settings, ...existing.settings };
    }
    if (typeof existing.nextId === 'number' && existing.nextId > 1) {
      db.nextId = existing.nextId;
    } else {
      const maxId = db.parts.reduce((max, part) => Math.max(max, part.id || 0), 0);
      db.nextId = maxId + 1;
    }
  }

  saveStorage(dataPath, db);
  return db;
}

function persist() {
  const { dataPath, parts, settings, nextId } = getDb();
  saveStorage(dataPath, { parts, settings, nextId });
}

function getAllParts() {
  return [...getDb().parts].sort((a, b) => {
    const av = String(a.part_number || '').toLowerCase();
    const bv = String(b.part_number || '').toLowerCase();
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
}

function getPart(id) {
  return getDb().parts.find(part => part.id === id) || null;
}

function updateDescription(id, description, updatedAt) {
  const part = getDb().parts.find(p => p.id === id);
  if (!part) return;
  part.description = description;
  part.updated_at = updatedAt;
  persist();
}

function importParts(parts) {
  const dbRef = getDb();
  dbRef.parts = parts.map((p, index) => ({
    id: dbRef.nextId + index,
    part_number: p.part_number,
    description: p.description,
    category: p.category,
    bin_location: p.bin_location,
    updated_at: p.updated_at
  }));
  dbRef.nextId += dbRef.parts.length;
  dbRef.settings.last_import_date = new Date().toISOString();
  persist();
  return dbRef.parts.length;
}

function getSetting(key) {
  return getDb().settings[key] ?? null;
}

function setSetting(key, value) {
  getDb().settings[key] = value;
  persist();
}

function getAllSettings() {
  return { ...getDb().settings };
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
