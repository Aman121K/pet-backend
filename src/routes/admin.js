import { Router } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token =
    typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice(7)
      : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

router.post('/login', (req, res) => {
  const username = String(req.body?.username || '');
  const password = String(req.body?.password || '');
  const okUser =
    username === (process.env.ADMIN_USERNAME || 'admin') &&
    password === (process.env.ADMIN_PASSWORD || 'admin123');
  if (!okUser) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: '8h' });
  return res.json({ token });
});

router.get('/subscribers', requireAuth, (_req, res) => {
  const rows = db
    .prepare('SELECT id, email, created_at FROM subscribers ORDER BY id DESC')
    .all();
  res.json(rows);
});

router.get('/products', requireAuth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  res.json(rows);
});

router.post('/products', requireAuth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const price = Number(req.body?.price);
  const image_url = String(req.body?.image_url || '').trim();
  const description = String(req.body?.description || '').trim();
  if (!name || Number.isNaN(price)) {
    return res.status(400).json({ error: 'Name and price required' });
  }
  const info = db
    .prepare(
      'INSERT INTO products (name, price, image_url, description) VALUES (?, ?, ?, ?)'
    )
    .run(name, price, image_url, description);
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.json(row);
});

router.put('/products/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body?.name || '').trim();
  const price = Number(req.body?.price);
  const image_url = String(req.body?.image_url || '').trim();
  const description = String(req.body?.description || '').trim();
  if (!name || Number.isNaN(price)) {
    return res.status(400).json({ error: 'Name and price required' });
  }
  const result = db
    .prepare(
      'UPDATE products SET name = ?, price = ?, image_url = ?, description = ? WHERE id = ?'
    )
    .run(name, price, image_url, description, id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json(row);
});

router.delete('/products/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ ok: true });
});

export default router;
