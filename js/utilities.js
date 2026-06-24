// ============================================================
// UTILITIES.JS - Shared utility functions
// Studio Legale Avv. Corrado Scamuzzi
// Firebase SDK v9 compat — no ES6 imports, global scope
// ============================================================

// ============================================================
// DATE FORMATTING
// ============================================================

/**
 * Normalises a value (Date, Firestore Timestamp, ISO string, ms number) to a
 * native Date.  Returns null when the value is falsy or unparseable.
 */
function _toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  // Firestore Timestamp object  { seconds, nanoseconds }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  // Numeric timestamp (ms)
  if (typeof value === 'number') return new Date(value);
  // ISO string or any string date
  var d = new Date(value);
  return isNaN(d) ? null : d;
}

/** Returns "DD/MM/YYYY" */
function formatDate(date) {
  var d = _toDate(date);
  if (!d) return '';
  return String(d.getDate()).padStart(2, '0') + '/' +
         String(d.getMonth() + 1).padStart(2, '0') + '/' +
         d.getFullYear();
}

/** Returns "DD/MM/YYYY HH:MM" */
function formatDateTime(date) {
  var d = _toDate(date);
  if (!d) return '';
  return formatDate(d) + ' ' +
         String(d.getHours()).padStart(2, '0') + ':' +
         String(d.getMinutes()).padStart(2, '0');
}

/** Returns "YYYY-MM-DD" suitable for input[type=date] */
function formatDateInput(date) {
  var d = _toDate(date);
  if (!d) return '';
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

/** True when date falls on today */
function isToday(date) {
  var d = _toDate(date);
  if (!d) return false;
  var now = new Date();
  return d.getDate()     === now.getDate()  &&
         d.getMonth()    === now.getMonth() &&
         d.getFullYear() === now.getFullYear();
}

/** True when date falls within the current calendar week (Mon-Sun) */
function isThisWeek(date) {
  var d = _toDate(date);
  if (!d) return false;
  var now   = new Date();
  var day   = now.getDay() || 7; // Sunday = 7
  var start = new Date(now);
  start.setDate(now.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  var end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

/** Returns the number of whole days until (positive) or since (negative) the date */
function daysUntil(date) {
  var d = _toDate(date);
  if (!d) return null;
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  var target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}


// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

(function _injectToastStyles() {
  if (document.getElementById('_util-toast-css')) return;
  var s = document.createElement('style');
  s.id = '_util-toast-css';
  s.textContent = [
    '#_toast-container{',
      'position:fixed;top:1.25rem;right:1.25rem;z-index:9999;',
      'display:flex;flex-direction:column;gap:.5rem;max-width:360px;pointer-events:none',
    '}',
    '._toast{',
      'padding:.7rem 1rem;border-radius:10px;font-size:.9rem;font-weight:500;',
      'box-shadow:0 4px 16px rgba(0,0,0,.18);display:flex;align-items:center;',
      'gap:.55rem;color:#fff;cursor:pointer;pointer-events:all;',
      'animation:_tIn .25s ease',
    '}',
    '._toast._removing{animation:_tOut .25s ease forwards}',
    '._toast-success{background:#0f766e}',
    '._toast-error{background:#dc2626}',
    '._toast-warning{background:#b45309}',
    '._toast-info{background:#1d4ed8}',
    '@keyframes _tIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}',
    '@keyframes _tOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(40px)}}'
  ].join('');
  document.head.appendChild(s);
}());

function _toastContainer() {
  var c = document.getElementById('_toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = '_toast-container';
    document.body.appendChild(c);
  }
  return c;
}

function _dismissToast(el) {
  if (!el.parentNode) return;
  el.classList.add('_removing');
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
}

/**
 * Displays a toast notification.
 * @param {string} message
 * @param {string} [type='info']  success | error | warning | info
 */
function showToast(message, type) {
  type = type || 'info';
  var icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  var el = document.createElement('div');
  el.className = '_toast _toast-' + type;
  el.innerHTML = '<span aria-hidden="true">' + (icons[type] || 'ℹ') + '</span>' +
                 '<span>' + sanitizeInput(String(message)) + '</span>';
  el.setAttribute('role', 'alert');
  el.addEventListener('click', function () { _dismissToast(el); });
  _toastContainer().appendChild(el);
  setTimeout(function () { _dismissToast(el); }, 4000);
}


// ============================================================
// MODAL MANAGEMENT
// ============================================================

/** Opens a modal by its element id */
function openModal(modalId) {
  var modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  var focusable = modal.querySelector(
    'input:not([disabled]),textarea:not([disabled]),select:not([disabled]),' +
    'button:not([disabled]),[tabindex]:not([tabindex="-1"])'
  );
  if (focusable) focusable.focus();
}

/** Closes a modal by its element id */
function closeModal(modalId) {
  var modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  // Restore scroll only when no other modals are open
  if (!document.querySelector('.modal[style*="flex"]')) {
    document.body.style.overflow = '';
  }
}

/** Closes every element with class "modal" */
function closeAllModals() {
  document.querySelectorAll('.modal').forEach(function (m) {
    m.style.display = 'none';
    m.setAttribute('aria-hidden', 'true');
  });
  document.body.style.overflow = '';
}


// ============================================================
// LOADING STATES
// ============================================================

/** Replaces element content with a spinner */
function showLoading(elementId) {
  var el = document.getElementById(elementId);
  if (!el) return;
  el.dataset._origHtml    = el.innerHTML;
  el.dataset._origPe      = el.style.pointerEvents;
  el.dataset._origOpacity = el.style.opacity;
  el.innerHTML = '<span class="_spin" style="display:inline-block;animation:_spin 1s linear infinite" aria-hidden="true">⟳</span> Caricamento\u2026';
  el.style.pointerEvents = 'none';
  el.style.opacity = '0.65';
}

/** Restores element content after showLoading */
function hideLoading(elementId) {
  var el = document.getElementById(elementId);
  if (!el) return;
  if (el.dataset._origHtml !== undefined) {
    el.innerHTML = el.dataset._origHtml;
    delete el.dataset._origHtml;
  }
  el.style.pointerEvents = el.dataset._origPe || '';
  el.style.opacity       = el.dataset._origOpacity || '';
  delete el.dataset._origPe;
  delete el.dataset._origOpacity;
}

/**
 * Toggles a button into/out of loading state.
 * @param {HTMLButtonElement} btn
 * @param {boolean} loading
 */
function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset._origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;animation:_spin 1s linear infinite" aria-hidden="true">⟳</span> Attendere\u2026';
  } else {
    btn.disabled = false;
    if (btn.dataset._origText !== undefined) {
      btn.innerHTML = btn.dataset._origText;
      delete btn.dataset._origText;
    }
  }
}


// ============================================================
// FORM UTILITIES
// ============================================================

/**
 * Returns a plain object with all named field values from a form.
 * @param {string} formId
 * @returns {Object}
 */
function getFormData(formId) {
  var form = document.getElementById(formId);
  if (!form) return {};
  var data = {};
  form.querySelectorAll('[name]').forEach(function (el) {
    var name = el.name;
    if (el.type === 'checkbox') {
      data[name] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) data[name] = el.value;
    } else {
      data[name] = typeof el.value === 'string' ? el.value.trim() : el.value;
    }
  });
  return data;
}

/** Resets a form and clears any displayed field-level errors */
function clearForm(formId) {
  var form = document.getElementById(formId);
  if (!form) return;
  form.reset();
  form.querySelectorAll('.field-error,.form-error').forEach(function (el) {
    el.textContent = '';
  });
}

/**
 * Populates a form's fields from a data object.
 * Handles Firestore Timestamps for date inputs.
 * @param {string} formId
 * @param {Object} data
 */
function populateForm(formId, data) {
  if (!data) return;
  var form = document.getElementById(formId);
  if (!form) return;
  Object.keys(data).forEach(function (key) {
    var val = data[key];
    // Handle radio groups
    var radios = form.querySelectorAll('[name="' + key + '"][type="radio"]');
    if (radios.length > 0) {
      radios.forEach(function (r) { r.checked = String(r.value) === String(val); });
      return;
    }
    var el = form.querySelector('[name="' + key + '"]');
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = !!val;
    } else if (el.type === 'date') {
      el.value = val ? formatDateInput(val) : '';
    } else {
      el.value = (val !== null && val !== undefined) ? val : '';
    }
  });
}


// ============================================================
// CONFIRM DIALOG
// ============================================================

(function _injectConfirmStyles() {
  if (document.getElementById('_util-confirm-css')) return;
  var s = document.createElement('style');
  s.id = '_util-confirm-css';
  s.textContent = [
    '#_confirm-overlay{',
      'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;',
      'display:flex;align-items:center;justify-content:center',
    '}',
    '#_confirm-box{',
      'background:#fff;border-radius:14px;padding:1.75rem 2rem;max-width:400px;',
      'width:92%;box-shadow:0 8px 32px rgba(0,0,0,.22);text-align:center',
    '}',
    '#_confirm-box p{margin:0 0 1.35rem;font-size:.95rem;color:#374151;line-height:1.55}',
    '#_confirm-box .ca{display:flex;gap:.75rem;justify-content:center}',
    '#_confirm-box button{',
      'border:0;border-radius:9px;padding:.55rem 1.4rem;',
      'font-weight:600;font-size:.9rem;cursor:pointer',
    '}',
    '#_cb-ok{background:#dc2626;color:#fff}',
    '#_cb-ok:hover{background:#b91c1c}',
    '#_cb-cancel{background:#f1f5f9;color:#374151;border:1px solid #d1d5db}',
    '#_cb-cancel:hover{background:#e2e8f0}'
  ].join('');
  document.head.appendChild(s);
}());

/**
 * Shows a custom confirm dialog.
 * @param {string} message
 * @returns {Promise<boolean>}  Resolves true on confirm, false on cancel/dismiss
 */
function confirmDialog(message) {
  return new Promise(function (resolve) {
    var existing = document.getElementById('_confirm-overlay');
    if (existing) existing.parentNode.removeChild(existing);

    var overlay = document.createElement('div');
    overlay.id = '_confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div id="_confirm-box">' +
        '<p id="_confirm-msg">' + sanitizeInput(message) + '</p>' +
        '<div class="ca">' +
          '<button id="_cb-cancel">Annulla</button>' +
          '<button id="_cb-ok">Conferma</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById('_cb-ok').focus();

    function done(result) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(result);
    }

    document.getElementById('_cb-ok').addEventListener('click',     function () { done(true);  });
    document.getElementById('_cb-cancel').addEventListener('click', function () { done(false); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) done(false); });
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') done(false); });
  });
}


// ============================================================
// STRING UTILITIES
// ============================================================

/**
 * Returns uppercase initials from first name + last name.
 * @param {string} nome
 * @param {string} cognome
 * @returns {string}  e.g. "AB"
 */
function getInitials(nome, cognome) {
  return ((nome  ? nome[0]   : '') +
          (cognome ? cognome[0] : '')).toUpperCase();
}

/**
 * Truncates text to the given length (default 50), appending "…".
 * @param {string} text
 * @param {number} [length=50]
 */
function truncate(text, length) {
  if (length === undefined) length = 50;
  if (!text) return '';
  text = String(text);
  return text.length <= length ? text : text.slice(0, length) + '\u2026';
}

/** Capitalises the first character of a string */
function capitalizeFirst(str) {
  if (!str) return '';
  str = String(str);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Basic XSS prevention — escapes HTML special characters.
 * @param {*} str
 * @returns {string}
 */
function sanitizeInput(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;')
    .replace(/\//g, '&#x2F;');
}


// ============================================================
// STATUS UTILITIES
// ============================================================

var _STATO_MAP = {
  aperto:     { cls: 'stato-aperto',      label: 'Aperto' },
  in_corso:   { cls: 'stato-in-corso',    label: 'In Corso' },
  sospeso:    { cls: 'stato-sospeso',     label: 'Sospeso' },
  chiuso:     { cls: 'stato-chiuso',      label: 'Chiuso' },
  archiviato: { cls: 'stato-archiviato',  label: 'Archiviato' },
  attivo:     { cls: 'stato-aperto',      label: 'Attivo' },
  inattivo:   { cls: 'stato-archiviato',  label: 'Inattivo' },
  urgente:    { cls: 'stato-urgente',     label: 'Urgente' },
  pendente:   { cls: 'stato-sospeso',     label: 'Pendente' },
  completato: { cls: 'stato-chiuso',      label: 'Completato' },
  nuovo:      { cls: 'stato-aperto',      label: 'Nuovo' },
};

var _PRIORITA_MAP = {
  alta:   { cls: 'priority high',   label: 'Alta' },
  media:  { cls: 'priority medium', label: 'Media' },
  bassa:  { cls: 'priority low',    label: 'Bassa' },
  high:   { cls: 'priority high',   label: 'Alta' },
  medium: { cls: 'priority medium', label: 'Media' },
  low:    { cls: 'priority low',    label: 'Bassa' },
};

/** Returns the CSS class string for a stato badge */
function getStatoClass(stato) {
  if (!stato) return '';
  var entry = _STATO_MAP[String(stato).toLowerCase()];
  return entry ? entry.cls : 'stato-unknown';
}

/** Returns the Italian label for a stato value */
function getStatoLabel(stato) {
  if (!stato) return '';
  var entry = _STATO_MAP[String(stato).toLowerCase()];
  return entry ? entry.label : capitalizeFirst(String(stato));
}

/** Returns the CSS class string for a priorità badge */
function getPrioritaClass(priorita) {
  if (!priorita) return '';
  var entry = _PRIORITA_MAP[String(priorita).toLowerCase()];
  return entry ? entry.cls : 'priority';
}

/** Returns the Italian label for a priorità value */
function getPrioritaLabel(priorita) {
  if (!priorita) return '';
  var entry = _PRIORITA_MAP[String(priorita).toLowerCase()];
  return entry ? entry.label : capitalizeFirst(String(priorita));
}


// ============================================================
// PAGINATION
// ============================================================

/**
 * Slices an array into a single page of results.
 * @param {Array}  array
 * @param {number} page      1-based
 * @param {number} [perPage=10]
 * @returns {{ data: Array, total: number, pages: number, current: number }}
 */
function paginate(array, page, perPage) {
  if (perPage === undefined) perPage = 10;
  var total   = array.length;
  var pages   = Math.max(1, Math.ceil(total / perPage));
  var current = Math.min(Math.max(parseInt(page) || 1, 1), pages);
  var start   = (current - 1) * perPage;
  return {
    data:    array.slice(start, start + perPage),
    total:   total,
    pages:   pages,
    current: current
  };
}

/**
 * Renders pagination controls into a container element.
 * @param {string}   containerId
 * @param {Object}   pagination   — result from paginate()
 * @param {Function} onPageChange — called with the new page number
 */
function renderPagination(containerId, pagination, onPageChange) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (pagination.pages <= 1 && pagination.total <= pagination.data.length) return;

  var nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Paginazione');
  nav.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:.3rem;margin:.75rem 0 0;';

  function _btn(label, page, disabled, active) {
    var b = document.createElement('button');
    b.innerHTML = label;
    b.style.cssText =
      'border:1px solid #d1d5db;border-radius:6px;padding:.28rem .6rem;' +
      'font-size:.85rem;cursor:pointer;min-width:2rem;' +
      'background:' + (active ? '#1d4ed8' : '#fff') + ';' +
      'color:'      + (active ? '#fff'    : '#374151') + ';';
    if (disabled) {
      b.disabled = true;
      b.style.opacity = '0.38';
      b.style.cursor  = 'not-allowed';
    } else if (!active) {
      b.addEventListener('click', function () { onPageChange(page); });
    }
    b.setAttribute('aria-current', active ? 'page' : 'false');
    return b;
  }

  nav.appendChild(_btn('«', 1, pagination.current === 1, false));
  nav.appendChild(_btn('‹', pagination.current - 1, pagination.current === 1, false));

  var lo = Math.max(1, pagination.current - 2);
  var hi = Math.min(pagination.pages, pagination.current + 2);
  for (var p = lo; p <= hi; p++) {
    nav.appendChild(_btn(String(p), p, false, p === pagination.current));
  }

  nav.appendChild(_btn('›', pagination.current + 1, pagination.current === pagination.pages, false));
  nav.appendChild(_btn('»', pagination.pages,        pagination.current === pagination.pages, false));

  var info = document.createElement('span');
  info.style.cssText = 'font-size:.82rem;color:#6b7280;margin-left:.5rem;';
  info.textContent   = 'Pagina ' + pagination.current + ' di ' + pagination.pages +
                       ' \u2014 ' + pagination.total + ' risultati';
  nav.appendChild(info);

  container.appendChild(nav);
}


// ============================================================
// SEARCH / FILTER
// ============================================================

/**
 * Filters an array of objects by searching a term across multiple fields.
 * @param {Array}    array
 * @param {string}   searchTerm
 * @param {string[]} fields      — list of property names to search
 * @returns {Array}
 */
function filterBySearch(array, searchTerm, fields) {
  if (!searchTerm || !String(searchTerm).trim()) return array;
  var term = String(searchTerm).toLowerCase().trim();
  return array.filter(function (item) {
    return fields.some(function (field) {
      var val = item[field];
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().indexOf(term) !== -1;
    });
  });
}


// ============================================================
// EXPORT / PRINT
// ============================================================

/** Triggers the browser print dialog */
function printPage() {
  window.print();
}

/**
 * Exports a <table> element to a UTF-8 CSV file download.
 * @param {string} tableId
 * @param {string} [filename='export.csv']
 */
function exportTableToCSV(tableId, filename) {
  filename = filename || 'export.csv';
  var table = document.getElementById(tableId);
  if (!table) { showToast('Tabella non trovata.', 'error'); return; }

  var rows = table.querySelectorAll('tr');
  var lines = [];
  rows.forEach(function (row) {
    var cells = row.querySelectorAll('th, td');
    var cols  = [];
    cells.forEach(function (cell) {
      // Strip inner HTML, collapse whitespace
      var text = (cell.innerText || cell.textContent || '')
        .replace(/\s+/g, ' ').trim()
        .replace(/"/g, '""');
      cols.push('"' + text + '"');
    });
    lines.push(cols.join(','));
  });

  var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Esportazione CSV completata.', 'success');
}


// ============================================================
// ERROR HANDLER
// ============================================================

/**
 * Converts a Firebase error into a human-readable Italian message.
 * @param {Error|Object} error
 * @returns {string}
 */
function handleFirebaseError(error) {
  var code = (error && error.code) ? String(error.code) : '';
  var MAP  = {
    'auth/user-not-found':          'Utente non trovato.',
    'auth/wrong-password':          'Password errata.',
    'auth/invalid-email':           'Indirizzo email non valido.',
    'auth/email-already-in-use':    'Email già in uso da un altro account.',
    'auth/weak-password':           'La password deve avere almeno 6 caratteri.',
    'auth/too-many-requests':       'Troppi tentativi falliti. Riprova tra qualche minuto.',
    'auth/network-request-failed':  'Errore di connessione. Controlla la rete.',
    'auth/user-disabled':           'Account disabilitato. Contatta l\'amministratore.',
    'auth/requires-recent-login':   'Sessione scaduta. Effettua nuovamente il login.',
    'auth/invalid-credential':      'Credenziali non valide.',
    'auth/operation-not-allowed':   'Operazione non consentita.',
    'auth/popup-closed-by-user':    'Operazione annullata dall\'utente.',
    'auth/account-exists-with-different-credential': 'Esiste già un account con questa email.',
    'permission-denied':            'Accesso negato. Non hai i permessi necessari.',
    'not-found':                    'Documento non trovato.',
    'already-exists':               'Il documento esiste già.',
    'unavailable':                  'Servizio temporaneamente non disponibile. Riprova.',
    'deadline-exceeded':            'Operazione scaduta per timeout. Riprova.',
    'resource-exhausted':           'Limite di operazioni raggiunto.',
    'cancelled':                    'Operazione annullata.',
    'unauthenticated':              'Sessione non autenticata. Effettua il login.',
    'internal':                     'Errore interno del server.',
    'storage/object-not-found':     'File non trovato.',
    'storage/unauthorized':         'Accesso al file non autorizzato.',
    'storage/quota-exceeded':       'Spazio di archiviazione esaurito.',
    'storage/retry-limit-exceeded': 'Impossibile completare il caricamento. Riprova.',
  };
  return MAP[code] || (error && error.message ? error.message : 'Si è verificato un errore imprevisto.');
}


// ============================================================
// SESSION CHECK (protected pages)
// ============================================================

/**
 * Ensures the user is authenticated; redirects to login otherwise.
 * @param {string} [redirectUrl='../pages/login.html']
 * @returns {Promise<firebase.User>}
 */
function requireAuth(redirectUrl) {
  if (redirectUrl === undefined) redirectUrl = _resolveLoginUrl();
  return new Promise(function (resolve, reject) {
    if (typeof firebase === 'undefined') {
      window.location.href = redirectUrl;
      return;
    }
    var unsub = firebase.auth().onAuthStateChanged(function (user) {
      unsub();
      if (user) {
        resolve(user);
      } else {
        window.location.href = redirectUrl;
      }
    }, function (err) {
      window.location.href = redirectUrl;
      reject(err);
    });
  });
}


// ============================================================
// ROLE CHECK
// ============================================================

/**
 * Ensures the authenticated user has one of the required roles.
 * @param {string|string[]} roles
 * @param {string} [redirectUrl='../pages/dashboard.html']
 * @returns {Promise<{user, role, data}>}
 */
function requireRole(roles, redirectUrl) {
  if (redirectUrl === undefined) redirectUrl = _resolveDashboardUrl();
  if (typeof roles === 'string') roles = [roles];

  return new Promise(function (resolve, reject) {
    if (typeof firebase === 'undefined') {
      window.location.href = _resolveLoginUrl();
      return;
    }
    var unsub = firebase.auth().onAuthStateChanged(function (user) {
      unsub();
      if (!user) { window.location.href = _resolveLoginUrl(); return; }

      firebase.firestore().collection('users').doc(user.uid).get()
        .then(function (doc) {
          if (!doc.exists) { window.location.href = redirectUrl; return; }
          var data     = doc.data();
          var userRole = data.ruolo || data.role || '';
          if (roles.indexOf(userRole) === -1) {
            showToast('Non hai i permessi per accedere a questa sezione.', 'error');
            setTimeout(function () { window.location.href = redirectUrl; }, 1600);
            reject(new Error('insufficient_role'));
          } else {
            resolve({ user: user, role: userRole, data: data });
          }
        })
        .catch(function (err) {
          window.location.href = redirectUrl;
          reject(err);
        });
    }, function (err) {
      window.location.href = _resolveLoginUrl();
      reject(err);
    });
  });
}


// ============================================================
// USER INFO DISPLAY
// ============================================================

/**
 * Updates navbar / header elements with the logged-in user's info.
 * Looks for elements by id (user-name, user-email, user-avatar) and
 * also by data attributes (data-user-name, data-user-email, data-user-avatar).
 * @param {firebase.User} user
 */
function displayUserInfo(user) {
  if (!user) return;

  var nameEl   = document.getElementById('user-name')   || document.querySelector('[data-user-name]');
  var emailEl  = document.getElementById('user-email')  || document.querySelector('[data-user-email]');
  var avatarEl = document.getElementById('user-avatar') || document.querySelector('[data-user-avatar]');

  var displayName = '';
  if (window.currentUserData && (window.currentUserData.nome || window.currentUserData.cognome)) {
    displayName = ((window.currentUserData.nome || '') + ' ' + (window.currentUserData.cognome || '')).trim();
  } else if (user.displayName) {
    displayName = user.displayName;
  } else {
    displayName = user.email || 'Utente';
  }

  if (nameEl)  nameEl.textContent  = displayName;
  if (emailEl) emailEl.textContent = user.email || '';

  if (avatarEl) {
    var initials = '';
    if (window.currentUserData && (window.currentUserData.nome || window.currentUserData.cognome)) {
      initials = getInitials(window.currentUserData.nome || '', window.currentUserData.cognome || '');
    } else if (user.displayName) {
      var parts = user.displayName.split(' ');
      initials = getInitials(parts[0] || '', parts[1] || '');
    } else {
      initials = (user.email || 'U')[0].toUpperCase();
    }
    avatarEl.textContent = initials;
  }
}


// ============================================================
// INIT UI
// ============================================================

/**
 * Sets up global UI behaviour:
 *  - Close modal on backdrop click
 *  - data-open-modal / data-close-modal buttons
 *  - Escape key closes all modals
 *  - Injects shared CSS (stato badges, spinner)
 */
function initUI() {
  // Shared CSS injections
  _injectStatoStyles();
  _injectSpinnerStyle();

  // Delegate modal open/close via data attributes
  document.addEventListener('click', function (e) {
    var target = e.target;

    // Click on modal backdrop
    if (target && target.classList && target.classList.contains('modal')) {
      closeAllModals();
      return;
    }

    // data-close-modal button
    var closer = target.closest ? target.closest('[data-close-modal]') :
      (target.dataset && target.dataset.closeModal !== undefined ? target : null);
    if (closer) {
      var id = closer.dataset.closeModal;
      id ? closeModal(id) : closeAllModals();
      return;
    }

    // data-open-modal button
    var opener = target.closest ? target.closest('[data-open-modal]') :
      (target.dataset && target.dataset.openModal !== undefined ? target : null);
    if (opener) {
      var mid = opener.dataset.openModal;
      if (mid) openModal(mid);
    }
  });

  // Escape closes all modals
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllModals();
  });
}

function _injectSpinnerStyle() {
  if (document.getElementById('_util-spin-css')) return;
  var s = document.createElement('style');
  s.id  = '_util-spin-css';
  s.textContent = '@keyframes _spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
}

function _injectStatoStyles() {
  if (document.getElementById('_util-stato-css')) return;
  var s = document.createElement('style');
  s.id  = '_util-stato-css';
  s.textContent = [
    '.stato-badge{display:inline-block;padding:.18rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}',
    '.stato-aperto{background:#dbeafe;color:#1e40af}',
    '.stato-in-corso{background:#fef9c3;color:#713f12}',
    '.stato-sospeso{background:#ffedd5;color:#9a3412}',
    '.stato-chiuso{background:#dcfce7;color:#166534}',
    '.stato-archiviato{background:#f3f4f6;color:#374151}',
    '.stato-urgente{background:#fee2e2;color:#991b1b}',
    '.stato-unknown{background:#f3f4f6;color:#6b7280}'
  ].join('');
  document.head.appendChild(s);
}


// ============================================================
// INTERNAL HELPERS
// ============================================================

function _resolveLoginUrl() {
  var path = window.location.pathname;
  if (path.indexOf('/pages/') !== -1) return 'login.html';
  var depth = path.replace(/^\//, '').split('/').filter(Boolean).length;
  return depth >= 2 ? '../pages/login.html' : 'pages/login.html';
}

function _resolveDashboardUrl() {
  var path = window.location.pathname;
  if (path.indexOf('/pages/') !== -1) return 'dashboard.html';
  var depth = path.replace(/^\//, '').split('/').filter(Boolean).length;
  return depth >= 2 ? '../pages/dashboard.html' : 'pages/dashboard.html';
}


// Auto-run initUI when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}
