// ============================================================
// UDIENZE.JS — Hearing management
// ============================================================

var _udList      = [];
var _udFiltered  = [];
var _udEditingId = null;
var _praticheUdMap = {};

document.addEventListener('app:authReady', function() {
  loadUdienze();
  loadPraticheDropdown();
});

function _fmtDateUd(str) {
  if (!str) return '—';
  var p = str.split('-');
  if (p.length !== 3) return str;
  return p[2] + '/' + p[1] + '/' + p[0];
}

function _monthAbbr(str) {
  var months = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  if (!str) return '';
  var p = str.split('-');
  if (p.length < 2) return '';
  return months[parseInt(p[1], 10) - 1] || '';
}

function _dayNum(str) {
  if (!str) return '';
  var p = str.split('-');
  return p[2] ? String(parseInt(p[2], 10)) : '';
}

function _isUpcoming(dataStr) {
  if (!dataStr) return false;
  var today = new Date();
  today.setHours(0,0,0,0);
  var d = new Date(dataStr + 'T00:00:00');
  var diff = Math.floor((d - today) / 86400000);
  return diff >= 0 && diff <= 7;
}

async function loadUdienze() {
  try {
    var snap = await db.collection('udienze').orderBy('data', 'asc').get();
    _udList = [];
    snap.forEach(function(doc) {
      _udList.push(Object.assign({ id: doc.id }, doc.data()));
    });
    _udFiltered = _udList.slice();
    renderUdienze(_udFiltered);
    loadProssimeUdienze();
  } catch (e) {
    console.error('Errore caricamento udienze:', e);
    var tbody = document.getElementById('tbl-udienze-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Errore nel caricamento</td></tr>';
    showToast('Errore nel caricamento delle udienze', 'error');
  }
}

function loadProssimeUdienze() {
  var container = document.getElementById('prossime-udienze-list');
  if (!container) return;
  var prossime = _udList.filter(function(u) { return _isUpcoming(u.data); });
  prossime.sort(function(a, b) { return (a.data || '').localeCompare(b.data || ''); });
  if (prossime.length === 0) {
    container.innerHTML = '<p class="text-muted text-sm">Nessuna udienza nei prossimi 7 giorni</p>';
    return;
  }
  var html = '';
  prossime.forEach(function(u) {
    var pratica = _praticheUdMap[u.praticaId] || u.praticaId || '—';
    html += '<div class="prossime-item">';
    html += '<div class="prossime-date-box"><div class="day">' + _dayNum(u.data) + '</div><div class="month">' + _monthAbbr(u.data) + '</div></div>';
    html += '<div class="prossime-info"><div class="prossime-tribunale">' + escapeHtml(u.tribunale || '—') + '</div>';
    html += '<div class="prossime-meta">' + escapeHtml(u.ora || '') + ' · ' + escapeHtml(pratica) + '</div>';
    if (u.giudice) html += '<div class="prossime-meta">Giudice: ' + escapeHtml(u.giudice) + '</div>';
    html += '</div>';
    html += '<button class="btn btn-ghost btn-sm btn-icon" onclick="openEditUdModal(\'' + u.id + '\')" title="Modifica"><i class="fas fa-edit"></i></button>';
    html += '</div>';
  });
  container.innerHTML = html;
}

function renderUdienze(list) {
  var tbody = document.getElementById('tbl-udienze-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">' + emptyStateHtml('fas fa-gavel', 'Nessuna udienza trovata') + '</td></tr>';
    return;
  }
  var html = '';
  list.forEach(function(u) {
    var pratica  = _praticheUdMap[u.praticaId] || u.praticaId || '—';
    var rowClass = _isUpcoming(u.data) ? ' class="upcoming"' : '';
    html += '<tr' + rowClass + '>';
    html += '<td>' + _fmtDateUd(u.data) + '</td>';
    html += '<td>' + escapeHtml(u.ora || '—') + '</td>';
    html += '<td>' + escapeHtml(u.tribunale || '—') + '</td>';
    html += '<td>' + escapeHtml(u.giudice || '—') + '</td>';
    html += '<td>' + escapeHtml(pratica) + '</td>';
    html += '<td class="text-truncate" style="max-width:200px;" title="' + escapeHtml(u.note || '') + '">' + escapeHtml(truncate(u.note || '', 60)) + '</td>';
    html += '<td class="table-actions">';
    html += '<button class="btn btn-ghost btn-sm btn-icon" title="Modifica" onclick="openEditUdModal(\'' + u.id + '\')">';
    html += '<i class="fas fa-edit"></i></button> ';
    html += '<button class="btn btn-danger btn-sm btn-icon" title="Elimina" onclick="deleteUdienza(\'' + u.id + '\')">';
    html += '<i class="fas fa-trash"></i></button>';
    html += '</td></tr>';
  });
  tbody.innerHTML = html;
}

function applyUdFilters() {
  var praticaId = document.getElementById('filter-pratica-ud').value;
  var da        = document.getElementById('filter-da').value;
  var a         = document.getElementById('filter-a').value;
  _udFiltered = _udList.filter(function(u) {
    if (praticaId && u.praticaId !== praticaId) return false;
    if (da && u.data && u.data < da) return false;
    if (a  && u.data && u.data > a)  return false;
    return true;
  });
  renderUdienze(_udFiltered);
}

function openNewUdModal() {
  _udEditingId = null;
  document.getElementById('modal-ud-title').textContent = 'Nuova Udienza';
  document.getElementById('f-ud-praticaId').value = '';
  document.getElementById('f-ud-data').value      = '';
  document.getElementById('f-ud-ora').value       = '';
  document.getElementById('f-ud-tribunale').value = '';
  document.getElementById('f-ud-giudice').value   = '';
  document.getElementById('f-ud-note').value      = '';
  openModal('modal-udienza');
}

function openEditUdModal(id) {
  var ud = _udList.find(function(u) { return u.id === id; });
  if (!ud) return;
  _udEditingId = id;
  document.getElementById('modal-ud-title').textContent = 'Modifica Udienza';
  document.getElementById('f-ud-praticaId').value = ud.praticaId || '';
  document.getElementById('f-ud-data').value      = ud.data || '';
  document.getElementById('f-ud-ora').value       = ud.ora || '';
  document.getElementById('f-ud-tribunale').value = ud.tribunale || '';
  document.getElementById('f-ud-giudice').value   = ud.giudice || '';
  document.getElementById('f-ud-note').value      = ud.note || '';
  openModal('modal-udienza');
}

async function saveUdienza() {
  var praticaId = document.getElementById('f-ud-praticaId').value;
  var data      = document.getElementById('f-ud-data').value;
  var ora       = document.getElementById('f-ud-ora').value;
  var tribunale = document.getElementById('f-ud-tribunale').value.trim();
  var giudice   = document.getElementById('f-ud-giudice').value.trim();
  var note      = document.getElementById('f-ud-note').value.trim();
  if (!praticaId) { showToast('La pratica è obbligatoria', 'error'); return; }
  if (!tribunale) { showToast('Il tribunale è obbligatorio', 'error'); return; }
  if (!data)      { showToast('La data è obbligatoria', 'error'); return; }
  if (!ora)       { showToast("L'ora è obbligatoria", 'error'); return; }
  var payload = { praticaId: praticaId, data: data, ora: ora, tribunale: tribunale, giudice: giudice, note: note };
  try {
    if (_udEditingId) { await updateUdienza(_udEditingId, payload); showToast('Udienza aggiornata', 'success'); }
    else              { await addUdienza(payload);                   showToast('Udienza creata', 'success'); }
    closeModal('modal-udienza');
    loadUdienze();
  } catch (e) { console.error(e); showToast('Errore nel salvataggio', 'error'); }
}

async function addUdienza(data) {
  return db.collection('udienze').add(Object.assign({}, data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
}

async function updateUdienza(id, data) {
  return db.collection('udienze').doc(id).update(Object.assign({}, data, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
}

async function deleteUdienza(id) {
  if (!confirm('Sei sicuro di voler eliminare questa udienza?')) return;
  try {
    await db.collection('udienze').doc(id).delete();
    showToast('Udienza eliminata', 'success');
    loadUdienze();
  } catch (e) { console.error(e); showToast("Errore nell'eliminazione", 'error'); }
}

async function loadPraticheDropdown() {
  try {
    var snap = await db.collection('pratiche').orderBy('titolo').get();
    var selFilter = document.getElementById('filter-pratica-ud');
    var selForm   = document.getElementById('f-ud-praticaId');
    if (selFilter) selFilter.innerHTML = '<option value="">Tutte le pratiche</option>';
    if (selForm)   selForm.innerHTML   = '<option value="">Seleziona pratica...</option>';
    _praticheUdMap = {};
    snap.forEach(function(doc) {
      var p = doc.data();
      _praticheUdMap[doc.id] = p.titolo || ('Pratica ' + doc.id);
      var label = p.titolo || ('Pratica ' + doc.id);
      var makeOpt = function(val, text) { var o = document.createElement('option'); o.value = val; o.textContent = text; return o; };
      if (selFilter) selFilter.appendChild(makeOpt(doc.id, label));
      if (selForm)   selForm.appendChild(makeOpt(doc.id, label));
    });
    if (_udFiltered.length) renderUdienze(_udFiltered);
    loadProssimeUdienze();
  } catch (e) { console.error('Errore caricamento pratiche:', e); }
}
