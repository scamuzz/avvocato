// ============================================================
// UTILITIES.JS — funzioni condivise tra tutte le pagine
// ============================================================

// --- Formattazione date ---

function formatDate(ts) {
  if (!ts) return '—';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(ts) {
  if (!ts) return '—';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatTime(ts) {
  if (!ts) return '—';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(date1, date2) {
  var d1 = date1 instanceof Date ? date1 : new Date(date1);
  var d2 = date2 instanceof Date ? date2 : new Date(date2);
  return Math.round((d2 - d1) / 86400000);
}

function isToday(ts) {
  if (!ts) return false;
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  var t = new Date();
  return d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate();
}

// --- Stringhe ---

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitials(nome, cognome) {
  var n = (nome || '').trim().charAt(0).toUpperCase();
  var c = (cognome || '').trim().charAt(0).toUpperCase();
  return (n + c) || '?';
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// --- Badge HTML ---

function statoBadge(stato) {
  var map = {
    'Aperta':        'badge-aperta',
    'In lavorazione':'badge-lavorazione',
    'In attesa':     'badge-attesa',
    'Chiusa':        'badge-chiusa',
    'Archiviata':    'badge-archiviata'
  };
  return '<span class="badge ' + (map[stato] || 'badge-default') + '">' + escapeHtml(stato || '—') + '</span>';
}

function prioritaBadge(priorita) {
  var map = { 'Alta': 'badge-alta', 'Media': 'badge-media', 'Bassa': 'badge-bassa' };
  return '<span class="badge ' + (map[priorita] || 'badge-default') + '">' + escapeHtml(priorita || '—') + '</span>';
}

// --- Toast notifications ---

function showToast(message, type) {
  type = type || 'success';
  var tc = document.getElementById('toast-container');
  if (!tc) {
    tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
  }
  var iconMap = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-triangle', info: 'info-circle' };
  var icon = iconMap[type] || 'info-circle';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<i class="fas fa-' + icon + '"></i> ' + escapeHtml(message);
  tc.appendChild(toast);
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { toast.classList.add('show'); });
  });
  setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(function () { toast.remove(); }, 350);
  }, 3800);
}

// --- Empty state HTML helper ---

function emptyStateHtml(iconClass, message) {
  return '<div class="empty-state"><i class="' + iconClass + '"></i><p>' + escapeHtml(message) + '</p></div>';
}

// --- Generic modal helpers ---

function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('active');
}
