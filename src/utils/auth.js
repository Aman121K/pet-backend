import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';

export function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: '12h' }
  );
}

export function requireAuth(roles = []) {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7)
        : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(payload.sub).lean();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      if (roles.length && !roles.includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.auth = { userId: String(user._id), role: user.role, email: user.email };
      return next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

