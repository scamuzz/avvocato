// ============================================================
// PRATICHE.JS — CRUD completo per la gestione pratiche
// ============================================================
// Funzioni pubbliche:
//   loadPratiche()            — listener Firestore in tempo reale
//   loadClientiDropdown()     — popola <select> nel modale
//   renderPratiche(arr)       — costruisce le righe tabella
//   addPratica(data)          — aggiunge a Firestore
//   updatePratica(id, data)   — aggiorna documento
//   deletePratica(id)         — elimina pratica + documenti + note correlati
//   filterPratiche(s,p,q)     — filtra in memoria
//   applyFilters()            — legge i controlli UI e applica i filtri
//   openAddModal()
//   openEditModal(id)
//   confirmDelete(id, title)
// ============================================================

var _allPratiche      = [];          // cache locale
var _allClientiMap    = {};          // { id: "Cognome Nome" }
var _deleteTargetId   = null;
var _unsubPratiche    = null;

// --- Init ---

function initPratiche() {
  // URL ?new=1 → apre subito il modale
  if (new URLSearchParams(window.location.search).get('new') === '1') {
    auth.onAuthStateChanged(function (user) {
      if (user) setTimeout(openAddModal, 400);
    });
  }
  loadClientiDropdown();
  loadPratiche();
}

// --- Caricamento ---

function loadPratiche() {
  if (_unsubPratiche) _unsubPratiche();

  _unsubPratiche = db.collection('pratiche')
    .orderBy('updatedAt', 'desc')
    .onSnapshot(function (snap) {
      _allPratiche = [];
      snap.forEach(function (doc) {
        _allPratiche.push(Object.assign({ id: doc.id }, doc.data()));
      });
      applyFilters();
    }, function (err) {
      console.error('loadPratiche error:', err);
      showToast('Errore nel caricamento delle pratiche', 'error');
    });
}

function loadClientiDropdown() {
  db.collection('clienti').orderBy('cognome').get()
    .then(function (snap) {
      _allClientiMap = {};
      var opts = '<option value="">— Seleziona cliente —</option>';
      snap.forEach(function (doc) {
        var d = doc.data();
        var label = ((d.cognome || '') + ' ' + (d.nome || '')).trim();
        _allClientiMap[doc.id] = ((d.nome || '') + ' ' + (d.cognome || '')).trim();
        opts += '<option value="' + doc.id + '">' + escapeHtml(label) + '</option>';
      });
      var sel = document.getElementById('fClienteId');
      if (sel) sel.innerHTML = opts;
    })
    .catch(function (err) {
      console.warn('loadClientiDropdown:', err);
    });
}

// --- Rendering ---

function renderPratiche(pratiche) {
  var tbody = document.getElementById('praticheTableBody');
  if (!tbody) return;

  if (!pratiche.length) {
    tbody.innerHTML =
      '<tr><td colspan="7">' +
        emptyStateHtml('fas fa-briefcase', 'Nessuna pratica trovata') +
      '</td></tr>';
    return;
  }

  tbody.innerHTML = pratiche.map(function (p) {
    var stripeColor = { Alta: '#dc2626', Media: '#d97706', Bassa: '#059669' }[p.priorita] || '#e5e7eb';
    var clienteLabel = escapeHtml(p.clienteNome || _allClientiMap[p.clienteId] || '—');
    var safeTitle    = escapeHtml(p.titolo || '').replace(/'/g, "\\'");
    return '<tr>' +
      '<td style="width:4px;padding:0;background:' + stripeColor + ';border-radius:2px 0 0 2px;"></td>' +
      '<td>' +
        '<div class="pratica-titolo">' + escapeHtml(p.titolo || '—') + '</div>' +
        (p.numeroFascicolo
          ? '<div class="pratica-fascicolo">Fasc. ' + escapeHtml(p.numeroFascicolo) + '</div>'
          : '') +
      '</td>' +
      '<td>' + clienteLabel + '</td>' +
      '<td>' + statoBadge(p.stato) + '</td>' +
      '<td>' + prioritaBadge(p.priorita) + '</td>' +
      '<td style="white-space:nowrap;">' + formatDate(p.dataApertura) + '</td>' +
      '<td>' +
        '<div class="action-btns">' +
          '<button class="btn btn-sm btn-outline" title="Dettaglio" ' +
                  'onclick="viewPratica(\'' + p.id + '\')">' +
            '<i class="fas fa-eye"></i>' +
          '</button>' +
          '<button class="btn btn-sm btn-primary" title="Modifica" ' +
                  'onclick="openEditModal(\'' + p.id + '\')">' +
            '<i class="fas fa-edit"></i>' +
          '</button>' +
          '<button class="btn btn-sm btn-danger" title="Elimina" ' +
                  'onclick="confirmDelete(\'' + p.id + '\', \'' + safeTitle + '\')">' +
            '<i class="fas fa-trash"></i>' +
          '</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

// --- Filtri ---

function applyFilters() {
  var stato    = _val('filterStato');
  var priorita = _val('filterPriorita');
  var search   = _val('filterSearch').toLowerCase().trim();
  filterPratiche(stato, priorita, search);
}

function filterPratiche(stato, priorita, search) {
  var filtered = _allPratiche.filter(function (p) {
    if (stato    && p.stato    !== stato)    return false;
    if (priorita && p.priorita !== priorita) return false;
    if (search) {
      var hay = [
        p.titolo, p.clienteNome, _allClientiMap[p.clienteId],
        p.numeroFascicolo, p.descrizione
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  _updatePraticheCount(filtered.length, _allPratiche.length, !!(stato || priorita || search));
  renderPratiche(filtered);
}

function resetFilters() {
  ['filterStato', 'filterPriorita', 'filterSearch'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  applyFilters();
}

function _updatePraticheCount(shown, total, filtered) {
  var el = document.getElementById('praticheCount');
  if (!el) return;
  if (filtered && shown !== total) {
    el.textContent = shown + ' di ' + total + ' pratica' + (total !== 1 ? 'he' : '');
  } else {
    el.textContent = total + ' pratica' + (total !== 1 ? 'he' : '');
  }
}

function _val(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

// --- Navigazione ---

function viewPratica(id) {
  window.location.href = 'profilo-pratica.html?id=' + encodeURIComponent(id);
}

// --- Modale add/edit ---

function openAddModal() {
  document.getElementById('praticaModalTitle').textContent = 'Nuova Pratica';
  document.getElementById('praticaForm').reset();
  document.getElementById('praticaId').value        = '';
  document.getElementById('fDataApertura').value    = todayStr();
  document.getElementById('fStato').value           = 'Aperta';
  document.getElementById('fPriorita').value        = 'Media';
  openModal('praticaModal');
}

function openEditModal(id) {
  var p = _allPratiche.find(function (x) { return x.id === id; });
  if (!p) { showToast('Pratica non trovata', 'error'); return; }

  document.getElementById('praticaModalTitle').textContent = 'Modifica Pratica';
  document.getElementById('praticaId').value               = id;
  document.getElementById('fTitolo').value                 = p.titolo          || '';
  document.getElementById('fDescrizione').value            = p.descrizione     || '';
  document.getElementById('fClienteId').value              = p.clienteId       || '';
  document.getElementById('fStato').value                  = p.stato           || 'Aperta';
  document.getElementById('fPriorita').value               = p.priorita        || 'Media';
  document.getElementById('fNumeroFascicolo').value        = p.numeroFascicolo || '';

  if (p.dataApertura) {
    var d = p.dataApertura.toDate ? p.dataApertura.toDate() : new Date(p.dataApertura);
    document.getElementById('fDataApertura').value = d.toISOString().split('T')[0];
  } else {
    document.getElementById('fDataApertura').value = '';
  }

  openModal('praticaModal');
}

// --- Submit form ---

function submitPraticaForm(e) {
  e.preventDefault();
  var id = document.getElementById('praticaId').value;

  var clienteId   = _val('fClienteId');
  var clienteNome = _allClientiMap[clienteId] || '';

  if (!clienteId) {
    showToast('Selezionare un cliente', 'warning');
    return;
  }

  var dateVal     = _val('fDataApertura');
  var dataApertura = dateVal
    ? firebase.firestore.Timestamp.fromDate(new Date(dateVal + 'T00:00:00'))
    : null;

  var data = {
    titolo:          _val('fTitolo').trim(),
    descrizione:     _val('fDescrizione').trim(),
    clienteId:       clienteId,
    clienteNome:     clienteNome,
    stato:           _val('fStato'),
    priorita:        _val('fPriorita'),
    dataApertura:    dataApertura,
    numeroFascicolo: _val('fNumeroFascicolo').trim()
  };

  if (!data.titolo) {
    showToast('Il titolo è obbligatorio', 'warning');
    return;
  }

  var btn = document.getElementById('praticaSubmitBtn');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio…';

  var promise = id ? updatePratica(id, data) : addPratica(data);
  promise
    .then(function () {
      closeModal('praticaModal');
      showToast(id ? 'Pratica aggiornata' : 'Pratica creata con successo', 'success');
    })
    .catch(function (err) {
      console.error('Salvataggio pratica:', err);
      showToast('Errore: ' + (err.message || err), 'error');
    })
    .finally(function () {
      btn.disabled  = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Salva';
    });
}

// --- CRUD Firestore ---

function addPratica(data) {
  data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  return db.collection('pratiche').add(data);
}

function updatePratica(id, data) {
  data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  return db.collection('pratiche').doc(id).update(data);
}

function deletePratica(id) {
  // Elimina la pratica e tutte le note/documenti correlati in batch
  return Promise.all([
    db.collection('documenti').where('praticaId', '==', id).get(),
    db.collection('note').where('praticaId', '==', id).get()
  ]).then(function (results) {
    var batch = db.batch();
    batch.delete(db.collection('pratiche').doc(id));
    results.forEach(function (snap) {
      snap.forEach(function (doc) { batch.delete(doc.ref); });
    });
    return batch.commit();
  });
}

// --- Conferma eliminazione ---

function confirmDelete(id, title) {
  _deleteTargetId = id;
  document.getElementById('confirmDeleteMsg').textContent =
    'Sei sicuro di voler eliminare la pratica "' + title + '"? ' +
    'Documenti e note associati verranno eliminati. L\'operazione è irreversibile.';
  document.getElementById('confirmDeleteOverlay').classList.add('active');
}

function closeConfirmDelete() {
  _deleteTargetId = null;
  document.getElementById('confirmDeleteOverlay').classList.remove('active');
}

function executeDelete() {
  if (!_deleteTargetId) return;
  var id  = _deleteTargetId;
  var btn = document.getElementById('confirmDeleteBtn');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminazione…';

  deletePratica(id)
    .then(function () {
      closeConfirmDelete();
      showToast('Pratica eliminata', 'success');
    })
    .catch(function (err) {
      console.error('deletePratica:', err);
      showToast('Errore: ' + (err.message || err), 'error');
      btn.disabled  = false;
      btn.innerHTML = '<i class="fas fa-trash"></i> Elimina';
    });
}

// --- Event listeners + bootstrap ---

document.addEventListener('DOMContentLoaded', function () {
  var praticaModal = document.getElementById('praticaModal');
  if (praticaModal) {
    praticaModal.addEventListener('click', function (e) {
      if (e.target === praticaModal) closeModal('praticaModal');
    });
  }

  var confirmOverlay = document.getElementById('confirmDeleteOverlay');
  if (confirmOverlay) {
    confirmOverlay.addEventListener('click', function (e) {
      if (e.target === confirmOverlay) closeConfirmDelete();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModal('praticaModal');
      closeConfirmDelete();
    }
  });

  initPratiche();
});
