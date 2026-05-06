import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'pet.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    image_url TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const { c } = db.prepare('SELECT COUNT(*) AS c FROM products').get();
if (c === 0) {
  const insert = db.prepare(
    'INSERT INTO products (name, price, image_url, description) VALUES (?, ?, ?, ?)'
  );
  const samples = [
    [
      'Modern Pet House Bed',
      94.99,
      '/images/product-1.jpg',
      'Cozy wooden house bed for small dogs.',
    ],
    [
      'Grain-Free Salmon Kibble',
      48.5,
      '/images/product-2.jpg',
      'Nutrition for shiny coat and healthy joints.',
    ],
    [
      'Interactive Cat Wand',
      16.99,
      '/images/product-3.jpg',
      'Feather teaser to keep cats active indoors.',
    ],
    [
      'Orthopedic Pet Mattress',
      129.0,
      '/images/product-1.jpg',
      'Pressure-relief foam for senior pets.',
    ],
  ];
  const tx = db.transaction((rows) => {
    for (const row of rows) insert.run(...row);
  });
  tx(samples);
}

export default db;
