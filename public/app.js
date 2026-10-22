'use strict';

const loginPanel = document.querySelector('#login-panel');
const dashboardPanel = document.querySelector('#dashboard-panel');
const apiUrlInput = document.querySelector('#api-url');
const passwordInput = document.querySelector('#password');
const loginMessage = document.querySelector('#login-message');
const dashboardMessage = document.querySelector('#dashboard-message');
const accountList = document.querySelector('#account-list');
const accountForm = document.querySelector('#account-form');
const accountLabel = document.querySelector('#account-label');
let apiBase = '';
let authToken = sessionStorage.getItem('ruzbotAdminToken') || '';
let polling = false;
let isRefreshing = false;
let accountLimit = 5;

function setMessage(element, text, success = false) {
  element.textContent = text;
  element.classList.toggle('success', success);
}

function resolveApiBase(value) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return window.location.origin;
  const url = new URL(trimmed);
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Alamat backend harus berupa origin HTTPS (HTTP hanya di localhost), tanpa path atau kredensial.');
  }
  return url.origin;
}

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(authToken && path !== '/api/login' ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/login') {
      authToken = '';
      sessionStorage.removeItem('ruzbotAdminToken');
      showLogin();
    }
    throw new Error(result.error || `Permintaan gagal (${response.status}).`);
  }
  return result;
}

function showLogin() {
  dashboardPanel.hidden = true;
  loginPanel.hidden = false;
  window.clearInterval(polling);
  authToken = '';
  sessionStorage.removeItem('ruzbotAdminToken');
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboardPanel.hidden = false;
  refreshAccounts();
  window.clearInterval(polling);
  polling = window.setInterval(refreshAccounts, 2500);
}

function statusClass(status) {
  if (status === 'terhubung') return 'connected';
  if (status === 'menunggu QR dipindai') return 'waiting';
  if (status.includes('gagal') || status === 'terputus') return 'error';
  return '';
}

function createAccountCard(account) {
  const card = document.createElement('article');
  card.className = 'account-card';

  const details = document.createElement('div');
  const meta = document.createElement('div');
  meta.className = 'account-meta';
  const avatar = document.createElement('span');
  avatar.className = 'account-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = account.label.slice(0, 1).toUpperCase();
  const title = document.createElement('div');
  title.className = 'account-title';
  const heading = document.createElement('h3');
  heading.textContent = account.label;
  const status = document.createElement('div');
  status.className = 'status-line';
  const dot = document.createElement('span');
  dot.className = `status-dot ${statusClass(account.status)}`;
  const statusText = document.createElement('span');
  statusText.textContent = account.status;
  status.append(dot, statusText);
  title.append(heading, status);
  meta.append(avatar, title);
  details.append(meta);

  if (account.error) {
    const error = document.createElement('p');
    error.className = 'account-error';
    error.textContent = account.error;
    details.append(error);
  }

  const qrColumn = document.createElement('div');
  const qrWrap = document.createElement('div');
  qrWrap.className = 'qr-wrap';
  if (account.qr) {
    const image = document.createElement('img');
    image.src = account.qr;
    image.alt = `QR untuk menautkan ${account.label}`;
    qrWrap.append(image);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'qr-placeholder';
    placeholder.textContent = account.status === 'terhubung'
      ? 'WhatsApp sudah tertaut.'
      : account.status === 'terputus'
        ? 'Koneksi terputus. Muat ulang atau mulai ulang backend.'
        : 'Menyiapkan koneksi dan QR…';
    qrWrap.append(placeholder);
  }

  const actions = document.createElement('div');
  actions.className = 'account-actions';
  const removeButton = document.createElement('button');
  removeButton.className = 'delete-button';
  removeButton.type = 'button';
  removeButton.textContent = 'Putuskan & hapus';
  removeButton.addEventListener('click', () => removeAccount(account));
  actions.append(removeButton);
  qrColumn.append(qrWrap, actions);
  card.append(details, qrColumn);
  return card;
}

async function refreshAccounts() {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    const { accounts, maxAccounts: limit } = await api('/api/accounts');
    accountList.replaceChildren();
    if (!accounts.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Belum ada akun tertaut. Tambahkan akun untuk menampilkan QR.';
      accountList.append(empty);
    } else {
      for (const account of accounts) accountList.append(createAccountCard(account));
    }
    accountLimit = limit;
    accountForm.querySelector('button').disabled = accounts.length >= accountLimit;
    accountForm.querySelector('button').title = accounts.length >= accountLimit
      ? `Batas ${accountLimit} akun tercapai.`
      : '';
  } catch (error) {
    setMessage(dashboardMessage, error.message);
  } finally {
    isRefreshing = false;
  }
}

async function removeAccount(account) {
  if (!window.confirm(`Putuskan dan hapus sesi "${account.label}"? Anda mungkin perlu menautkan ulang akun ini.`)) return;
  try {
    await api(`/api/accounts/${encodeURIComponent(account.id)}`, { method: 'DELETE' });
    setMessage(dashboardMessage, `Sesi "${account.label}" dihapus.`, true);
    await refreshAccounts();
  } catch (error) {
    setMessage(dashboardMessage, error.message);
  }
}

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(loginMessage, '');
  try {
    apiBase = resolveApiBase(apiUrlInput.value);
    localStorage.setItem('ruzbotApiBase', apiBase === window.location.origin ? '' : apiBase);
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password: passwordInput.value })
    });
    authToken = result.token;
    sessionStorage.setItem('ruzbotAdminToken', authToken);
    passwordInput.value = '';
    showDashboard();
  } catch (error) {
    setMessage(loginMessage, error.message);
  } finally {
    button.disabled = false;
  }
});

accountForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  setMessage(dashboardMessage, '');
  try {
    await api('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ label: accountLabel.value })
    });
    accountLabel.value = '';
    setMessage(dashboardMessage, 'Akun ditambahkan. QR sedang disiapkan.', true);
    await refreshAccounts();
  } catch (error) {
    setMessage(dashboardMessage, error.message);
  } finally {
    button.disabled = accountList.querySelectorAll('.account-card').length >= accountLimit;
  }
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (error) {
    setMessage(dashboardMessage, error.message);
  } finally {
    authToken = '';
    sessionStorage.removeItem('ruzbotAdminToken');
  }
  showLogin();
});

apiUrlInput.value = localStorage.getItem('ruzbotApiBase') || '';
try {
  apiBase = resolveApiBase(apiUrlInput.value);
  api('/api/auth').then(({ authenticated }) => {
    if (authenticated && authToken) showDashboard();
    else if (!authenticated) {
      authToken = '';
      sessionStorage.removeItem('ruzbotAdminToken');
    }
  }).catch((error) => setMessage(loginMessage, error.message));
} catch (error) {
  setMessage(loginMessage, error.message);
}
