const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "change-this-secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.locals.currentUser = req.session.user;
  next();
}

app.get("/", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.redirect("/dashboard");
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      console.error(err);
      return res.render("login", { error: "Internal error" });
    }
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.render("login", { error: "Invalid username or password" });
    }
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    res.redirect("/dashboard");
  });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/dashboard", requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const sql = `
    SELECT t.*, u.username AS created_by_name, a.username AS assigned_to_name
    FROM tickets t
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN users a ON t.assigned_to = a.id
    ORDER BY t.created_at DESC
  `;

  db.all(sql, [], (err, tickets) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error loading tickets");
    }

    db.all("SELECT id, username FROM users ORDER BY username", [], (e2, users) => {
      if (e2) {
        console.error(e2);
        return res.status(500).send("Error loading agents");
      }

      res.render("dashboard", { tickets, users, currentUser: req.session.user });
    });
  });
});

app.get("/tickets/new", requireAuth, (req, res) => {
  db.all("SELECT id, username FROM users ORDER BY username", [], (err, users) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error loading agents");
    }
    res.render("ticket_new", { users });
  });
});

app.post("/tickets", requireAuth, (req, res) => {
  const { title, description, assigned_to } = req.body;
  const now = new Date().toISOString();
  const createdBy = req.session.user.id;

  const sql = `
    INSERT INTO tickets (title, description, status, created_by, assigned_to, created_at, updated_at)
    VALUES (?, ?, 'open', ?, ?, ?, ?)
  `;
  db.run(sql, [title, description, createdBy, assigned_to || null, now, now], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send("Error creating ticket");
    }
    res.redirect("/dashboard");
  });
});

app.post("/tickets/:id/status", requireAuth, (req, res) => {
  const { status, assigned_to } = req.body;
  const id = req.params.id;
  const now = new Date().toISOString();

  const sql = `
    UPDATE tickets
    SET status = ?, assigned_to = ?, updated_at = ?
    WHERE id = ?
  `;
  db.run(sql, [status, assigned_to || null, now, id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send("Error updating ticket");
    }
    res.redirect("/dashboard");
  });
});

app.post("/tickets/:id/delete", requireAuth, (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM tickets WHERE id = ?", [id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send("Error deleting ticket");
    }
    res.redirect("/dashboard");
  });
});

app.listen(PORT, () => {
  console.log(`Ticket portal running at http://localhost:${PORT}`);
});

