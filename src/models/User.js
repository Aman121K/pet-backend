import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'customer'], default: 'customer' },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
      country: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

userSchema.methods.verifyPassword = function verifyPassword(rawPassword) {
  return bcrypt.compare(rawPassword, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(rawPassword) {
  return bcrypt.hash(rawPassword, 10);
};

export const User = mongoose.model('User', userSchema);

