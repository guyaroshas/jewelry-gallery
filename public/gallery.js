let allItems = [];

function getUrlCategory() {
  return new URLSearchParams(window.location.search).get('cat') || '';
}

async function loadCategories() {
  const cats = await fetch('/api/categories').then(r => r.json());
  const nav = document.getElementById('categories-nav');
  const urlCat = getUrlCategory();

  const allBtn = nav.querySelector('.cat-btn[data-category=""]');
  allBtn.classList.toggle('active', !urlCat);
  allBtn.addEventListener('click', () => { window.location.href = '/'; });

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.textContent = cat;
    btn.dataset.category = cat;
    btn.classList.toggle('active', cat === urlCat);
    btn.addEventListener('click', () => {
      window.location.href = '/?cat=' + encodeURIComponent(cat);
    });
    nav.appendChild(btn);
  });
}

async function loadItems() {
  allItems = await fetch('/api/items').then(r => r.json());
  const cat = getUrlCategory();
  if (cat) {
    renderItems(allItems.filter(i => i.category === cat));
  } else {
    renderItems(allItems.filter(i => i.bestSeller));
  }
}

function renderItems(items) {
  const grid = document.getElementById('gallery');
  const empty = document.getElementById('empty-msg');
  grid.innerHTML = '';

  if (items.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';
    const zoom = item.imageZoom || 100;
    const pos  = item.imagePosition || 'center center';
    card.innerHTML = `
      <div class="item-img-wrap" style="background-image:url('${item.image}');background-size:${zoom}%;background-position:${pos}"></div>
    `;
    card.addEventListener('click', () => openLightbox(item));
    grid.appendChild(card);
  });
}

function openLightbox(item) {
  document.getElementById('lightbox-img').src = item.image;
  document.getElementById('lightbox-name').textContent = item.name;
  document.getElementById('lightbox-desc').textContent = item.description || '';
  document.getElementById('lightbox-cat').innerHTML = `<span class="item-tag">${item.category}</span>`;
  document.getElementById('lightbox').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
});

function applyHeroSlot(el, slot) {
  const url  = typeof slot === 'object' ? slot.url      : slot;
  const pos  = typeof slot === 'object' ? (slot.position || 'center center') : 'center center';
  const zoom = typeof slot === 'object' ? (slot.zoom    || 100) : 100;
  if (url) {
    el.style.backgroundImage    = `url(${url})`;
    el.style.backgroundPosition = pos;
    el.style.backgroundSize     = zoom + '%';
    el.style.backgroundRepeat   = 'no-repeat';
  }
}

async function loadHero() {
  const data   = await fetch('/api/hero').then(r => r.json());
  const slots  = Array.isArray(data) ? data : (data.slots  || []);
  const colLeft = Array.isArray(data) ? 50   : (data.colLeft ?? 50);
  const rowTop  = Array.isArray(data) ? 50   : (data.rowTop  ?? 50);

  // Apply layout
  const hero = document.querySelector('.hero');
  const side = document.querySelector('.hero-side');
  if (hero) hero.style.gridTemplateColumns = `${colLeft}fr ${100 - colLeft}fr`;
  if (side) side.style.gridTemplateRows    = `${rowTop}fr ${100 - rowTop}fr`;

  slots.forEach((slot, i) => {
    const el = document.getElementById('hero-' + i);
    if (el) applyHeroSlot(el, slot);
  });
}

Promise.all([loadHero(), loadCategories().then(loadItems)]);
