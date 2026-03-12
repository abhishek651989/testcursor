const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = path.join(__dirname, "ticket_portal.db");

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'agent'
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_by INTEGER,
      assigned_to INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(created_by) REFERENCES users(id),
      FOREIGN KEY(assigned_to) REFERENCES users(id)
    )`
  );

  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err) {
      console.error("Error checking default users:", err);
      return;
    }

    if (row.count === 0) {
      const bcrypt = require("bcryptjs");
      const passwordHash = bcrypt.hashSync("password", 10);

      const stmt = db.prepare(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)"
      );
      stmt.run("agent1", passwordHash, "agent");
      stmt.run("agent2", passwordHash, "agent");
      stmt.finalize();

      console.log(
        "Created default users: agent1/password and agent2/password"
      );
    }
  });
});

module.exports = db;

