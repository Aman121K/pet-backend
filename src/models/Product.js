import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    sku: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    imageAltText: { type: String, default: '', trim: true },
    gallery: [{ type: String }],
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    seoTitle: { type: String, default: '', trim: true },
    seoDescription: { type: String, default: '', trim: true },
    seoKeywords: { type: String, default: '', trim: true },
    seoCanonicalUrl: { type: String, default: '', trim: true },
    seoOgTitle: { type: String, default: '', trim: true },
    seoOgDescription: { type: String, default: '', trim: true },
    seoOgImageUrl: { type: String, default: '', trim: true },
    seoRobots: { type: String, default: 'index,follow', trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
  },
  { timestamps: true }
);

export const Product = mongoose.model('Product', productSchema);
