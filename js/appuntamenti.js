// ============================================================
// APPUNTAMENTI.JS — Appointment management
// ============================================================

var _appList = [];
var _filtered = [];
var _editingId = null;
var _isSaving = false;
var _viewMode = 'lista';
var _calMonth = new Date().getMonth();
var _calYear  = new Date().getFullYear();
var _clientiMap = {};
var _praticheMap = {};

document.addEventListener('DOMContentLoaded', function() {
  _loadAll();
  _loadClientiOpts();
});

// ── Helpers ─────────────────────────────────────────────────

function _fmtDateStr(str) {
  if (!str) return '—';
  var p = str.split('-');
  if (p.length !== 3) return str;
  return p[2] + '/' + p[1] + '/' + p[0];
}

function _appBadge(stato) {
  var cls = 'badge ';
  switch (stato) {
    case 'Programmato': cls += 'badge-info';    break;
    case 'Confermato':  cls += 'badge-success'; break;
    case 'Cancellato':  cls += 'badge-danger';  break;
    case 'Completato':  cls += 'badge-neutral'; break;
    default:            cls += 'badge-neutral';
  }
  return '<span class="' + cls + '">' + escapeHtml(stato || '—') + '</span>';
}

// ── Data loading ─────────────────────────────────────────────

async function _loadAll() {
  var tbody = document.getElementById('tbl-app-body');
  try {
    var snap = await db.collection('appuntamenti').orderBy('data', 'desc').get();
    _appList = [];
    snap.forEach(function(doc) {
      _appList.push(Object.assign({ id: doc.id }, doc.data()));
    });
    _applyFilters();
  } catch (e) {
    console.error('Errore caricamento appuntamenti:', e);
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Errore nel caricamento</td></tr>';
    showToast('Errore nel caricamento degli appuntamenti', 'error');
  }
}

function _applyFilters() {
  var stato = document.getElementById('filter-stato').value;
  var month = document.getElementById('filter-month').value; // "YYYY-MM"

  _filtered = _appList.filter(function(a) {
    var ok = true;
    if (stato && a.stato !== stato) ok = false;
    if (month && a.data) {
      if (a.data.substring(0, 7) !== month) ok = false;
    }
    return ok;
  });

  if (_viewMode === 'lista') {
    renderLista(_filtered);
  } else {
    renderCalendario(_filtered, _calMonth, _calYear);
  }
}

// ── List render ───────────────────────────────────────────────

function renderLista(list) {
  var tbody = document.getElementById('tbl-app-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">' + emptyStateHtml('fas fa-calendar-alt', 'Nessun appuntamento trovato') + '</td></tr>';
    return;
  }
  var html = '';
  list.forEach(function(a) {
    var clienteNome = _clientiMap[a.clienteId] || '—';
    var praticaTit  = a.praticaId ? (_praticheMap[a.praticaId] || a.praticaId) : '—';
    html += '<tr>';
    html += '<td>' + _fmtDateStr(a.data) + '</td>';
    html += '<td>' + escapeHtml(a.ora || '—') + '</td>';
    html += '<td>' + escapeHtml(clienteNome) + '</td>';
    html += '<td>' + escapeHtml(praticaTit) + '</td>';
    html += '<td>' + escapeHtml(a.luogo || '—') + '</td>';
    html += '<td>' + _appBadge(a.stato) + '</td>';
    html += '<td class="table-actions">';
    html += '<button class="btn btn-ghost btn-sm btn-icon" title="Modifica" onclick="openEditAppModal(\'' + a.id + '\')">';
    html += '<i class="fas fa-edit"></i></button> ';
    html += '<button class="btn btn-danger btn-sm btn-icon" title="Elimina" onclick="deleteAppuntamento(\'' + a.id + '\')">';
    html += '<i class="fas fa-trash"></i></button>';
    html += '</td></tr>';
  });
  tbody.innerHTML = html;
}

// ── Calendar render ───────────────────────────────────────────

function renderCalendario(list, month, year) {
  var monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  document.getElementById('cal-month-title').textContent = monthNames[month] + ' ' + year;

  var grid = document.getElementById('cal-grid');
  var dayNamesHtml = '<div class="cal-day-name">Lun</div><div class="cal-day-name">Mar</div>' +
    '<div class="cal-day-name">Mer</div><div class="cal-day-name">Gio</div>' +
    '<div class="cal-day-name">Ven</div><div class="cal-day-name">Sab</div>' +
    '<div class="cal-day-name">Dom</div>';

  var firstDay = new Date(year, month, 1);
  var lastDay  = new Date(year, month + 1, 0);
  var startDow = firstDay.getDay(); // 0=Sun
  startDow = (startDow === 0) ? 6 : startDow - 1; // Mon-based

  var todayDate = new Date();
  var todayStr = todayDate.getFullYear() + '-' +
    String(todayDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(todayDate.getDate()).padStart(2, '0');

  // Group by date
  var byDate = {};
  var monthPrefix = year + '-' + String(month + 1).padStart(2, '0');
  list.forEach(function(a) {
    if (!a.data || a.data.substring(0, 7) !== monthPrefix) return;
    if (!byDate[a.data]) byDate[a.data] = [];
    byDate[a.data].push(a);
  });

  var cells = '';
  for (var i = 0; i < startDow; i++) {
    cells += '<div class="cal-day other-month"></div>';
  }

  for (var d = 1; d <= lastDay.getDate(); d++) {
    var dateStr = monthPrefix + '-' + String(d).padStart(2, '0');
    var cls = 'cal-day' + (dateStr === todayStr ? ' today' : '');
    cells += '<div class="' + cls + '" onclick="openNewAppModalDate(\'' + dateStr + '\')">';
    cells += '<div class="cal-day-num">' + d + '</div>';
    var apps = byDate[dateStr] || [];
    apps.forEach(function(a) {
      var chipCls = 'cal-chip ';
      switch (a.stato) {
        case 'Programmato': chipCls += 'prog'; break;
        case 'Confermato':  chipCls += 'conf'; break;
        case 'Cancellato':  chipCls += 'canc'; break;
        case 'Completato':  chipCls += 'comp'; break;
        default:            chipCls += 'prog';
      }
      var label = (a.ora || '') + ' ' + (_clientiMap[a.clienteId] || 'Cliente');
      cells += '<div class="' + chipCls + '" title="' + escapeHtml(label) + '"' +
        ' onclick="event.stopPropagation(); openEditAppModal(\'' + a.id + '\')">' +
        escapeHtml(label) + '</div>';
    });
    cells += '</div>';
  }

  var totalCells = startDow + lastDay.getDate();
  var remaining  = (7 - (totalCells % 7)) % 7;
  for (var j = 0; j < remaining; j++) {
    cells += '<div class="cal-day other-month"></div>';
  }

  grid.innerHTML = dayNamesHtml + cells;
}

function prevMonth() {
  _calMonth--;
  if (_calMonth < 0) { _calMonth = 11; _calYear--; }
  renderCalendario(_filtered, _calMonth, _calYear);
}

function nextMonth() {
  _calMonth++;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  renderCalendario(_filtered, _calMonth, _calYear);
}

// ── View switch ───────────────────────────────────────────────

function switchView(mode) {
  _viewMode = mode;
  var listView = document.getElementById('list-view');
  var calView  = document.getElementById('calendar-view');
  var btnLista = document.getElementById('btn-lista');
  var btnCal   = document.getElementById('btn-calendario');

  if (mode === 'lista') {
    listView.classList.remove('d-none');
    calView.classList.add('d-none');
    btnLista.classList.add('active');
    btnCal.classList.remove('active');
    renderLista(_filtered);
  } else {
    listView.classList.add('d-none');
    calView.classList.remove('d-none');
    btnLista.classList.remove('active');
    btnCal.classList.add('active');
    renderCalendario(_filtered, _calMonth, _calYear);
  }
}

// ── Modal management ──────────────────────────────────────────

function openNewAppModal() {
  _editingId = null;
  _isSaving = false;
  document.getElementById('modal-app-title').textContent = 'Nuovo Appuntamento';
  document.getElementById('f-clienteId').value   = '';
  document.getElementById('f-praticaId').innerHTML = '<option value="">Nessuna pratica</option>';
  document.getElementById('f-data').value        = '';
  document.getElementById('f-ora').value         = '';
  document.getElementById('f-luogo').value       = '';
  document.getElementById('f-descrizione').value = '';
  document.getElementById('f-stato').value       = 'Programmato';
  _setSaveButtonState(false);
  openModal('modal-appuntamento');
}

function openNewAppModalDate(dateStr) {
  openNewAppModal();
  document.getElementById('f-data').value = dateStr;
}

async function openEditAppModal(id) {
  var app = _appList.find(function(a) { return a.id === id; });
  if (!app) return;
  _editingId = id;
  _isSaving = false;
  document.getElementById('modal-app-title').textContent = 'Modifica Appuntamento';
  document.getElementById('f-clienteId').value   = app.clienteId || '';
  document.getElementById('f-data').value        = app.data || '';
  document.getElementById('f-ora').value         = app.ora || '';
  document.getElementById('f-luogo').value       = app.luogo || '';
  document.getElementById('f-descrizione').value = app.descrizione || '';
  document.getElementById('f-stato').value       = app.stato || 'Programmato';
  await _loadPraticheOpts(app.clienteId, app.praticaId);
  _setSaveButtonState(false);
  openModal('modal-appuntamento');
}

// ── Save / CRUD ───────────────────────────────────────────────

async function saveAppuntamento() {
  if (_isSaving) return;

  var clienteId   = document.getElementById('f-clienteId').value;
  var praticaId   = document.getElementById('f-praticaId').value;
  var data        = document.getElementById('f-data').value;
  var ora         = document.getElementById('f-ora').value;
  var luogo       = document.getElementById('f-luogo').value.trim();
  var descrizione = document.getElementById('f-descrizione').value.trim();
  var stato       = document.getElementById('f-stato').value;

  if (!clienteId) { showToast('Il cliente è obbligatorio', 'error'); return; }
  if (!data)      { showToast('La data è obbligatoria', 'error'); return; }
  if (!ora)       { showToast('L\'ora è obbligatoria', 'error'); return; }

  var payload = {
    clienteId:   clienteId,
    praticaId:   praticaId || null,
    data:        data,
    ora:         ora,
    luogo:       luogo,
    descrizione: descrizione,
    stato:       stato
  };

  _isSaving = true;
  _setSaveButtonState(true);

  try {
    if (_editingId) {
      await updateAppuntamento(_editingId, payload);
      showToast('Appuntamento aggiornato', 'success');
    } else {
      await addAppuntamento(payload);
      showToast('Appuntamento creato', 'success');
    }
    closeModal('modal-appuntamento');
    await _loadAll();
  } catch (e) {
    console.error(e);
    showToast('Errore nel salvataggio', 'error');
  } finally {
    _isSaving = false;
    _setSaveButtonState(false);
  }
}

function _setSaveButtonState(isSaving) {
  var btn = document.getElementById('btn-save-app');
  if (!btn) return;
  btn.disabled = !!isSaving;
  btn.setAttribute('aria-busy', isSaving ? 'true' : 'false');
  btn.innerHTML = isSaving
    ? '<i class="fas fa-spinner fa-spin"></i> Salvataggio...'
    : '<i class="fas fa-save"></i> Salva';
}

async function addAppuntamento(data) {
  return db.collection('appuntamenti').add(
    Object.assign({}, data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() })
  );
}

async function updateAppuntamento(id, data) {
  return db.collection('appuntamenti').doc(id).update(
    Object.assign({}, data, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
  );
}

async function deleteAppuntamento(id) {
  if (!confirm('Sei sicuro di voler eliminare questo appuntamento?')) return;
  try {
    await db.collection('appuntamenti').doc(id).delete();
    showToast('Appuntamento eliminato', 'success');
    _loadAll();
  } catch (e) {
    console.error(e);
    showToast('Errore nell\'eliminazione', 'error');
  }
}

// ── Dropdown loaders ──────────────────────────────────────────

async function _loadClientiOpts() {
  try {
    var snap = await db.collection('clienti').orderBy('cognome').get();
    var sel = document.getElementById('f-clienteId');
    sel.innerHTML = '<option value="">Seleziona cliente...</option>';
    _clientiMap = {};
    snap.forEach(function(doc) {
      var c = doc.data();
      var nome = ((c.nome || '') + ' ' + (c.cognome || '')).trim();
      _clientiMap[doc.id] = nome;
      var opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = nome;
      sel.appendChild(opt);
    });
    // Refresh list view names now that map is populated
    if (_filtered.length) renderLista(_filtered);
  } catch (e) {
    console.error('Errore caricamento clienti:', e);
  }
}

async function _loadPraticheOpts(clienteId, selectedId) {
  var sel = document.getElementById('f-praticaId');
  sel.innerHTML = '<option value="">Nessuna pratica</option>';
  if (!clienteId) return;
  try {
    var snap = await db.collection('pratiche').where('clienteId', '==', clienteId).get();
    snap.forEach(function(doc) {
      var p = doc.data();
      _praticheMap[doc.id] = p.titolo || ('Pratica ' + doc.id);
      var opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = p.titolo || ('Pratica ' + doc.id);
      if (doc.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error('Errore caricamento pratiche:', e);
  }
}
