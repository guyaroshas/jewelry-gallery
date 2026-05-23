let token = sessionStorage.getItem('admin_token');

if (token) showAdmin();

async function login() {
  const password = document.getElementById('password-input').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) {
    const data = await res.json();
    token = data.token;
    sessionStorage.setItem('admin_token', token);
    showAdmin();
  } else {
    document.getElementById('login-error').textContent = 'סיסמה שגויה, נסי שוב';
  }
}

document.getElementById('password-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});

function showAdmin() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'block';
  loadHeroSlots();
  loadCategories();
  loadItems();
}

async function logout() {
  await fetch('/api/logout', { method: 'POST', headers: { 'x-session-token': token } });
  sessionStorage.removeItem('admin_token');
  location.reload();
}

function authHeaders() {
  return { 'x-session-token': token };
}

// ── Hero images ───────────────────────────────────────────────────────────────
const POS_GRID = [
  ['right top','center top','left top'],
  ['right center','center center','left center'],
  ['right bottom','center bottom','left bottom'],
];

function bgPreviewStyle(slot) {
  return `background-image:url(${slot.url});background-position:${slot.position};background-size:${slot.zoom}%;background-repeat:no-repeat;background-color:#f0eeec`;
}

async function loadHeroSlots() {
  const data   = await fetch('/api/hero').then(r => r.json());
  const slots  = Array.isArray(data) ? data : (data.slots  || []);
  const colLeft = Array.isArray(data) ? 50   : (data.colLeft ?? 50);
  const rowTop  = Array.isArray(data) ? 50   : (data.rowTop  ?? 50);
  const labels = ['שמאל עליון', 'שמאל תחתון', 'ימין (גדולה)'];

  document.getElementById('hero-slots').innerHTML = `
    <div class="hero-layout-sliders">
      <div class="zoom-wrap">
        <span class="zoom-label">עמודה שמאל</span>
        <input type="range" min="20" max="80" value="${colLeft}" oninput="setHeroLayout('colLeft',this)" class="zoom-slider"/>
        <span class="zoom-val" id="lv-col">${colLeft}%</span>
      </div>
      <div class="zoom-wrap">
        <span class="zoom-label">שורה עליונה</span>
        <input type="range" min="20" max="80" value="${rowTop}" oninput="setHeroLayout('rowTop',this)" class="zoom-slider"/>
        <span class="zoom-val" id="lv-row">${rowTop}%</span>
      </div>
    </div>
    ${slots.map((slot, i) => {
      const pos  = slot.position || 'center center';
      const zoom = slot.zoom || 100;
      const posRows = POS_GRID.map(row =>
        row.map(p => `<button class="pos-btn${p===pos?' active':''}" onclick="setHeroPos(${i},this,'${p}')" title="${p}"></button>`).join('')
      ).join('');
      return `
        <div class="hero-slot" id="hslot-${i}">
          <div class="hero-slot-label-top">${labels[i]}</div>
          <div class="hero-slot-img-wrap" id="hbg-${i}" style="${bgPreviewStyle(slot)}"></div>
          <div class="hero-controls">
            <div class="pos-grid">${posRows}</div>
            <div class="zoom-wrap">
              <span class="zoom-label">זום</span>
              <input type="range" min="50" max="250" value="${zoom}" oninput="setHeroZoom(${i},this)" class="zoom-slider"/>
              <span class="zoom-val" id="zoom-val-${i}">${zoom}%</span>
            </div>
          </div>
          <label class="hero-slot-label" for="hero-file-${i}">החלפת תמונה</label>
          <input type="file" id="hero-file-${i}" accept="image/*" onchange="uploadHeroSlot(${i},this)"/>
        </div>`;
    }).join('')}`;
}

async function setHeroPos(slot, btn, position) {
  document.querySelectorAll(`#hslot-${slot} .pos-btn`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const bg = document.getElementById('hbg-' + slot);
  if (bg) bg.style.backgroundPosition = position;
  await fetch('/api/hero/' + slot, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ position }),
  });
}

async function setHeroZoom(slot, input) {
  const zoom = parseInt(input.value);
  document.getElementById('zoom-val-' + slot).textContent = zoom + '%';
  const bg = document.getElementById('hbg-' + slot);
  if (bg) bg.style.backgroundSize = zoom + '%';
  await fetch('/api/hero/' + slot, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ zoom }),
  });
}

async function setHeroLayout(key, input) {
  const val = parseInt(input.value);
  if (key === 'colLeft') document.getElementById('lv-col').textContent = val + '%';
  if (key === 'rowTop')  document.getElementById('lv-row').textContent = val + '%';
  await fetch('/api/hero', {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ [key]: val }),
  });
}

async function uploadHeroSlot(slot, input) {
  const file = input.files[0];
  if (!file) return;
  const label = document.querySelector(`#hslot-${slot} .hero-slot-label`);
  label.textContent = 'מעלה...';
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch('/api/hero/' + slot, { method: 'PUT', headers: authHeaders(), body: formData });
  if (res.ok) {
    const data = await res.json();
    const bg = document.getElementById('hbg-' + slot);
    if (bg) bg.style.backgroundImage = `url(${data.url})`;
    label.textContent = 'הוחלפה ✓';
    setTimeout(() => { label.textContent = 'החלפת תמונה'; }, 2500);
  } else { label.textContent = 'שגיאה'; }
}

// ── Edit item ─────────────────────────────────────────────────────────────────
let editingId = null;
let adminItems = [];

function openEditModal(item) {
  editingId = item.id;
  document.getElementById('edit-name').value = item.name;
  document.getElementById('edit-desc').value = item.description || '';
  document.getElementById('edit-preview-img').src = item.image;
  document.getElementById('edit-preview').style.display = 'block';
  document.getElementById('edit-file-input').value = '';
  // Copy categories from the upload form select
  const src = document.getElementById('item-category');
  const dst = document.getElementById('edit-category');
  dst.innerHTML = src.innerHTML;
  dst.value = item.category;
  document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
  editingId = null;
}

function editPreviewImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('edit-preview-img').src = URL.createObjectURL(file);
  document.getElementById('edit-preview').style.display = 'block';
}

async function saveEdit() {
  const name = document.getElementById('edit-name').value.trim();
  const description = document.getElementById('edit-desc').value.trim();
  const category = document.getElementById('edit-category').value;
  const file = document.getElementById('edit-file-input').files[0];
  if (!name || !category) { alert('יש למלא שם וקטגוריה'); return; }
  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);
  formData.append('category', category);
  if (file) formData.append('image', file);
  const res = await fetch('/api/items/' + editingId, {
    method: 'PUT', headers: authHeaders(), body: formData,
  });
  if (res.ok) { closeEditModal(); loadItems(); }
  else { alert('שגיאה בשמירה'); }
}

// Image preview
function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const preview = document.getElementById('image-preview');
  const img = document.getElementById('preview-img');
  img.src = URL.createObjectURL(file);
  preview.style.display = 'block';
}

// Drag-over style
const uploadArea = document.getElementById('upload-area');
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('file-input').files = dt.files;
    previewImage({ target: { files: dt.files } });
  }
});

// Upload item
async function uploadItem() {
  const file = document.getElementById('file-input').files[0];
  const name = document.getElementById('item-name').value.trim();
  const description = document.getElementById('item-desc').value.trim();
  const category = document.getElementById('item-category').value;
  const msgEl = document.getElementById('upload-msg');

  if (!file || !name || !category) {
    msgEl.innerHTML = '<p class="msg-error">יש למלא שם, קטגוריה ולבחור תמונה</p>';
    return;
  }

  const formData = new FormData();
  formData.append('image', file);
  formData.append('name', name);
  formData.append('description', description);
  formData.append('category', category);

  const res = await fetch('/api/items', {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (res.ok) {
    msgEl.innerHTML = '<p class="msg-success">הפריט הועלה בהצלחה!</p>';
    document.getElementById('file-input').value = '';
    document.getElementById('item-name').value = '';
    document.getElementById('item-desc').value = '';
    document.getElementById('image-preview').style.display = 'none';
    setTimeout(() => (msgEl.innerHTML = ''), 3000);
    loadItems();
  } else {
    const err = await res.json();
    msgEl.innerHTML = `<p class="msg-error">${err.error}</p>`;
  }
}

// Categories
async function loadCategories() {
  const cats = await fetch('/api/categories').then(r => r.json());
  renderCategories(cats);
  const select = document.getElementById('item-category');
  select.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderCategories(cats) {
  const el = document.getElementById('cats-list');
  el.innerHTML = cats.map(c => `
    <div class="cat-chip">
      <span>${c}</span>
      <button onclick="deleteCategory('${c}')" title="מחיקת קטגוריה">✕</button>
    </div>
  `).join('');
}

async function addCategory() {
  const input = document.getElementById('new-cat-input');
  const name = input.value.trim();
  const msg = document.getElementById('cat-msg');
  if (!name) return;

  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (res.ok) {
    const cats = await res.json();
    renderCategories(cats);
    const select = document.getElementById('item-category');
    select.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    input.value = '';
    msg.textContent = '';
  } else {
    const err = await res.json();
    msg.textContent = err.error;
    msg.style.color = '#e05c5c';
  }
}

async function deleteCategory(name) {
  if (!confirm(`למחוק את הקטגוריה "${name}"?`)) return;
  const res = await fetch('/api/categories/' + encodeURIComponent(name), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.ok) {
    const cats = await res.json();
    renderCategories(cats);
    const select = document.getElementById('item-category');
    select.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }
}

// Items
async function loadItems() {
  adminItems = await fetch('/api/items').then(r => r.json());
  const list = document.getElementById('items-list');
  const empty = document.getElementById('items-empty');

  if (adminItems.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = adminItems.map(item => `
    <div class="admin-item" id="item-${item.id}">
      <img src="${item.image}" alt="${item.name}" />
      <div class="admin-item-info">
        <strong>${item.name}</strong>
        <small>${item.category}${item.description ? ' · ' + item.description : ''}</small>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.3rem">
        <button class="btn bs-btn ${item.bestSeller ? 'bs-active' : ''}" onclick="toggleBestSeller('${item.id}')">
          ${item.bestSeller ? '★' : '☆'} best seller
        </button>
        <button class="btn btn-secondary" onclick="openEditModal(adminItems.find(i=>i.id==='${item.id}'))">עריכה</button>
        <button class="btn btn-danger" onclick="deleteItem('${item.id}')">מחיקה</button>
      </div>
    </div>
  `).join('');
}

async function toggleBestSeller(id) {
  const item = adminItems.find(i => i.id === id);
  if (!item) return;
  const newVal = !item.bestSeller;
  const res = await fetch(`/api/items/${id}/bestseller`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ bestSeller: newVal }),
  });
  if (res.ok) {
    item.bestSeller = newVal;
    const btn = document.querySelector(`#item-${id} .bs-btn`);
    if (btn) {
      btn.textContent = (newVal ? '★' : '☆') + ' best seller';
      btn.classList.toggle('bs-active', newVal);
    }
  }
}

async function deleteItem(id) {
  if (!confirm('למחוק את הפריט?')) return;
  const res = await fetch('/api/items/' + id, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.ok) {
    document.getElementById('item-' + id)?.remove();
    const list = document.getElementById('items-list');
    if (list.children.length === 0) document.getElementById('items-empty').style.display = 'block';
  }
}
