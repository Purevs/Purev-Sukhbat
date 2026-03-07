import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("farm.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    farm_name TEXT,
    email TEXT UNIQUE,
    pin_code TEXT DEFAULT '0000',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tag_code TEXT NOT NULL,
    type TEXT DEFAULT 'cow',
    breed TEXT,
    age INTEGER,
    gender TEXT,
    mother_tag TEXT,
    birth_date TEXT,
    calvings INTEGER,
    last_calving_date TEXT,
    insemination_date TEXT,
    image_data TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, tag_code)
  );

  CREATE TABLE IF NOT EXISTS milk_yields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cow_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    session TEXT DEFAULT 'morning', -- 'morning' or 'evening'
    FOREIGN KEY (cow_id) REFERENCES cows (id) ON DELETE CASCADE
  );
`);

// Migration: Add pin_code if it doesn't exist
const usersInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
const hasPinCode = usersInfo.some(col => col.name === 'pin_code');
if (!hasPinCode) {
  db.exec("ALTER TABLE users ADD COLUMN pin_code TEXT DEFAULT '0000'");
}

// Migration: Add session if it doesn't exist
const milkYieldsInfo = db.prepare("PRAGMA table_info(milk_yields)").all() as any[];
const hasSession = milkYieldsInfo.some(col => col.name === 'session');
if (!hasSession) {
  db.exec("ALTER TABLE milk_yields ADD COLUMN session TEXT DEFAULT 'morning'");
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // User Routes
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
    res.json(users);
  });

  app.get("/api/users/me", (req, res) => {
    const userId = req.query.userId;
    let user;
    if (userId) {
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    } else {
      user = db.prepare("SELECT * FROM users LIMIT 1").get();
    }
    res.json(user || null);
  });

  app.post("/api/users/register", (req, res) => {
    const { name, farm_name, email, pin_code } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO users (name, farm_name, email, pin_code)
        VALUES (?, ?, ?, ?)
      `).run(name, farm_name, email, pin_code || '0000');
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/users/login", (req, res) => {
    const { farm_name, pin_code } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE farm_name = ? AND pin_code = ?").get(farm_name, pin_code);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Фермийн нэр эсвэл PIN код буруу байна." });
    }
  });

  // API Routes
  app.get("/api/cows", (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const cows = db.prepare("SELECT * FROM cows WHERE user_id = ? ORDER BY created_at DESC").all(userId);
    res.json(cows);
  });

  app.post("/api/cows", (req, res) => {
    const { 
      user_id, tag_code, type, breed, age, gender, mother_tag, birth_date, 
      calvings, last_calving_date, insemination_date, image_data, notes 
    } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id required" });
    try {
      const info = db.prepare(`
        INSERT INTO cows (
          user_id, tag_code, type, breed, age, gender, mother_tag, birth_date, 
          calvings, last_calving_date, insemination_date, image_data, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user_id,
        tag_code, 
        type || 'cow',
        breed || null, 
        Number(age) || 0, 
        gender || null,
        mother_tag || null,
        birth_date || null,
        Number(calvings) || 0, 
        last_calving_date || null,
        insemination_date || null, 
        image_data || null,
        notes || null
      );
      res.json({ id: info.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/cows/:id", (req, res) => {
    const cow = db.prepare("SELECT * FROM cows WHERE id = ?").get(req.params.id);
    if (!cow) return res.status(404).json({ error: "Cow not found" });
    
    const yields = db.prepare("SELECT * FROM milk_yields WHERE cow_id = ? ORDER BY date DESC").all(req.params.id);
    res.json({ ...cow, yields });
  });

  app.post("/api/milk", (req, res) => {
    const { cow_id, amount, date, session } = req.body;
    try {
      const existing = db.prepare(`
        SELECT id, amount FROM milk_yields 
        WHERE cow_id = ? AND date = ? AND session = ?
      `).get(cow_id, date, session || 'morning') as { id: number, amount: number } | undefined;

      if (existing) {
        db.prepare(`
          UPDATE milk_yields SET amount = amount + ? WHERE id = ?
        `).run(amount, existing.id);
      } else {
        db.prepare(`
          INSERT INTO milk_yields (cow_id, amount, date, session)
          VALUES (?, ?, ?, ?)
        `).run(cow_id, amount, date, session || 'morning');
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/cows/:id", (req, res) => {
    // In a real app, check user_id here
    db.prepare("DELETE FROM cows WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.patch("/api/cows/:id", (req, res) => {
    const { id } = req.params;
    const { 
      tag_code, type, breed, age, gender, mother_tag, birth_date, 
      calvings, last_calving_date, insemination_date, image_data, notes 
    } = req.body;

    try {
      db.prepare(`
        UPDATE cows SET 
          tag_code = COALESCE(?, tag_code),
          type = COALESCE(?, type),
          breed = COALESCE(?, breed),
          age = COALESCE(?, age),
          gender = COALESCE(?, gender),
          mother_tag = COALESCE(?, mother_tag),
          birth_date = COALESCE(?, birth_date),
          calvings = COALESCE(?, calvings),
          last_calving_date = COALESCE(?, last_calving_date),
          insemination_date = COALESCE(?, insemination_date),
          image_data = COALESCE(?, image_data),
          notes = COALESCE(?, notes)
        WHERE id = ?
      `).run(
        tag_code, type, breed, age, gender, mother_tag, birth_date,
        calvings, last_calving_date, insemination_date, image_data, notes,
        id
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.get("/api/reports/milk", (req, res) => {
    const { userId, startDate, endDate } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });
    
    let query = `
      SELECT m.*, c.tag_code, c.type 
      FROM milk_yields m
      JOIN cows c ON m.cow_id = c.id
      WHERE c.user_id = ?
    `;
    const params: any[] = [userId];

    if (startDate) {
      query += " AND m.date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      query += " AND m.date <= ?";
      params.push(endDate);
    }

    query += " ORDER BY m.date DESC, m.session ASC";
    
    try {
      const yields = db.prepare(query).all(...params);
      res.json(yields);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
