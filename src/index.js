import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMongo } from './db/mongo.js';
import { config } from './config.js';
import { Product } from './models/Product.js';
import { Blog } from './models/Blog.js';
import { ensureSeedData } from './seed.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
const webDist = path.join(projectRoot, 'web', 'dist');
const adminDist = path.join(projectRoot, 'admin', 'dist');
const hasWebDist = fs.existsSync(path.join(webDist, 'index.html'));
const hasAdminDist = fs.existsSync(path.join(adminDist, 'index.html'));
const adminClientPaths = [
  '/dashboard',
  '/users',
  '/orders',
  '/pages',
  '/categories',
  '/discounts',
  '/banners',
  '/subscribers',
  '/blogs',
  '/products',
  '/login',
  '/client-access',
];

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/robots.txt', (_req, res) => {
  const siteUrl = config.siteUrl.replace(/\/$/, '');
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (_req, res) => {
  const siteUrl = config.siteUrl.replace(/\/$/, '');
  const products = await Product.find({ isActive: true }).select('slug updatedAt').lean();
  const blogs = await Blog.find({ isActive: true, status: 'published' }).select('slug updatedAt').lean();
  const urls = [
    `${siteUrl}/`,
    `${siteUrl}/shop`,
    `${siteUrl}/about`,
    `${siteUrl}/contact`,
    `${siteUrl}/blog`,
    ...products.map((p) => `${siteUrl}/products/${p.slug}`),
    ...blogs.map((b) => `${siteUrl}/blog/${b.slug}`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((loc) => {
      const product = products.find((p) => `${siteUrl}/products/${p.slug}` === loc);
      const blog = blogs.find((b) => `${siteUrl}/blog/${b.slug}` === loc);
      const lastmodValue = product?.updatedAt || blog?.updatedAt;
      const lastmod = lastmodValue
        ? `\n    <lastmod>${new Date(lastmodValue).toISOString()}</lastmod>`
        : '';
      return `  <url>\n    <loc>${loc}</loc>${lastmod}\n  </url>`;
    })
    .join('\n')}\n</urlset>`;
  res.type('application/xml');
  res.send(xml);
});

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

if (hasAdminDist) {
  app.use(express.static(adminDist));
}
if (hasWebDist) {
  app.use(express.static(webDist));
}

app.get('*', (req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api')) return next();
  const acceptsHtml = req.accepts(['html', 'json']) === 'html';
  if (!acceptsHtml) return next();

  const isAdminClientRoute = adminClientPaths.some(
    (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`)
  );

  if (isAdminClientRoute && hasAdminDist) {
    return res.sendFile(path.join(adminDist, 'index.html'));
  }
  if (hasWebDist) {
    return res.sendFile(path.join(webDist, 'index.html'));
  }
  if (hasAdminDist) {
    return res.sendFile(path.join(adminDist, 'index.html'));
  }
  return res.status(404).json({ error: 'Not found' });
});

async function start() {
  await connectMongo();
  await ensureSeedData();
  app.listen(config.port, () => {
    console.log(`Pet SQUARE API listening on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
