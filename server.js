require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');
const { v2: cloudinary } = require('cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '2222';

const DATA_DIR   = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const ITEMS_FILE  = path.join(DATA_DIR, 'items.json');
const CATS_FILE   = path.join(DATA_DIR, 'categories.json');
const HERO_FILE   = path.join(DATA_DIR, 'hero.json');

const DEFAULT_HERO = {
  slots: [
    { url: 'https://images.unsplash.com/photo-1746211516723-c4cd447ec665?w=900&h=1100&fit=crop&q=85', position: 'center center', zoom: 100 },
    { url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=700&h=540&fit=crop&q=85', position: 'center center', zoom: 100 },
    { url: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=700&h=540&fit=crop&q=85', position: 'center center', zoom: 100 },
  ],
  colLeft: 50,
  rowTop: 50,
};

// ── Storage mode ──────────────────────────────────────────────────────────────
const USE_CLOUD = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (USE_CLOUD) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('Storage: Cloudinary');
} else {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('Storage: local files (set CLOUDINARY_* env vars to use cloud)');
}

// ── Multer ────────────────────────────────────────────────────────────────────
const FILE_FILTER = (req, file, cb) => {
  cb(null, file.mimetype.startsWith('image/'));
};

const upload = USE_CLOUD
  ? multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: FILE_FILTER })
  : multer({
      storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, UPLOADS_DIR),
        filename:    (_, file, cb) => cb(null, uuidv4() + path.extname(file.originalname).toLowerCase()),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: FILE_FILTER,
    });

// ── Local helpers ─────────────────────────────────────────────────────────────
const readJSON  = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');

// ── Cloudinary helpers ────────────────────────────────────────────────────────
const FOLDER     = 'jewelry-gallery';
const CATS_ID    = `${FOLDER}/categories`;
const DEFAULT_CATS = ['עגילים', 'שרשראות', 'טבעות', 'צמידים', 'סטים'];

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, r) =>
      err ? reject(err) : resolve(r));
    Readable.from(buffer).pipe(stream);
  });
}

async function cloudGetCategories() {
  try {
    const r = await cloudinary.api.resource(CATS_ID, { resource_type: 'raw' });
    const res = await fetch(r.secure_url + '?_=' + Date.now());
    return await res.json();
  } catch { return DEFAULT_CATS; }
}

async function cloudSaveCategories(cats) {
  await uploadToCloudinary(Buffer.from(JSON.stringify(cats)), {
    public_id: CATS_ID, resource_type: 'raw', overwrite: true,
  });
}

async function cloudGetItems() {
  const result = await cloudinary.api.resources({
    type: 'upload', prefix: `${FOLDER}/items/`, context: true, max_results: 500,
  });
  return result.resources
    .map(r => ({
      id:          r.public_id.split('/').pop(),
      publicId:    r.public_id,
      name:        r.context?.custom?.name || '',
      description: r.context?.custom?.description || '',
      category:    r.context?.custom?.category || '',
      bestSeller:  r.context?.custom?.bestSeller === 'true',
      image:       r.secure_url,
      createdAt:   r.created_at,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const sessions = new Set();

function requireAuth(req, res, next) {
  if (!sessions.has(req.headers['x-session-token'])) {
    return res.status(401).json({ error: 'לא מחובר' });
  }
  next();
}

// ── Express setup ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Public routes ─────────────────────────────────────────────────────────────
app.get('/api/items', async (req, res) => {
  try {
    let items = USE_CLOUD ? await cloudGetItems() : readJSON(ITEMS_FILE);
    if (req.query.category) items = items.filter(i => i.category === req.query.category);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת פריטים' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    res.json(USE_CLOUD ? await cloudGetCategories() : readJSON(CATS_FILE));
  } catch { res.json(DEFAULT_CATS); }
});

function readHero() {
  if (!fs.existsSync(HERO_FILE)) return DEFAULT_HERO;
  const h = readJSON(HERO_FILE);
  // migrate old array format
  if (Array.isArray(h)) return { slots: h, colLeft: 50, rowTop: 50 };
  return h;
}

app.get('/api/hero', (req, res) => {
  try { res.json(readHero()); } catch { res.json(DEFAULT_HERO); }
});

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'סיסמה שגויה' });
  const token = uuidv4();
  sessions.add(token);
  res.json({ token });
});

app.post('/api/logout', requireAuth, (req, res) => {
  sessions.delete(req.headers['x-session-token']);
  res.json({ ok: true });
});

// ── Admin — items ─────────────────────────────────────────────────────────────
app.post('/api/items', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'חסרה תמונה' });
  const { name, description = '', category, bestSeller } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'שם וקטגוריה הם שדות חובה' });
  const isBestSeller = bestSeller === 'true' || bestSeller === true;

  try {
    if (USE_CLOUD) {
      const id = uuidv4();
      const result = await uploadToCloudinary(req.file.buffer, {
        public_id: `${FOLDER}/items/${id}`,
        context: { name, description, category, bestSeller: String(isBestSeller) },
      });
      return res.json({ id, name, description, category, bestSeller: isBestSeller, image: result.secure_url, createdAt: result.created_at });
    }

    // Local
    const items = readJSON(ITEMS_FILE);
    const item = {
      id:    uuidv4(),
      name,
      description,
      category,
      bestSeller: isBestSeller,
      image:     '/uploads/' + req.file.filename,
      createdAt: new Date().toISOString(),
    };
    items.unshift(item);
    writeJSON(ITEMS_FILE, items);
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהעלאה' });
  }
});

app.put('/api/items/:id/bestseller', requireAuth, async (req, res) => {
  const { bestSeller } = req.body;
  try {
    if (USE_CLOUD) {
      const r = await cloudinary.api.resource(`${FOLDER}/items/${req.params.id}`, { context: true });
      const ctx = r.context?.custom || {};
      await cloudinary.api.update(`${FOLDER}/items/${req.params.id}`, {
        context: { ...ctx, bestSeller: String(bestSeller) },
      });
      return res.json({ ok: true });
    }
    const items = readJSON(ITEMS_FILE);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'לא נמצא' });
    items[idx].bestSeller = bestSeller;
    writeJSON(ITEMS_FILE, items);
    res.json(items[idx]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה' }); }
});

app.put('/api/hero/:slot', requireAuth, upload.single('image'), async (req, res) => {
  const slot = parseInt(req.params.slot);
  if (isNaN(slot) || slot < 0 || slot > 2) return res.status(400).json({ error: 'slot לא תקין' });
  if (!req.file) return res.status(400).json({ error: 'חסרה תמונה' });
  try {
    const hero = readHero();
    const current = hero.slots[slot] || { position: 'center center', zoom: 100 };
    if (USE_CLOUD) {
      const result = await uploadToCloudinary(req.file.buffer, { public_id: `${FOLDER}/hero/${slot}`, overwrite: true });
      current.url = result.secure_url;
    } else {
      current.url = '/uploads/' + req.file.filename;
    }
    hero.slots[slot] = current;
    writeJSON(HERO_FILE, hero);
    res.json(current);
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה בהעלאה' }); }
});

app.patch('/api/hero/:slot', requireAuth, async (req, res) => {
  const slot = parseInt(req.params.slot);
  if (isNaN(slot) || slot < 0 || slot > 2) return res.status(400).json({ error: 'slot לא תקין' });
  try {
    const hero = readHero();
    const current = hero.slots[slot] || { position: 'center center', zoom: 100 };
    if (req.body.position !== undefined) current.position = req.body.position;
    if (req.body.zoom     !== undefined) current.zoom     = parseFloat(req.body.zoom);
    hero.slots[slot] = current;
    writeJSON(HERO_FILE, hero);
    res.json(current);
  } catch (err) { res.status(500).json({ error: 'שגיאה' }); }
});

app.patch('/api/hero', requireAuth, async (req, res) => {
  try {
    const hero = readHero();
    if (req.body.colLeft !== undefined) hero.colLeft = parseFloat(req.body.colLeft);
    if (req.body.rowTop  !== undefined) hero.rowTop  = parseFloat(req.body.rowTop);
    writeJSON(HERO_FILE, hero);
    res.json({ colLeft: hero.colLeft, rowTop: hero.rowTop });
  } catch (err) { res.status(500).json({ error: 'שגיאה' }); }
});

app.put('/api/items/:id', requireAuth, upload.single('image'), async (req, res) => {
  const { name, description = '', category } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'שם וקטגוריה הם שדות חובה' });
  try {
    if (USE_CLOUD) {
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, {
          public_id: `${FOLDER}/items/${req.params.id}`,
          overwrite: true,
          context: { name, description, category },
        });
        return res.json({ id: req.params.id, name, description, category, image: result.secure_url });
      }
      await cloudinary.api.update(`${FOLDER}/items/${req.params.id}`, { context: { name, description, category } });
      const r = await cloudinary.api.resource(`${FOLDER}/items/${req.params.id}`);
      return res.json({ id: req.params.id, name, description, category, image: r.secure_url });
    }
    const items = readJSON(ITEMS_FILE);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'פריט לא נמצא' });
    const oldImage = items[idx].image;
    items[idx] = { ...items[idx], name, description, category };
    if (req.file) {
      const oldPath = path.join(__dirname, 'public', oldImage);
      if (oldImage.startsWith('/uploads/') && fs.existsSync(path.join(__dirname, oldImage.slice(1)))) {
        fs.unlinkSync(path.join(__dirname, oldImage.slice(1)));
      }
      items[idx].image = '/uploads/' + req.file.filename;
    }
    writeJSON(ITEMS_FILE, items);
    res.json(items[idx]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'שגיאה בעדכון' }); }
});

app.delete('/api/items/:id', requireAuth, async (req, res) => {
  try {
    if (USE_CLOUD) {
      await cloudinary.uploader.destroy(`${FOLDER}/items/${req.params.id}`);
      return res.json({ ok: true });
    }
    let items = readJSON(ITEMS_FILE);
    const item = items.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'פריט לא נמצא' });
    const imgPath = path.join(__dirname, item.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    writeJSON(ITEMS_FILE, items.filter(i => i.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה במחיקה' });
  }
});

// ── Admin — categories ────────────────────────────────────────────────────────
app.post('/api/categories', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'שם קטגוריה נדרש' });
  try {
    const cats = USE_CLOUD ? await cloudGetCategories() : readJSON(CATS_FILE);
    if (cats.includes(name)) return res.status(400).json({ error: 'קטגוריה כבר קיימת' });
    cats.push(name);
    USE_CLOUD ? await cloudSaveCategories(cats) : writeJSON(CATS_FILE, cats);
    res.json(cats);
  } catch (err) { res.status(500).json({ error: 'שגיאה' }); }
});

app.delete('/api/categories/:name', requireAuth, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  try {
    let cats = USE_CLOUD ? await cloudGetCategories() : readJSON(CATS_FILE);
    cats = cats.filter(c => c !== name);
    USE_CLOUD ? await cloudSaveCategories(cats) : writeJSON(CATS_FILE, cats);
    res.json(cats);
  } catch (err) { res.status(500).json({ error: 'שגיאה' }); }
});

app.listen(PORT, () =>
  console.log(`גאליס רצה בכתובת http://localhost:${PORT}`)
);
