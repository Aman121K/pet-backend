import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';
import { Banner } from '../models/Banner.js';
import { Blog } from '../models/Blog.js';
import { Category } from '../models/Category.js';
import { DiscountCode } from '../models/DiscountCode.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Subscriber } from '../models/Subscriber.js';
import { User } from '../models/User.js';
import { config } from '../config.js';
import { requireAuth, signToken } from '../utils/auth.js';
import { toSlug } from '../utils/slug.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 10 } });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webPagesDir = path.resolve(__dirname, '../../../web/src/pages');

const hasR2Config = Boolean(
  config.r2AccountId
  && config.r2AccessKeyId
  && config.r2SecretAccessKey
  && config.r2Bucket
);

const r2Client = hasR2Config
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    })
  : null;

function fileExtFrom(name = '', mime = '') {
  const fromName = String(name).trim().split('.').pop();
  if (fromName && fromName !== name) return fromName.toLowerCase();
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/svg+xml') return 'svg';
  return 'bin';
}

function buildR2Url(key) {
  if (config.r2PublicBaseUrl) {
    return `${config.r2PublicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
  return `https://${config.r2Bucket}.${config.r2AccountId}.r2.cloudflarestorage.com/${key}`;
}

function safePageFileName(input = '') {
  const name = String(input || '').trim();
  if (!/^[A-Za-z0-9_-]+\.jsx$/.test(name)) return '';
  return name;
}

router.post('/login', async (req, res) => {
  const emailOrUsername = String(req.body?.username || req.body?.email || '')
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || '');
  const user = await User.findOne({
    $or: [{ email: emailOrUsername }, { email: config.seedAdminEmail.toLowerCase() }],
  });
  if (!user || user.role !== 'admin') return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await user.verifyPassword(password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  return res.json({
    token: signToken(user),
    admin: { id: String(user._id), name: user.name, email: user.email },
  });
});

router.get('/dashboard', requireAuth(['admin']), async (_req, res) => {
  const [products, categories, users, orders, subscribers, revenueRows, discounts, banners, blogs] = await Promise.all([
    Product.countDocuments(),
    Category.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    Order.countDocuments(),
    Subscriber.countDocuments(),
    Order.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
    DiscountCode.countDocuments(),
    Banner.countDocuments(),
    Blog.countDocuments(),
  ]);
  res.json({
    metrics: {
      products,
      categories,
      users,
      orders,
      subscribers,
      discounts,
      banners,
      blogs,
      revenue: revenueRows?.[0]?.total || 0,
    },
  });
});

router.get('/subscribers', requireAuth(['admin']), async (_req, res) => {
  const rows = await Subscriber.find().sort({ createdAt: -1 }).lean();
  res.json(rows);
});

router.get('/users', requireAuth(['admin']), async (_req, res) => {
  const rows = await User.find({ role: 'customer' })
    .select('name email phone status createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean();
  res.json(rows);
});

router.get('/users/:id', requireAuth(['admin']), async (req, res) => {
  const row = await User.findById(req.params.id)
    .select('-passwordHash')
    .lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  const orders = await Order.find({ user: req.params.id }).sort({ createdAt: -1 }).lean();
  return res.json({ user: row, orders });
});

router.patch('/users/:id/status', requireAuth(['admin']), async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['active', 'blocked'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  )
    .select('name email status')
    .lean();
  if (!user) return res.status(404).json({ error: 'Not found' });
  return res.json(user);
});

router.get('/categories', requireAuth(['admin']), async (_req, res) => {
  const rows = await Category.find().sort({ createdAt: -1 }).lean();
  res.json(rows);
});

router.post('/categories', requireAuth(['admin']), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name required' });
  const slug = toSlug(req.body?.slug || name);
  const category = await Category.create({
    name,
    slug,
    description: String(req.body?.description || ''),
    imageUrl: String(req.body?.imageUrl || ''),
    isActive: req.body?.isActive !== false,
  });
  res.status(201).json(category);
});

router.put('/categories/:id', requireAuth(['admin']), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name required' });
  const slug = toSlug(req.body?.slug || name);
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    {
      name,
      slug,
      description: String(req.body?.description || ''),
      imageUrl: String(req.body?.imageUrl || ''),
      isActive: req.body?.isActive !== false,
    },
    { new: true }
  ).lean();
  if (!category) return res.status(404).json({ error: 'Not found' });
  res.json(category);
});

router.delete('/categories/:id', requireAuth(['admin']), async (req, res) => {
  const inUse = await Product.countDocuments({ category: req.params.id });
  if (inUse > 0) {
    return res.status(400).json({ error: 'Category has products. Reassign first.' });
  }
  const row = await Category.findByIdAndDelete(req.params.id).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.get('/products', requireAuth(['admin']), async (_req, res) => {
  const rows = await Product.find()
    .populate('category', 'name slug')
    .sort({ createdAt: -1 })
    .lean();
  res.json(rows);
});

router.post(
  '/uploads/products',
  requireAuth(['admin']),
  upload.array('images', 10),
  async (req, res) => {
    if (!r2Client) {
      return res.status(500).json({ error: 'Cloudflare R2 is not configured on server' });
    }
    const files = req.files || [];
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }
    const invalid = files.find((f) => !String(f.mimetype || '').startsWith('image/'));
    if (invalid) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const ext = fileExtFrom(file.originalname, file.mimetype);
        const key = `products/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        await r2Client.send(
          new PutObjectCommand({
            Bucket: config.r2Bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype || 'application/octet-stream',
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );
        return { key, url: buildR2Url(key), name: file.originalname };
      })
    );
    return res.status(201).json({ files: uploaded });
  }
);

router.post('/products', requireAuth(['admin']), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const slug = toSlug(req.body?.slug || name);
  const price = Number(req.body?.price);
  const imageUrl = String(req.body?.imageUrl || req.body?.image_url || '').trim();
  const description = String(req.body?.description || '').trim();
  const gallery = Array.isArray(req.body?.gallery)
    ? req.body.gallery.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const stock = Number(req.body?.stock || 0);
  const category = String(req.body?.category || '').trim();
  if (!name || Number.isNaN(price) || !category) {
    return res.status(400).json({ error: 'Name, price and category are required' });
  }
  const row = await Product.create({
    name,
    slug,
    price,
    imageUrl,
    imageAltText: String(req.body?.imageAltText || '').trim(),
    description,
    gallery,
    stock,
    sku: String(req.body?.sku || ''),
    compareAtPrice: Number(req.body?.compareAtPrice || 0),
    isActive: req.body?.isActive !== false,
    seoTitle: String(req.body?.seoTitle || '').trim(),
    seoDescription: String(req.body?.seoDescription || '').trim(),
    seoKeywords: String(req.body?.seoKeywords || '').trim(),
    seoCanonicalUrl: String(req.body?.seoCanonicalUrl || '').trim(),
    seoOgTitle: String(req.body?.seoOgTitle || '').trim(),
    seoOgDescription: String(req.body?.seoOgDescription || '').trim(),
    seoOgImageUrl: String(req.body?.seoOgImageUrl || '').trim(),
    seoRobots: String(req.body?.seoRobots || 'index,follow').trim() || 'index,follow',
    category,
  });
  res.json(row);
});

router.put('/products/:id', requireAuth(['admin']), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const slug = toSlug(req.body?.slug || name);
  const price = Number(req.body?.price);
  const imageUrl = String(req.body?.imageUrl || req.body?.image_url || '').trim();
  const description = String(req.body?.description || '').trim();
  const gallery = Array.isArray(req.body?.gallery)
    ? req.body.gallery.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const stock = Number(req.body?.stock || 0);
  const category = String(req.body?.category || '').trim();
  if (!name || Number.isNaN(price) || !category) {
    return res.status(400).json({ error: 'Name, price and category are required' });
  }
  const row = await Product.findByIdAndUpdate(
    req.params.id,
    {
      name,
      slug,
      price,
      imageUrl,
      imageAltText: String(req.body?.imageAltText || '').trim(),
      description,
      gallery,
      stock,
      category,
      sku: String(req.body?.sku || ''),
      compareAtPrice: Number(req.body?.compareAtPrice || 0),
      isActive: req.body?.isActive !== false,
      seoTitle: String(req.body?.seoTitle || '').trim(),
      seoDescription: String(req.body?.seoDescription || '').trim(),
      seoKeywords: String(req.body?.seoKeywords || '').trim(),
      seoCanonicalUrl: String(req.body?.seoCanonicalUrl || '').trim(),
      seoOgTitle: String(req.body?.seoOgTitle || '').trim(),
      seoOgDescription: String(req.body?.seoOgDescription || '').trim(),
      seoOgImageUrl: String(req.body?.seoOgImageUrl || '').trim(),
      seoRobots: String(req.body?.seoRobots || 'index,follow').trim() || 'index,follow',
    },
    { new: true }
  ).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.delete('/products/:id', requireAuth(['admin']), async (req, res) => {
  const inOrders = await Order.countDocuments({ 'items.product': req.params.id });
  if (inOrders > 0) return res.status(400).json({ error: 'Product has order history' });
  const deleted = await Product.findByIdAndDelete(req.params.id).lean();
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.get('/blogs', requireAuth(['admin']), async (_req, res) => {
  const rows = await Blog.find().sort({ createdAt: -1 }).lean();
  res.json(rows);
});

router.post('/blogs', requireAuth(['admin']), async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const slug = toSlug(req.body?.slug || title);
  if (!title) return res.status(400).json({ error: 'Blog title is required' });
  const status = String(req.body?.status || 'draft').trim() === 'published' ? 'published' : 'draft';
  const publishedAtInput = req.body?.publishedAt ? new Date(req.body.publishedAt) : null;
  const publishedAt = status === 'published'
    ? (publishedAtInput && !Number.isNaN(publishedAtInput.getTime()) ? publishedAtInput : new Date())
    : null;
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags
    : String(req.body?.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  const row = await Blog.create({
    title,
    slug,
    excerpt: String(req.body?.excerpt || '').trim(),
    content: String(req.body?.content || '').trim(),
    featuredImageUrl: String(req.body?.featuredImageUrl || '').trim(),
    featuredImageAlt: String(req.body?.featuredImageAlt || '').trim(),
    authorName: String(req.body?.authorName || 'Pet Square Team').trim() || 'Pet Square Team',
    category: String(req.body?.category || 'General').trim() || 'General',
    tags,
    isActive: req.body?.isActive !== false,
    status,
    publishedAt,
    seoTitle: String(req.body?.seoTitle || '').trim(),
    seoDescription: String(req.body?.seoDescription || '').trim(),
    seoKeywords: String(req.body?.seoKeywords || '').trim(),
    seoCanonicalUrl: String(req.body?.seoCanonicalUrl || '').trim(),
    seoOgTitle: String(req.body?.seoOgTitle || '').trim(),
    seoOgDescription: String(req.body?.seoOgDescription || '').trim(),
    seoOgImageUrl: String(req.body?.seoOgImageUrl || '').trim(),
    seoRobots: String(req.body?.seoRobots || 'index,follow').trim() || 'index,follow',
  });
  res.status(201).json(row);
});

router.put('/blogs/:id', requireAuth(['admin']), async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const slug = toSlug(req.body?.slug || title);
  if (!title) return res.status(400).json({ error: 'Blog title is required' });
  const status = String(req.body?.status || 'draft').trim() === 'published' ? 'published' : 'draft';
  const publishedAtInput = req.body?.publishedAt ? new Date(req.body.publishedAt) : null;
  const publishedAt = status === 'published'
    ? (publishedAtInput && !Number.isNaN(publishedAtInput.getTime()) ? publishedAtInput : new Date())
    : null;
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags
    : String(req.body?.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

  const row = await Blog.findByIdAndUpdate(
    req.params.id,
    {
      title,
      slug,
      excerpt: String(req.body?.excerpt || '').trim(),
      content: String(req.body?.content || '').trim(),
      featuredImageUrl: String(req.body?.featuredImageUrl || '').trim(),
      featuredImageAlt: String(req.body?.featuredImageAlt || '').trim(),
      authorName: String(req.body?.authorName || 'Pet Square Team').trim() || 'Pet Square Team',
      category: String(req.body?.category || 'General').trim() || 'General',
      tags,
      isActive: req.body?.isActive !== false,
      status,
      publishedAt,
      seoTitle: String(req.body?.seoTitle || '').trim(),
      seoDescription: String(req.body?.seoDescription || '').trim(),
      seoKeywords: String(req.body?.seoKeywords || '').trim(),
      seoCanonicalUrl: String(req.body?.seoCanonicalUrl || '').trim(),
      seoOgTitle: String(req.body?.seoOgTitle || '').trim(),
      seoOgDescription: String(req.body?.seoOgDescription || '').trim(),
      seoOgImageUrl: String(req.body?.seoOgImageUrl || '').trim(),
      seoRobots: String(req.body?.seoRobots || 'index,follow').trim() || 'index,follow',
    },
    { new: true }
  ).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.delete('/blogs/:id', requireAuth(['admin']), async (req, res) => {
  const row = await Blog.findByIdAndDelete(req.params.id).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.get('/orders', requireAuth(['admin']), async (_req, res) => {
  const rows = await Order.find()
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .lean();
  res.json(rows);
});

router.get('/orders/:id', requireAuth(['admin']), async (req, res) => {
  const row = await Order.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('items.product', 'name sku')
    .lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.patch('/orders/:id', requireAuth(['admin']), async (req, res) => {
  const status = String(req.body?.status || '');
  const paymentStatus = String(req.body?.paymentStatus || '');
  const update = {};
  if (status) update.status = status;
  if (paymentStatus) update.paymentStatus = paymentStatus;
  const row = await Order.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.delete('/orders/:id', requireAuth(['admin']), async (req, res) => {
  const row = await Order.findByIdAndDelete(req.params.id).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.post('/orders', requireAuth(['admin']), async (req, res) => {
  const userId = String(req.body?.userId || '').trim();
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const shipping = req.body?.shippingAddress || {};
  if (!userId) return res.status(400).json({ error: 'Customer is required' });
  if (!items.length) return res.status(400).json({ error: 'Order items required' });
  const user = await User.findOne({ _id: userId, role: 'customer' }).lean();
  if (!user) return res.status(400).json({ error: 'Invalid customer' });

  const productIds = items.map((i) => String(i.product || ''));
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  if (!products.length) return res.status(400).json({ error: 'Invalid products' });

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const normalizedItems = items
    .map((item) => {
      const product = productMap.get(String(item.product || ''));
      const qty = Number(item.qty || 0);
      if (!product || !Number.isFinite(qty) || qty <= 0) return null;
      return {
        product: product._id,
        name: product.name,
        qty: Math.floor(qty),
        price: Number(product.price || 0),
        imageUrl: product.imageUrl || '',
      };
    })
    .filter(Boolean);
  if (!normalizedItems.length) return res.status(400).json({ error: 'No valid order items' });

  const subtotal = normalizedItems.reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.qty || 0)), 0);
  const shippingFee = Number(req.body?.shippingFee || 0);
  const tax = Number(req.body?.tax || 0);
  const discountAmount = Number(req.body?.discountAmount || 0);
  const total = Math.max(0, subtotal + shippingFee + tax - discountAmount);

  const requiredShipping = ['name', 'email', 'line1', 'city', 'zip', 'country'];
  for (const field of requiredShipping) {
    if (!String(shipping?.[field] || '').trim()) {
      return res.status(400).json({ error: `Shipping ${field} is required` });
    }
  }

  const orderNo = `PS-${Date.now().toString().slice(-8)}`;
  const row = await Order.create({
    orderNo,
    user: user._id,
    status: String(req.body?.status || 'pending'),
    paymentMethod: String(req.body?.paymentMethod || 'manual'),
    paymentStatus: String(req.body?.paymentStatus || 'pending'),
    items: normalizedItems,
    subtotal,
    shippingFee: Number.isFinite(shippingFee) ? shippingFee : 0,
    tax: Number.isFinite(tax) ? tax : 0,
    discountCode: String(req.body?.discountCode || '').trim(),
    discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
    total,
    shippingAddress: {
      name: String(shipping.name || '').trim(),
      email: String(shipping.email || '').trim(),
      phone: String(shipping.phone || '').trim(),
      line1: String(shipping.line1 || '').trim(),
      line2: String(shipping.line2 || '').trim(),
      city: String(shipping.city || '').trim(),
      state: String(shipping.state || '').trim(),
      zip: String(shipping.zip || '').trim(),
      country: String(shipping.country || '').trim(),
    },
    note: String(req.body?.note || ''),
  });
  res.status(201).json(row);
});

router.get('/pages', requireAuth(['admin']), async (_req, res) => {
  const dirRows = await fs.readdir(webPagesDir, { withFileTypes: true });
  const rows = dirRows
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsx'))
    .map((entry) => ({
      name: entry.name,
      route: `/${entry.name.replace(/\.jsx$/, '').toLowerCase()}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(rows);
});

router.get('/pages/:name', requireAuth(['admin']), async (req, res) => {
  const fileName = safePageFileName(req.params.name);
  if (!fileName) return res.status(400).json({ error: 'Invalid page name' });
  const filePath = path.join(webPagesDir, fileName);
  const content = await fs.readFile(filePath, 'utf8');
  res.json({ name: fileName, content });
});

router.put('/pages/:name', requireAuth(['admin']), async (req, res) => {
  const fileName = safePageFileName(req.params.name);
  if (!fileName) return res.status(400).json({ error: 'Invalid page name' });
  const content = String(req.body?.content || '');
  const filePath = path.join(webPagesDir, fileName);
  await fs.writeFile(filePath, content, 'utf8');
  res.json({ ok: true, name: fileName });
});

router.get('/discounts', requireAuth(['admin']), async (_req, res) => {
  const rows = await DiscountCode.find().sort({ createdAt: -1 }).lean();
  res.json(rows);
});

router.post('/discounts', requireAuth(['admin']), async (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const type = String(req.body?.type || 'percent');
  const value = Number(req.body?.value);
  if (!code || Number.isNaN(value)) {
    return res.status(400).json({ error: 'Code and value are required' });
  }
  const row = await DiscountCode.create({
    code,
    type: type === 'fixed' ? 'fixed' : 'percent',
    value,
    minOrderAmount: Number(req.body?.minOrderAmount || 0),
    maxDiscountAmount: Number(req.body?.maxDiscountAmount || 0),
    usageLimit: Number(req.body?.usageLimit || 0),
    isActive: req.body?.isActive !== false,
    startsAt: req.body?.startsAt || null,
    endsAt: req.body?.endsAt || null,
  });
  res.status(201).json(row);
});

router.put('/discounts/:id', requireAuth(['admin']), async (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const value = Number(req.body?.value);
  if (!code || Number.isNaN(value)) {
    return res.status(400).json({ error: 'Code and value are required' });
  }
  const row = await DiscountCode.findByIdAndUpdate(
    req.params.id,
    {
      code,
      type: req.body?.type === 'fixed' ? 'fixed' : 'percent',
      value,
      minOrderAmount: Number(req.body?.minOrderAmount || 0),
      maxDiscountAmount: Number(req.body?.maxDiscountAmount || 0),
      usageLimit: Number(req.body?.usageLimit || 0),
      isActive: req.body?.isActive !== false,
      startsAt: req.body?.startsAt || null,
      endsAt: req.body?.endsAt || null,
    },
    { new: true }
  ).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.delete('/discounts/:id', requireAuth(['admin']), async (req, res) => {
  const row = await DiscountCode.findByIdAndDelete(req.params.id).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.get('/banners', requireAuth(['admin']), async (_req, res) => {
  const rows = await Banner.find().sort({ priority: -1, createdAt: -1 }).lean();
  res.json(rows);
});

router.post('/banners', requireAuth(['admin']), async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const imageUrl = String(req.body?.imageUrl || '').trim();
  if (!title || !imageUrl) return res.status(400).json({ error: 'Title and imageUrl are required' });
  const row = await Banner.create({
    title,
    subtitle: String(req.body?.subtitle || ''),
    imageUrl,
    ctaText: String(req.body?.ctaText || ''),
    ctaLink: String(req.body?.ctaLink || ''),
    position: String(req.body?.position || 'home-hero'),
    priority: Number(req.body?.priority || 0),
    isActive: req.body?.isActive !== false,
    startsAt: req.body?.startsAt || null,
    endsAt: req.body?.endsAt || null,
  });
  res.status(201).json(row);
});

router.put('/banners/:id', requireAuth(['admin']), async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const imageUrl = String(req.body?.imageUrl || '').trim();
  if (!title || !imageUrl) return res.status(400).json({ error: 'Title and imageUrl are required' });
  const row = await Banner.findByIdAndUpdate(
    req.params.id,
    {
      title,
      subtitle: String(req.body?.subtitle || ''),
      imageUrl,
      ctaText: String(req.body?.ctaText || ''),
      ctaLink: String(req.body?.ctaLink || ''),
      position: String(req.body?.position || 'home-hero'),
      priority: Number(req.body?.priority || 0),
      isActive: req.body?.isActive !== false,
      startsAt: req.body?.startsAt || null,
      endsAt: req.body?.endsAt || null,
    },
    { new: true }
  ).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.delete('/banners/:id', requireAuth(['admin']), async (req, res) => {
  const row = await Banner.findByIdAndDelete(req.params.id).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
