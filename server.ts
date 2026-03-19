import express from "express";
import { createServer as createViteServer } from "vite";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database
async function initDb() {
  const connection = await db.getConnection();
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        farm_name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        pin_code VARCHAR(10) DEFAULT '0000',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await connection.execute(`ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT FALSE`);
    } catch (err: any) {
      // Column might already exist
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        email VARCHAR(255) PRIMARY KEY,
        code VARCHAR(10) NOT NULL,
        expires_at DATETIME NOT NULL
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS cows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tag_code VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'cow',
        breed VARCHAR(255),
        age INT,
        gender VARCHAR(50),
        mother_tag VARCHAR(255),
        birth_date DATE,
        calvings INT,
        last_calving_date DATE,
        insemination_date DATE,
        image_data LONGTEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE KEY (user_id, tag_code)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS milk_yields (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cow_id INT NOT NULL,
        amount DOUBLE NOT NULL,
        date DATE NOT NULL,
        session VARCHAR(20) DEFAULT 'morning',
        FOREIGN KEY (cow_id) REFERENCES cows (id) ON DELETE CASCADE
      )
    `);
  } finally {
    connection.release();
  }
}
initDb();

// Migration code removed for MySQL

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
 console.log(`Server running on http://localhost:${PORT}`);
});


  app.use(express.json({ limit: '10mb' }));

  // User Routes
  app.get("/api/users", async (req, res) => {
    try {
      const [users] = await db.execute("SELECT * FROM users ORDER BY created_at DESC");
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/users/me", async (req, res) => {
    const userId = req.query.userId;
    try {
      let user;
      if (userId) {
        const [rows] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
        user = (rows as any[])[0];
      } else {
        const [rows] = await db.execute("SELECT * FROM users LIMIT 1");
        user = (rows as any[])[0];
      }
      res.json(user || null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users/send-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Имэйл хаяг шаардлагатай." });

    // Generate 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    try {
      await db.execute(`
        INSERT INTO otp_codes (email, code, expires_at)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE code = VALUES(code), expires_at = VALUES(expires_at)
      `, [email, code, expiresAt]);

      // Try to send email if Gmail is configured
      let emailSent = false;
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        try {
          await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Фермийн бүртгэлийн баталгаажуулах код',
            text: `Фермийн бүртгэлийн баталгаажуулах код: ${code}`
          });
          emailSent = true;
          console.log(`Email sent to ${email}`);
        } catch (eErr: any) {
          console.error("Email Error:", eErr.message);
        }
      }

      console.log(`OTP for ${email}: ${code}`);
      
      res.json({ 
        success: true, 
        message: emailSent ? "Баталгаажуулах код имэйл рүү илгээгдлээ." : "Баталгаажуулах код үүсгэгдлээ (Туршилтын горим).", 
        debugCode: code,
        isTestMode: !emailSent
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users/register", async (req, res) => {
    const { name, farm_name, email, pin_code, otp_code } = req.body;
    
    // Verify OTP
    try {
      const [rows] = await db.execute("SELECT * FROM otp_codes WHERE email = ? AND code = ?", [email, otp_code]);
      const otp = (rows as any[])[0];
      if (!otp || new Date(otp.expires_at) < new Date()) {
        return res.status(400).json({ error: "Баталгаажуулах код буруу эсвэл хугацаа нь дууссан байна." });
      }

      const [result] = await db.execute(`
        INSERT INTO users (name, farm_name, email, pin_code, is_approved)
        VALUES (?, ?, ?, ?, FALSE)
      `, [name, farm_name, email, pin_code || '0000']);
      
      // Clear OTP
      await db.execute("DELETE FROM otp_codes WHERE email = ?", [email]);

      const [users] = await db.execute("SELECT * FROM users WHERE id = ?", [(result as any).insertId]);
      res.json((users as any[])[0]);
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ error: "Энэ имэйл хаяг аль хэдийн бүртгэгдсэн байна." });
      } else {
        res.status(400).json({ error: err.message });
      }
    }
  });


  app.post("/api/admin/approve-user", async (req, res) => {
    const { userId, adminEmail } = req.body;
    if (adminEmail !== 'purevs@gmail.com') {
      return res.status(403).json({ error: "Зөвхөн админ баталгаажуулах эрхтэй." });
    }
    try {
      await db.execute("UPDATE users SET is_approved = TRUE WHERE id = ?", [userId]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users/login", async (req, res) => {
    const { farm_name, pin_code } = req.body;
    try {
      const [rows] = await db.execute("SELECT * FROM users WHERE farm_name = ? AND pin_code = ? AND is_approved = TRUE", [farm_name, pin_code]);
      const user = (rows as any[])[0];
      if (user) {
        res.json(user);
      } else {
        res.status(401).json({ error: "Фермийн нэр эсвэл PIN код буруу байна, эсвэл админ баталгаажуулаагүй байна." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Routes
  app.get("/api/cows", async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "userId required" });
    try {
      const [cows] = await db.execute("SELECT * FROM cows WHERE user_id = ? ORDER BY created_at DESC", [userId]);
      res.json(cows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cows", async (req, res) => {
    const { 
      user_id, tag_code, type, breed, age, gender, mother_tag, birth_date, 
      calvings, last_calving_date, insemination_date, image_data, notes 
    } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id required" });
    try {
      const [result] = await db.execute(`
        INSERT INTO cows (
          user_id, tag_code, type, breed, age, gender, mother_tag, birth_date, 
          calvings, last_calving_date, insemination_date, image_data, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
      ]);
      res.json({ id: (result as any).insertId });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/cows/:id", async (req, res) => {
    try {
      const [rows] = await db.execute("SELECT * FROM cows WHERE id = ?", [req.params.id]);
      const cow = (rows as any[])[0];
      if (!cow) return res.status(404).json({ error: "Cow not found" });
      
      const [yields] = await db.execute("SELECT * FROM milk_yields WHERE cow_id = ? ORDER BY date DESC", [req.params.id]);
      res.json({ ...cow, yields });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/milk", async (req, res) => {
    const { cow_id, amount, date, session } = req.body;
    try {
      const [rows] = await db.execute(`
        SELECT id, amount FROM milk_yields 
        WHERE cow_id = ? AND date = ? AND session = ?
      `, [cow_id, date, session || 'morning']);
      
      const existing = (rows as any[])[0];

      if (existing) {
        await db.execute(`
          UPDATE milk_yields SET amount = amount + ? WHERE id = ?
        `, [amount, existing.id]);
      } else {
        await db.execute(`
          INSERT INTO milk_yields (cow_id, amount, date, session)
          VALUES (?, ?, ?, ?)
        `, [cow_id, amount, date, session || 'morning']);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/cows/:id", async (req, res) => {
    try {
      await db.execute("DELETE FROM cows WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Image Proxy Route
  app.get('/api/image', async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send('URL is required');
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const buffer = await response.arrayBuffer();
      res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).send('Failed to fetch image');
    }
  });

  app.patch("/api/cows/:id", async (req, res) => {
    const { id } = req.params;
    const { 
      tag_code, type, breed, age, gender, mother_tag, birth_date, 
      calvings, last_calving_date, insemination_date, image_data, notes 
    } = req.body;

    try {
      await db.execute(`
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
      `, [
        tag_code, type, breed, age, gender, mother_tag, birth_date,
        calvings, last_calving_date, insemination_date, image_data, notes,
        id
      ]);
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

  app.get("/api/reports/milk", async (req, res) => {
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
      const [yields] = await db.execute(query, params);
      res.json(yields);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
