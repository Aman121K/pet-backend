import { Category } from './models/Category.js';
import { DiscountCode } from './models/DiscountCode.js';
import { Product } from './models/Product.js';
import { User } from './models/User.js';
import { Banner } from './models/Banner.js';
import { Blog } from './models/Blog.js';
import { config } from './config.js';

export async function ensureSeedData() {
  const existingAdmin = await User.findOne({ role: 'admin' }).lean();
  if (!existingAdmin) {
    const passwordHash = await User.hashPassword(config.seedAdminPassword);
    await User.create({
      name: config.seedAdminName,
      email: config.seedAdminEmail.toLowerCase(),
      passwordHash,
      role: 'admin',
      status: 'active',
    });
  }

  const countCats = await Category.countDocuments();
  if (countCats === 0) {
    await Category.insertMany([
      { name: 'Dog Food', slug: 'dog-food', description: 'Nutritious dog food.' },
      { name: 'Cat Food', slug: 'cat-food', description: 'Healthy cat food.' },
      { name: 'Accessories', slug: 'accessories', description: 'Daily pet essentials.' },
    ]);
  }

  const countProducts = await Product.countDocuments();
  if (countProducts === 0) {
    const dogFood = await Category.findOne({ slug: 'dog-food' }).lean();
    const catFood = await Category.findOne({ slug: 'cat-food' }).lean();
    const accessories = await Category.findOne({ slug: 'accessories' }).lean();
    await Product.insertMany([
      {
        name: 'Modern Pet House Bed',
        slug: 'modern-pet-house-bed',
        sku: 'PS-HOUSE-001',
        description: 'Cozy wooden house bed for small dogs.',
        imageUrl: '/images/product-1.jpg',
        price: 94.99,
        compareAtPrice: 119,
        stock: 24,
        category: accessories?._id,
      },
      {
        name: 'Grain-Free Salmon Kibble',
        slug: 'grain-free-salmon-kibble',
        sku: 'PS-DOG-002',
        description: 'Nutrition for shiny coat and healthy joints.',
        imageUrl: '/images/product-2.jpg',
        price: 48.5,
        compareAtPrice: 59,
        stock: 40,
        category: dogFood?._id,
      },
      {
        name: 'Interactive Cat Wand',
        slug: 'interactive-cat-wand',
        sku: 'PS-CAT-003',
        description: 'Feather teaser to keep cats active indoors.',
        imageUrl: '/images/product-3.jpg',
        price: 16.99,
        compareAtPrice: 22,
        stock: 75,
        category: catFood?._id,
      },
    ]);
  }

  const countDiscounts = await DiscountCode.countDocuments();
  if (countDiscounts === 0) {
    await DiscountCode.create({
      code: 'WELCOME20',
      type: 'percent',
      value: 20,
      minOrderAmount: 20,
      maxDiscountAmount: 40,
      isActive: true,
    });
  }

  const countBanners = await Banner.countDocuments();
  if (countBanners === 0) {
    await Banner.create({
      title: 'Spring Sale',
      subtitle: 'Save up to 20% on selected items',
      imageUrl: '/images/product-2.jpg',
      ctaText: 'Shop now',
      ctaLink: '/shop',
      position: 'home-hero',
      priority: 1,
      isActive: true,
    });
  }

  const countBlogs = await Blog.countDocuments();
  if (countBlogs === 0) {
    await Blog.insertMany([
      {
        title: 'Pet Nutrition 101: Building Better Meals',
        slug: 'pet-nutrition-101',
        excerpt: 'Learn how to read labels and pick balanced ingredients for dogs and cats.',
        content: '<p>Balanced nutrition is the foundation of long-term pet health. Start by checking ingredient quality and protein source.</p>',
        featuredImageUrl: '/images/product-1.jpg',
        featuredImageAlt: 'Healthy pet food in a bowl',
        authorName: 'Pet Square Team',
        category: 'Nutrition',
        tags: ['pet food', 'nutrition'],
        status: 'published',
        isActive: true,
        publishedAt: new Date(),
      },
      {
        title: 'Training Basics That Work Every Day',
        slug: 'training-basics',
        excerpt: 'Simple routines and reward timing tips to improve everyday behavior.',
        content: '<p>Consistency and positive reinforcement are key. Keep sessions short and repeat cues in similar contexts.</p>',
        featuredImageUrl: '/images/product-2.jpg',
        featuredImageAlt: 'Dog training session',
        authorName: 'Pet Square Team',
        category: 'Training',
        tags: ['training', 'pets'],
        status: 'published',
        isActive: true,
        publishedAt: new Date(),
      },
    ]);
  }
}
