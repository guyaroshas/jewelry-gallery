let allItems = [];
let activeCategory = '';

async function loadCategories() {
  const cats = await fetch('/api/categories').then(r => r.json());
  const nav = document.getElementById('categories-nav');
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.textContent = cat;
    btn.dataset.category = cat;
    btn.addEventListener('click', () => filterBy(cat));
    nav.appendChild(btn);
  });
}

async function loadItems() {
  allItems = await fetch('/api/items').then(r => r.json());
  renderItems(allItems);
}

function filterBy(category) {
  activeCategory = category;
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.category === category);
  });
  const filtered = category ? allItems.filter(i => i.category === category) : allItems;
  renderItems(filtered);
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
    card.innerHTML = `
      <img src="${item.image}" alt="${item.name}" loading="lazy" />
      <div class="item-info">
        <h3>${item.name}</h3>
        ${item.description ? `<p>${item.description}</p>` : ''}
        <span class="item-tag">${item.category}</span>
      </div>
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

loadCategories().then(loadItems);
