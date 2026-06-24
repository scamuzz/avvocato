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

// --- Missing helpers used across pages ---

// Alias for escapeHtml (some pages use sanitizeInput)
function sanitizeInput(str) { return escapeHtml(str); }

// Format date as YYYY-MM-DD for <input type="date">
function formatDateInput(d) {
  if (!d) return '';
  var date = d instanceof Date ? d : (d.toDate ? d.toDate() : new Date(d));
  if (isNaN(date)) return '';
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

// Days until a date (negative = overdue)
function daysUntil(dateStr) {
  if (!dateStr) return null;
  var target = new Date(dateStr);
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// Stato → CSS badge class
function getStatoClass(stato) {
  var map = {
    'Aperta':        'badge-success',
    'In lavorazione':'badge-info',
    'In attesa':     'badge-warning',
    'Chiusa':        'badge-gray',
    'Archiviata':    'badge-gray',
    'Programmato':   'badge-info',
    'Confermato':    'badge-success',
    'Completato':    'badge-gray',
    'Cancellato':    'badge-danger',
    'Nuova':         'badge-danger',
    'In gestione':   'badge-warning'
  };
  return map[stato] || 'badge-gray';
}

// Stato → Italian label
function getStatoLabel(stato) { return stato || '—'; }

// Priorità → CSS badge class
function getPrioritaClass(p) {
  var map = { 'Alta': 'badge-danger', 'Media': 'badge-warning', 'Bassa': 'badge-success' };
  return map[p] || 'badge-gray';
}

// Priorità → label
function getPrioritaLabel(p) { return p || '—'; }

// Firebase error → Italian message
function handleFirebaseError(err) {
  var map = {
    'auth/user-not-found':       'Nessun utente trovato con questa email.',
    'auth/wrong-password':       'Password errata.',
    'auth/invalid-email':        'Email non valida.',
    'auth/user-disabled':        'Account disabilitato.',
    'auth/email-already-in-use': 'Email già in uso.',
    'auth/weak-password':        'Password troppo debole (min. 6 caratteri).',
    'auth/too-many-requests':    'Troppi tentativi. Riprova più tardi.',
    'auth/network-request-failed': 'Errore di rete. Controlla la connessione.',
    'auth/invalid-credential':   'Credenziali non valide.',
    'permission-denied':         'Accesso negato.',
    'not-found':                 'Documento non trovato.'
  };
  return map[err.code] || err.message || 'Si è verificato un errore.';
}

// initUI — close modals on backdrop click, Escape key
function initUI() {
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(function(m) {
        m.classList.remove('active');
      });
    }
  });
  // Set user avatar initials
  auth.onAuthStateChanged(function(user) {
    if (!user) return;
    var avatarEl = document.getElementById('userAvatar');
    var nameEl = document.getElementById('userDisplayName');
    if (nameEl) nameEl.textContent = user.displayName || user.email || '';
    if (avatarEl) {
      var parts = (user.displayName || user.email || '?').split(' ');
      avatarEl.textContent = parts.map(function(p){ return p[0]; }).join('').toUpperCase().slice(0,2);
    }
    window.currentUser = user;
    // Fetch Firestore user data
    db.collection('users').doc(user.uid).get().then(function(doc) {
      if (doc.exists) window.currentUserData = doc.data();
    }).catch(function(){});
  });
}

// Confirm dialog (returns Promise<boolean>)
function confirmDialog(message) {
  return new Promise(function(resolve) {
    var ovId = 'confirmDialogOverlay';
    var existing = document.getElementById(ovId);
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = ovId;
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Conferma azione</h3>
        <p>${escapeHtml(message)}</p>
        <div class="btn-row">
          <button class="btn btn-secondary" id="confirmNo">Annulla</button>
          <button class="btn btn-danger" id="confirmYes">Conferma</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirmYes').addEventListener('click', function() { overlay.remove(); resolve(true); });
    overlay.querySelector('#confirmNo').addEventListener('click', function() { overlay.remove(); resolve(false); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

// Filter array by search term across multiple fields
function filterBySearch(arr, term, fields) {
  if (!term) return arr;
  var t = term.toLowerCase();
  return arr.filter(function(item) {
    return fields.some(function(f) {
      return String(item[f] || '').toLowerCase().includes(t);
    });
  });
}

// Populate form from data object
function populateForm(fields) {
  Object.keys(fields).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = fields[id] !== undefined && fields[id] !== null ? fields[id] : '';
  });
}

// Sidebar toggle (global)
function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('sidebarOverlay');
  if (sb) sb.classList.toggle('open');
  if (ov) ov.classList.toggle('active');
}
