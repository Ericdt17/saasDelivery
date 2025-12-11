const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const config = require("../config");

const SQLITE_PATH = config.DB_PATH || path.join(__dirname, "..", "..", "data", "local.db");

function ensureSqliteFile(dbPath = SQLITE_PATH) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    // Touch file to guarantee presence; schema creation happens separately
    fs.closeSync(fs.openSync(dbPath, "w"));
  }
  return dbPath;
}

function createSqliteClient() {
  const dbPath = ensureSqliteFile(SQLITE_PATH);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

module.exports = {
  createSqliteClient,
  SQLITE_PATH,
};



