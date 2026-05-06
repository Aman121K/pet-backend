import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`Pet SQUARE API listening on http://localhost:${PORT}`);
});
