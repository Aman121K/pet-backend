import { Router } from 'express';
import { Category } from '../models/Category.js';
import { DiscountCode } from '../models/DiscountCode.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Subscriber } from '../models/Subscriber.js';
import { User } from '../models/User.js';
import { Banner } from '../models/Banner.js';
import { Blog } from '../models/Blog.js';
import { requireAuth, signToken } from '../utils/auth.js';

const router = Router();

router.post('/subscribe', (req, res) => {
  (async () => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    try {
      await Subscriber.create({ email });
      return res.json({ ok: true });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: 'Already subscribed' });
      console.error(e);
      return res.status(500).json({ error: 'Server error' });
    }
  })();
});

router.post('/auth/register', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!name || !email || password.length < 6) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  const exists = await User.findOne({ email }).lean();
  if (exists) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role: 'customer' });
  return res.json({
    token: signToken(user),
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
  });
});

router.post('/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = await User.findOne({ email });
  if (!user || user.role !== 'customer') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = await user.verifyPassword(password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  return res.json({
    token: signToken(user),
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
  });
});

router.get('/categories', async (_req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
  res.json(categories);
});

router.get('/banners', async (req, res) => {
  const position = String(req.query.position || '').trim();
  const now = new Date();
  const query = {
    isActive: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  };
  if (position) query.position = position;
  const rows = await Banner.find(query).sort({ priority: -1, createdAt: -1 }).lean();
  res.json(rows);
});

router.get('/products', async (req, res) => {
  const query = { isActive: true };
  const category = String(req.query.category || '').trim();
  const search = String(req.query.search || '').trim();
  if (category) {
    const cat = await Category.findOne({ slug: category }).lean();
    if (cat) query.category = cat._id;
  }
  if (search) query.name = { $regex: search, $options: 'i' };
  const rows = await Product.find(query)
    .populate('category', 'name slug')
    .sort({ createdAt: -1 })
    .lean();
  res.json(rows);
});

router.get('/products/:slug', async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true })
    .populate('category', 'name slug')
    .lean();
  if (!product) return res.status(404).json({ error: 'Not found' });
  return res.json(product);
});

router.get('/blogs', async (req, res) => {
  const now = new Date();
  const search = String(req.query.search || '').trim();
  const category = String(req.query.category || '').trim();
  const query = {
    isActive: true,
    status: 'published',
    $or: [{ publishedAt: null }, { publishedAt: { $lte: now } }],
  };
  if (search) query.title = { $regex: search, $options: 'i' };
  if (category) query.category = category;
  const rows = await Blog.find(query)
    .select('-content')
    .sort({ publishedAt: -1, createdAt: -1 })
    .lean();
  res.json(rows);
});

router.get('/blogs/:slug', async (req, res) => {
  const now = new Date();
  const row = await Blog.findOne({
    slug: req.params.slug,
    isActive: true,
    status: 'published',
    $or: [{ publishedAt: null }, { publishedAt: { $lte: now } }],
  }).lean();
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json(row);
});

router.post('/discounts/validate', async (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const subtotal = Number(req.body?.subtotal || 0);
  if (!code || Number.isNaN(subtotal)) {
    return res.status(400).json({ error: 'Code and subtotal are required' });
  }
  const discount = await DiscountCode.findOne({ code }).lean();
  if (!discount) return res.status(404).json({ error: 'Discount code not found' });
  const now = new Date();
  if (!discount.isActive) return res.status(400).json({ error: 'Discount code inactive' });
  if (discount.startsAt && now < new Date(discount.startsAt)) {
    return res.status(400).json({ error: 'Discount not started yet' });
  }
  if (discount.endsAt && now > new Date(discount.endsAt)) {
    return res.status(400).json({ error: 'Discount code expired' });
  }
  if (discount.usageLimit > 0 && discount.usedCount >= discount.usageLimit) {
    return res.status(400).json({ error: 'Discount usage limit reached' });
  }
  if (subtotal < Number(discount.minOrderAmount || 0)) {
    return res.status(400).json({
      error: `Minimum order amount is ${Number(discount.minOrderAmount).toFixed(2)}`,
    });
  }
  let amount =
    discount.type === 'percent'
      ? (subtotal * Number(discount.value || 0)) / 100
      : Number(discount.value || 0);
  if (discount.maxDiscountAmount > 0) {
    amount = Math.min(amount, Number(discount.maxDiscountAmount));
  }
  amount = Number(amount.toFixed(2));
  return res.json({
    code: discount.code,
    type: discount.type,
    value: discount.value,
    discountAmount: amount,
  });
});

router.post('/orders', requireAuth(['customer']), async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const shippingAddress = req.body?.shippingAddress || {};
  if (!items.length) return res.status(400).json({ error: 'Order items required' });
  const productIds = items.map((x) => x.productId).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  if (!products.length) return res.status(400).json({ error: 'Invalid products' });

  const normalizedItems = items
    .map((item) => {
      const p = products.find((x) => String(x._id) === String(item.productId));
      if (!p) return null;
      const qty = Math.max(1, Number(item.qty || 1));
      return {
        product: p._id,
        name: p.name,
        qty,
        price: p.price,
        imageUrl: p.imageUrl,
      };
    })
    .filter(Boolean);

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const shippingFee = subtotal >= 100 ? 0 : 6;
  const discountCodeInput = String(req.body?.discountCode || '').trim().toUpperCase();
  let discountAmount = 0;
  let discountCode = '';
  if (discountCodeInput) {
    const discount = await DiscountCode.findOne({ code: discountCodeInput });
    if (
      discount &&
      discount.isValidNow() &&
      subtotal >= Number(discount.minOrderAmount || 0)
    ) {
      discountCode = discount.code;
      discountAmount =
        discount.type === 'percent'
          ? (subtotal * Number(discount.value || 0)) / 100
          : Number(discount.value || 0);
      if (discount.maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, Number(discount.maxDiscountAmount));
      }
      discountAmount = Number(discountAmount.toFixed(2));
      discount.usedCount += 1;
      await discount.save();
    }
  }
  const taxable = Math.max(0, subtotal - discountAmount);
  const tax = Number((taxable * 0.05).toFixed(2));
  const total = Number((taxable + shippingFee + tax).toFixed(2));
  const orderNo = `PS-${Date.now().toString().slice(-8)}`;

  const requiredFields = ['name', 'email', 'line1', 'city', 'zip', 'country'];
  for (const field of requiredFields) {
    if (!String(shippingAddress[field] || '').trim()) {
      return res.status(400).json({ error: `Shipping ${field} is required` });
    }
  }

  const order = await Order.create({
    orderNo,
    user: req.auth.userId,
    items: normalizedItems,
    subtotal,
    shippingFee,
    tax,
    discountCode,
    discountAmount,
    total,
    shippingAddress,
    note: String(req.body?.note || ''),
  });
  return res.status(201).json(order);
});

router.get('/me/orders', requireAuth(['customer']), async (req, res) => {
  const rows = await Order.find({ user: req.auth.userId })
    .sort({ createdAt: -1 })
    .lean();
  res.json(rows);
});

export default router;
