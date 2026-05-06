import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.post('/subscribe', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  try {
    db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(email);
    return res.json({ ok: true });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Already subscribed' });
    }
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/products', (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  res.json(rows);
});

export default router;
