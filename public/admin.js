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
  const items = await fetch('/api/items').then(r => r.json());
  const list = document.getElementById('items-list');
  const empty = document.getElementById('items-empty');

  if (items.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = items.map(item => `
    <div class="admin-item" id="item-${item.id}">
      <img src="${item.image}" alt="${item.name}" />
      <div class="admin-item-info">
        <strong>${item.name}</strong>
        <small>${item.category}${item.description ? ' · ' + item.description : ''}</small>
      </div>
      <button class="btn btn-danger" onclick="deleteItem('${item.id}')">מחיקה</button>
    </div>
  `).join('');
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
