require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');
const { v2: cloudinary } = require('cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tachshitim123';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const FOLDER = 'jewelry-gallery';
const CATS_PUBLIC_ID = `${FOLDER}/categories`;
const DEFAULT_CATS = ['עגילים', 'שרשראות', 'טבעות', 'צמידים', 'סטים'];

const sessions = new Set();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });
}

async function getCategories() {
  try {
    const resource = await cloudinary.api.resource(CATS_PUBLIC_ID, { resource_type: 'raw' });
    const res = await fetch(resource.secure_url + '?_=' + Date.now());
    return await res.json();
  } catch {
    return DEFAULT_CATS;
  }
}

async function saveCategories(cats) {
  const buffer = Buffer.from(JSON.stringify(cats));
  await uploadToCloudinary(buffer, {
    public_id: CATS_PUBLIC_ID,
    resource_type: 'raw',
    overwrite: true,
  });
}

async function getAllItems() {
  const result = await cloudinary.api.resources({
    type: 'upload',
    prefix: `${FOLDER}/items/`,
    context: true,
    max_results: 500,
  });

  return result.resources
    .map(r => ({
      id: r.public_id.split('/').pop(),
      publicId: r.public_id,
      name: r.context?.custom?.name || '',
      description: r.context?.custom?.description || '',
      category: r.context?.custom?.category || '',
      image: r.secure_url,
      createdAt: r.created_at,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function requireAuth(req, res, next) {
  const token = req.headers['x-session-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'לא מחובר' });
  }
  next();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Public routes
app.get('/api/items', async (req, res) => {
  try {
    let items = await getAllItems();
    if (req.query.category) {
      items = items.filter(i => i.category === req.query.category);
    }
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בטעינת פריטים' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    res.json(await getCategories());
  } catch {
    res.json(DEFAULT_CATS);
  }
});

// Auth
app.post('/api/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'סיסמה שגויה' });
  }
  const token = uuidv4();
  sessions.add(token);
  res.json({ token });
});

app.post('/api/logout', requireAuth, (req, res) => {
  sessions.delete(req.headers['x-session-token']);
  res.json({ ok: true });
});

// Admin routes
app.post('/api/items', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'חסרה תמונה' });
  const { name, description, category } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'שם וקטגוריה הם שדות חובה' });

  try {
    const id = uuidv4();
    const result = await uploadToCloudinary(req.file.buffer, {
      public_id: `${FOLDER}/items/${id}`,
      context: { name, description: description || '', category },
    });
    res.json({
      id,
      publicId: result.public_id,
      name,
      description: description || '',
      category,
      image: result.secure_url,
      createdAt: result.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בהעלאה לענן' });
  }
});

app.delete('/api/items/:id', requireAuth, async (req, res) => {
  try {
    await cloudinary.uploader.destroy(`${FOLDER}/items/${req.params.id}`);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'שגיאה במחיקה' });
  }
});

app.post('/api/categories', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'שם קטגוריה נדרש' });
  const cats = await getCategories();
  if (cats.includes(name)) return res.status(400).json({ error: 'קטגוריה כבר קיימת' });
  cats.push(name);
  await saveCategories(cats);
  res.json(cats);
});

app.delete('/api/categories/:name', requireAuth, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const cats = (await getCategories()).filter(c => c !== name);
  await saveCategories(cats);
  res.json(cats);
});

app.listen(PORT, () => {
  console.log(`גלריית תכשיטים רצה בכתובת http://localhost:${PORT}`);
});
