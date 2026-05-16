import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '' },
    imageUrl: { type: String, required: true, trim: true },
    ctaText: { type: String, default: '' },
    ctaLink: { type: String, default: '' },
    position: { type: String, enum: ['home-hero', 'home-mid', 'shop-top'], default: 'home-hero' },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Banner = mongoose.model('Banner', bannerSchema);

