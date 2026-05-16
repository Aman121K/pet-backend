import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    excerpt: { type: String, default: '', trim: true },
    content: { type: String, default: '' },
    featuredImageUrl: { type: String, default: '', trim: true },
    featuredImageAlt: { type: String, default: '', trim: true },
    authorName: { type: String, default: 'Pet Square Team', trim: true },
    category: { type: String, default: 'General', trim: true },
    tags: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date, default: null },
    seoTitle: { type: String, default: '', trim: true },
    seoDescription: { type: String, default: '', trim: true },
    seoKeywords: { type: String, default: '', trim: true },
    seoCanonicalUrl: { type: String, default: '', trim: true },
    seoOgTitle: { type: String, default: '', trim: true },
    seoOgDescription: { type: String, default: '', trim: true },
    seoOgImageUrl: { type: String, default: '', trim: true },
    seoRobots: { type: String, default: 'index,follow', trim: true },
  },
  { timestamps: true }
);

blogSchema.index({ status: 1, isActive: 1, publishedAt: -1 });

export const Blog = mongoose.model('Blog', blogSchema);
