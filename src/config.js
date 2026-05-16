import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3002),
  mongoUri:process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pet_square',
  jwtSecret: process.env.JWT_SECRET || 'vikaspetvikas',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@petsquare.local',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'admin123',
  seedAdminName: process.env.SEED_ADMIN_NAME || 'Pet Square Admin',
  siteUrl: String(process.env.SITE_URL || 'http://localhost:5173').trim(),
  r2AccountId: String(process.env.CLOUDFLARE_R2_ACCOUNT_ID || '').trim(),
  r2AccessKeyId: String(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '').trim(),
  r2SecretAccessKey: String(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '').trim(),
  r2Bucket: String(process.env.CLOUDFLARE_R2_BUCKET || '').trim(),
  r2PublicBaseUrl: String(process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || '').trim(),
};
