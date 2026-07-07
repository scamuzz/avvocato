// ============================================================
// RICHIESTE.JS — Contact request management
// ============================================================

var _richList      = [];
var _richFiltered  = [];
var _activeStato   = '';
var _currentRichId = null;

document.addEventListener('app:authReady', function() {
  loadRichieste();
});

// ── Helpers ───────────────────────────────────────────────────

function _richBadge(stato) {
  var cls = 'badge ';
  switch (stato) {
    case 'Nuova':       cls += 'badge-danger';  break;
    case 'In gestione': cls += 'badge-warning'; break;
    case 'Chiusa':      cls += 'badge-neutral'; break;
    default:            cls += 'badge-neutral';
  }
  return '<span class="' + cls + '">' + escapeHtml(stato || '—') + '</span>';
}

function _fmtDateRich(ts) {
  if (!ts) return '—';
  if (ts.toDate) return formatDate(ts);
  // Fallback: might be a string
  if (typeof ts === 'string') {
    var d = new Date(ts);
    if (!isNaN(d)) return formatDate({ toDate: function() { return d; } });
  }
  return '—';
}

// ── Data loading ──────────────────────────────────────────────

async function loadRichieste() {
  try {
    var snap;
    try {
      snap = await db.collection('richieste').orderBy('data', 'desc').get();
    } catch (e) {
      try {
        // fallback for older records saved with 'dataInvio'
        snap = await db.collection('richieste').orderBy('dataInvio', 'desc').get();
      } catch (e2) {
        // last fallback
        snap = await db.collection('richieste').orderBy('createdAt', 'desc').get();
      }
    }
    _richList = [];
    snap.forEach(function(doc) {
      _richList.push(Object.assign({ id: doc.id }, doc.data()));
    });
    _richFiltered = _richList.slice();
    renderRichieste(_richFiltered);
    loadStats();
  } catch (e) {
    console.error('Errore caricamento richieste:', e);
    document.getElementById('tbl-richieste-body').innerHTML =
      '<tr><td colspan="7" class="text-center text-muted">Errore nel caricamento</td></tr>';
    showToast('Errore nel caricamento delle richieste', 'error');
  }
}

// ── Render table ──────────────────────────────────────────────

function renderRichieste(list) {
  var tbody = document.getElementById('tbl-richieste-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">' + emptyStateHtml('fas fa-envelope', 'Nessuna richiesta trovata') + '</td></tr>';
    return;
  }
  var html = '';
  list.forEach(function(r) {
    var ts = r.data || r.dataInvio || r.createdAt;
    html += '<tr style="cursor:pointer;" onclick="viewRichiesta(\'' + r.id + '\')">';
    html += '<td>' + escapeHtml(r.nome || '—') + '</td>';
    html += '<td>' + escapeHtml(r.email || '—') + '</td>';
    html += '<td>' + escapeHtml(r.telefono || '—') + '</td>';
    html += '<td class="text-truncate" style="max-width:200px;" title="' + escapeHtml(r.messaggio || '') + '">' +
      escapeHtml(truncate(r.messaggio || '', 80)) + '</td>';
    html += '<td>' + _fmtDateRich(ts) + '</td>';
    html += '<td>' + _richBadge(r.stato) + '</td>';
    html += '<td class="table-actions" onclick="event.stopPropagation();">';
    html += '<button class="btn btn-ghost btn-sm btn-icon" title="Dettaglio" onclick="viewRichiesta(\'' + r.id + '\')">';
    html += '<i class="fas fa-eye"></i></button> ';
    html += '<button class="btn btn-danger btn-sm btn-icon" title="Elimina" onclick="deleteRichiesta(\'' + r.id + '\')">';
    html += '<i class="fas fa-trash"></i></button>';
    html += '</td></tr>';
  });
  tbody.innerHTML = html;
}

// ── Stats ─────────────────────────────────────────────────────

function loadStats() {
  var nuova    = 0;
  var gestione = 0;
  var chiusa   = 0;
  _richList.forEach(function(r) {
    if (r.stato === 'Nuova')       nuova++;
    else if (r.stato === 'In gestione') gestione++;
    else if (r.stato === 'Chiusa') chiusa++;
    else nuova++; // default unmapped = nuova
  });
  document.getElementById('stat-nuova').textContent    = nuova;
  document.getElementById('stat-gestione').textContent = gestione;
  document.getElementById('stat-chiusa').textContent   = chiusa;
}

// ── Detail modal ──────────────────────────────────────────────

function viewRichiesta(id) {
  var r = _richList.find(function(x) { return x.id === id; });
  if (!r) return;
  _currentRichId = id;
  var ts = r.data || r.dataInvio || r.createdAt;
  document.getElementById('rd-nome').textContent      = r.nome || '—';
  document.getElementById('rd-email').textContent     = r.email || '—';
  document.getElementById('rd-telefono').textContent  = r.telefono || '—';
  document.getElementById('rd-messaggio').textContent = r.messaggio || '—';
  document.getElementById('rd-data').textContent      = _fmtDateRich(ts);
  document.getElementById('rd-stato').value           = r.stato || 'Nuova';
  document.getElementById('rd-btn-save').onclick   = function() { updateStatoRichiesta(id, document.getElementById('rd-stato').value); };
  document.getElementById('rd-btn-delete').onclick = function() { deleteRichiesta(id); };
  openModal('modal-richiesta-detail');
}

// ── Update stato ──────────────────────────────────────────────

async function updateStatoRichiesta(id, stato) {
  try {
    await db.collection('richieste').doc(id).update({
      stato:     stato,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Stato aggiornato', 'success');
    closeModal('modal-richiesta-detail');
    loadRichieste();
  } catch (e) {
    console.error(e);
    showToast('Errore nell\'aggiornamento', 'error');
  }
}

// ── Delete ────────────────────────────────────────────────────

async function deleteRichiesta(id) {
  if (!confirm('Sei sicuro di voler eliminare questa richiesta?')) return;
  try {
    await db.collection('richieste').doc(id).delete();
    showToast('Richiesta eliminata', 'success');
    closeModal('modal-richiesta-detail');
    loadRichieste();
  } catch (e) {
    console.error(e);
    showToast('Errore nell\'eliminazione', 'error');
  }
}

// ── Filter ────────────────────────────────────────────────────

function filterByStato(stato) {
  _activeStato = stato;
  // Update active button
  var btns = document.querySelectorAll('#stato-filter-btns .stato-filter-btn');
  btns.forEach(function(btn) {
    btn.classList.remove('active');
  });
  // Find clicked button by matching text content
  btns.forEach(function(btn) {
    var btnText = btn.textContent.trim();
    if (stato === '' && btnText === 'Tutti') {
      btn.classList.add('active');
    } else if (stato !== '' && btnText.indexOf(stato) !== -1) {
      btn.classList.add('active');
    }
  });

  if (!stato) {
    _richFiltered = _richList.slice();
  } else {
    _richFiltered = _richList.filter(function(r) {
      return r.stato === stato || (!r.stato && stato === 'Nuova');
    });
  }
  renderRichieste(_richFiltered);
}
