// ============================================================
// NOTE.JS — Internal notes management
// ============================================================

var _noteList        = [];
var _noteFiltered    = [];
var _noteEditingId   = null;
var _praticheNoteMap = {};

document.addEventListener('app:authReady', function() {
  loadNote();
  loadPraticheNoteDropdown();
});

// ── Helpers ───────────────────────────────────────────────────

function _fmtDateNote(ts) {
  if (!ts) return '—';
  if (ts.toDate) return formatDate(ts);
  return '—';
}

// ── Data loading ──────────────────────────────────────────────

async function loadNote() {
  var container = document.getElementById('note-list');
  try {
    var snap = await db.collection('note').orderBy('dataCreazione', 'desc').get();
    _noteList = [];
    snap.forEach(function(doc) {
      _noteList.push(Object.assign({ id: doc.id }, doc.data()));
    });
    _noteFiltered = _noteList.slice();
    renderNote(_noteFiltered);
  } catch (e) {
    console.error('Errore caricamento note:', e);
    container.innerHTML = '<div class="alert alert-error">Errore nel caricamento delle note</div>';
    showToast('Errore nel caricamento delle note', 'error');
  }
}

// ── Render list ───────────────────────────────────────────────

function renderNote(list) {
  var container = document.getElementById('note-list');
  if (!list || list.length === 0) {
    container.innerHTML = emptyStateHtml('fas fa-sticky-note', 'Nessuna nota trovata');
    return;
  }
  var html = '';
  list.forEach(function(nota) {
    var pratica  = _praticheNoteMap[nota.praticaId] || nota.praticaId || '—';
    var excerpt  = truncate(nota.contenuto || '', 200);
    var dataStr  = _fmtDateNote(nota.dataCreazione);
    html += '<div class="note-card" onclick="viewNota(\'' + nota.id + '\')">';
    html += '<div class="note-card-header">';
    html += '<span class="badge badge-info"><i class="fas fa-folder-open"></i> ' + escapeHtml(pratica) + '</span>';
    html += '<span class="badge badge-neutral text-sm"><i class="fas fa-lock"></i> Interno</span>';
    html += '</div>';
    html += '<div class="note-card-body">' + escapeHtml(excerpt) + (nota.contenuto && nota.contenuto.length > 200 ? '...' : '') + '</div>';
    html += '<div class="note-card-footer">';
    html += '<span class="note-card-meta"><i class="fas fa-user"></i> ' + escapeHtml(nota.autore || 'Avvocato') + '</span>';
    html += '<span class="note-card-meta"><i class="fas fa-calendar"></i> ' + dataStr + '</span>';
    html += '</div></div>';
  });
  container.innerHTML = html;
}

// ── View note detail ──────────────────────────────────────────

function viewNota(id) {
  var nota = _noteList.find(function(n) { return n.id === id; });
  if (!nota) return;
  var pratica = _praticheNoteMap[nota.praticaId] || nota.praticaId || '—';
  document.getElementById('detail-pratica-badge').innerHTML =
    '<span class="badge badge-info"><i class="fas fa-folder-open"></i> ' + escapeHtml(pratica) + '</span>' +
    '<span class="badge badge-neutral"><i class="fas fa-lock"></i> Uso interno</span>';
  document.getElementById('detail-contenuto').textContent = nota.contenuto || '';
  document.getElementById('detail-autore').textContent = nota.autore || 'Avvocato';
  document.getElementById('detail-data').textContent   = _fmtDateNote(nota.dataCreazione);
  document.getElementById('detail-btn-edit').onclick   = function() { closeModal('modal-nota-detail'); openEditNotaModal(id); };
  document.getElementById('detail-btn-delete').onclick = function() { deleteNota(id); };
  openModal('modal-nota-detail');
}

// ── Modal management ──────────────────────────────────────────

function openNewNotaModal() {
  _noteEditingId = null;
  document.getElementById('modal-nota-form-title').textContent = 'Nuova Nota';
  document.getElementById('nf-praticaId').value = '';
  document.getElementById('nf-contenuto').value = '';
  openModal('modal-nota-form');
}

function openEditNotaModal(id) {
  var nota = _noteList.find(function(n) { return n.id === id; });
  if (!nota) return;
  _noteEditingId = id;
  document.getElementById('modal-nota-form-title').textContent = 'Modifica Nota';
  document.getElementById('nf-praticaId').value = nota.praticaId || '';
  document.getElementById('nf-contenuto').value = nota.contenuto || '';
  openModal('modal-nota-form');
}

// ── Save / CRUD ───────────────────────────────────────────────

async function saveNota() {
  var praticaId = document.getElementById('nf-praticaId').value;
  var contenuto = document.getElementById('nf-contenuto').value.trim();

  if (!praticaId) { showToast('Seleziona una pratica', 'error'); return; }
  if (!contenuto) { showToast('Il contenuto non può essere vuoto', 'error'); return; }

  var payload = { praticaId: praticaId, contenuto: contenuto };

  try {
    if (_noteEditingId) {
      await updateNota(_noteEditingId, payload);
      showToast('Nota aggiornata', 'success');
    } else {
      await addNota(payload);
      showToast('Nota salvata', 'success');
    }
    closeModal('modal-nota-form');
    loadNote();
  } catch (e) {
    console.error(e);
    showToast('Errore nel salvataggio', 'error');
  }
}

async function addNota(data) {
  var currentUser = auth.currentUser;
  return db.collection('note').add(Object.assign({}, data, {
    autore:        currentUser ? (currentUser.email || 'Avvocato') : 'Avvocato',
    dataCreazione: firebase.firestore.FieldValue.serverTimestamp()
  }));
}

async function updateNota(id, data) {
  return db.collection('note').doc(id).update(
    Object.assign({}, data, { dataModifica: firebase.firestore.FieldValue.serverTimestamp() })
  );
}

async function deleteNota(id) {
  if (!confirm('Sei sicuro di voler eliminare questa nota?')) return;
  try {
    closeModal('modal-nota-detail');
    await db.collection('note').doc(id).delete();
    showToast('Nota eliminata', 'success');
    loadNote();
  } catch (e) {
    console.error(e);
    showToast('Errore nell\'eliminazione', 'error');
  }
}

// ── Filter ────────────────────────────────────────────────────

function filterByPratica(praticaId) {
  if (!praticaId) {
    _noteFiltered = _noteList.slice();
  } else {
    _noteFiltered = _noteList.filter(function(n) { return n.praticaId === praticaId; });
  }
  renderNote(_noteFiltered);
}

// ── Dropdown loader ───────────────────────────────────────────

async function loadPraticheNoteDropdown() {
  try {
    var snap = await db.collection('pratiche').orderBy('titolo').get();
    var selFilter = document.getElementById('filter-pratica-note');
    var selForm   = document.getElementById('nf-praticaId');
    selFilter.innerHTML = '<option value="">Tutte le pratiche</option>';
    selForm.innerHTML   = '<option value="">Seleziona pratica...</option>';
    _praticheNoteMap = {};
    snap.forEach(function(doc) {
      var p = doc.data();
      _praticheNoteMap[doc.id] = p.titolo || ('Pratica ' + doc.id);
      var makeOpt = function(val, text) {
        var o = document.createElement('option');
        o.value = val;
        o.textContent = text;
        return o;
      };
      var label = p.titolo || ('Pratica ' + doc.id);
      selFilter.appendChild(makeOpt(doc.id, label));
      selForm.appendChild(makeOpt(doc.id, label));
    });
    if (_noteFiltered.length) renderNote(_noteFiltered);
  } catch (e) {
    console.error('Errore caricamento pratiche:', e);
  }
}
