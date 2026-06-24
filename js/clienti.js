// ============================================================
// CLIENTI.JS — CRUD completo per la gestione clienti
// ============================================================
// Funzioni pubbliche:
//   loadClienti()           — listener Firestore in tempo reale
//   renderClientiTable(arr) — costruisce le righe tabella
//   renderClientiCards(arr) — costruisce la griglia card
//   addCliente(data)        — aggiunge a Firestore
//   updateCliente(id, data) — aggiorna documento
//   deleteCliente(id)       — elimina documento
//   searchClienti(term)     — filtra la lista in memoria
//   viewCliente(id)         — naviga a profilo-cliente.html?id=X
//   openAddModal()          — apre modale vuoto
//   openEditModal(id)       — apre modale pre-compilato
//   confirmDelete(id, name) — mostra dialog conferma
// ============================================================

var _allClienti     = [];          // cache locale
var _currentView    = 'table';     // 'table' | 'card'
var _deleteTargetId = null;        // id cliente da eliminare
var _unsubscribeClienti = null;    // listener Firestore
var _hasAutoOpenedModal = false;

// --- Init ---

function initClienti() {
  // URL ?new=1 → apre subito il modale
  var params = new URLSearchParams(window.location.search);
  if (params.get('new') === '1') {
    var stopAuthWatcher = null;
    var openFromUrl = function () {
      if (_hasAutoOpenedModal) return;
      _hasAutoOpenedModal = true;
      setTimeout(openAddModal, 400);
      params.delete('new');
      var query = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (query ? ('?' + query) : ''));
      if (typeof stopAuthWatcher === 'function') {
        stopAuthWatcher();
        stopAuthWatcher = null;
      }
    };

    if (auth.currentUser) {
      openFromUrl();
    } else {
      stopAuthWatcher = auth.onAuthStateChanged(function (user) {
        if (user) openFromUrl();
      });
      if (_hasAutoOpenedModal && typeof stopAuthWatcher === 'function') {
        stopAuthWatcher();
        stopAuthWatcher = null;
      }
    }
  }
  loadClienti();
}

// --- Caricamento dati ---

function loadClienti() {
  if (_unsubscribeClienti) _unsubscribeClienti();

  _unsubscribeClienti = db.collection('clienti')
    .orderBy('cognome')
    .onSnapshot(function (snap) {
      _allClienti = [];
      snap.forEach(function (doc) {
        _allClienti.push(Object.assign({ id: doc.id }, doc.data()));
      });
      _updateCount(_allClienti.length);
      _renderCurrentView();
    }, function (err) {
      console.error('loadClienti error:', err);
      showToast('Errore nel caricamento dei clienti', 'error');
    });
}

function _updateCount(total) {
  var el = document.getElementById('clientiCount');
  if (el) el.textContent = total + ' cliente' + (total !== 1 ? 'i' : '');
}

// --- Rendering ---

function _renderCurrentView() {
  var term     = (document.getElementById('searchInput') || {}).value || '';
  var filtered = term.trim() ? _filterClienti(term) : _allClienti;

  if (_currentView === 'table') {
    renderClientiTable(filtered);
  } else {
    renderClientiCards(filtered);
  }
}

function renderClientiTable(clienti) {
  var tbody = document.getElementById('clientiTableBody');
  if (!tbody) return;

  if (!clienti.length) {
    tbody.innerHTML =
      '<tr><td colspan="6">' +
        emptyStateHtml('fas fa-users', 'Nessun cliente trovato') +
      '</td></tr>';
    return;
  }

  tbody.innerHTML = clienti.map(function (c) {
    var initials = getInitials(c.nome, c.cognome);
    var fullName = escapeHtml((c.nome || '') + ' ' + (c.cognome || '')).trim();
    return '<tr>' +
      '<td>' +
        '<div class="client-name-cell">' +
          '<div class="avatar-circle">' + escapeHtml(initials) + '</div>' +
          '<div>' +
            '<div class="client-name-text">' + fullName + '</div>' +
            (c.indirizzo
              ? '<div style="font-size:0.73rem;color:#6b7280;">' + escapeHtml(c.indirizzo) + '</div>'
              : '') +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td>' + escapeHtml(c.email || '—') + '</td>' +
      '<td>' + escapeHtml(c.telefono || '—') + '</td>' +
      '<td><code style="font-size:0.8rem;">' + escapeHtml(c.codiceFiscale || '—') + '</code></td>' +
      '<td>' +
        '<a href="pratiche.html" class="badge badge-attesa" ' +
           'style="cursor:pointer;text-decoration:none;" ' +
           'title="Filtra pratiche per questo cliente">' +
          'Vedi pratiche' +
        '</a>' +
      '</td>' +
      '<td>' +
        '<div class="action-btns">' +
          '<button class="btn btn-sm btn-outline" title="Dettaglio" ' +
                  'onclick="viewCliente(\'' + c.id + '\')">' +
            '<i class="fas fa-eye"></i>' +
          '</button>' +
          '<button class="btn btn-sm btn-primary" title="Modifica" ' +
                  'onclick="openEditModal(\'' + c.id + '\')">' +
            '<i class="fas fa-edit"></i>' +
          '</button>' +
          '<button class="btn btn-sm btn-danger" title="Elimina" ' +
                  'onclick="confirmDelete(\'' + c.id + '\')">' +
            '<i class="fas fa-trash"></i>' +
          '</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function renderClientiCards(clienti) {
  var container = document.getElementById('cardView');
  if (!container) return;

  if (!clienti.length) {
    container.innerHTML = emptyStateHtml('fas fa-users', 'Nessun cliente trovato');
    return;
  }

  container.innerHTML =
    '<div class="clienti-cards">' +
    clienti.map(function (c) {
      var initials = getInitials(c.nome, c.cognome);
      var fullName = escapeHtml((c.nome || '') + ' ' + (c.cognome || '')).trim();
      var safeId   = c.id;
      return '<div class="client-card">' +
        '<div class="client-card-header">' +
          '<div class="avatar-lg">' + escapeHtml(initials) + '</div>' +
          '<div>' +
            '<div class="client-card-name">' + fullName + '</div>' +
            (c.codiceFiscale
              ? '<div class="client-card-cf">' + escapeHtml(c.codiceFiscale) + '</div>'
              : '') +
          '</div>' +
        '</div>' +
        '<div class="client-card-body">' +
          (c.email    ? '<span><i class="fas fa-envelope"></i>' + escapeHtml(c.email)    + '</span>' : '') +
          (c.telefono ? '<span><i class="fas fa-phone"></i>'   + escapeHtml(c.telefono) + '</span>' : '') +
          (c.indirizzo? '<span><i class="fas fa-map-marker-alt"></i>' + escapeHtml(c.indirizzo) + '</span>' : '') +
        '</div>' +
        '<div class="client-card-actions">' +
          '<button class="btn btn-sm btn-outline" onclick="viewCliente(\'' + safeId + '\')">' +
            '<i class="fas fa-eye"></i> Dettaglio' +
          '</button>' +
          '<button class="btn btn-sm btn-primary" onclick="openEditModal(\'' + safeId + '\')">' +
            '<i class="fas fa-edit"></i> Modifica' +
          '</button>' +
          '<button class="btn btn-sm btn-danger" onclick="confirmDelete(\'' + safeId + '\')">' +
            '<i class="fas fa-trash"></i>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('') +
    '</div>';
}

// --- Filtro/ricerca ---

function _filterClienti(term) {
  var t = term.toLowerCase().trim();
  return _allClienti.filter(function (c) {
    return (c.nome           || '').toLowerCase().includes(t) ||
           (c.cognome        || '').toLowerCase().includes(t) ||
           (c.email          || '').toLowerCase().includes(t) ||
           (c.telefono       || '').includes(t)               ||
           (c.codiceFiscale  || '').toLowerCase().includes(t) ||
           (c.indirizzo      || '').toLowerCase().includes(t);
  });
}

function searchClienti(term) {
  _renderCurrentView();
}

// --- Cambio vista ---

function switchView(view) {
  _currentView = view;
  var tableView = document.getElementById('tableView');
  var cardView  = document.getElementById('cardView');
  var btnTable  = document.getElementById('btnTableView');
  var btnCard   = document.getElementById('btnCardView');

  if (view === 'table') {
    tableView.style.display = '';
    cardView.style.display  = 'none';
    btnTable.classList.add('active');
    btnCard.classList.remove('active');
  } else {
    tableView.style.display = 'none';
    cardView.style.display  = '';
    btnTable.classList.remove('active');
    btnCard.classList.add('active');
  }
  _renderCurrentView();
}

// --- Navigazione ---

function viewCliente(id) {
  window.location.href = 'profilo-cliente.html?id=' + encodeURIComponent(id);
}

// --- Modale add/edit ---

function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Nuovo Cliente';
  document.getElementById('clienteForm').reset();
  document.getElementById('clienteId').value = '';
  document.getElementById('submitBtn').disabled = false;
  document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Salva';
  openModal('clienteModal');
}

function closeClienteModal() {
  document.getElementById('clienteForm').reset();
  document.getElementById('clienteId').value = '';
  closeModal('clienteModal');
}

function openEditModal(id) {
  var c = _allClienti.find(function (x) { return x.id === id; });
  if (!c) { showToast('Cliente non trovato', 'error'); return; }

  document.getElementById('modalTitle').textContent  = 'Modifica Cliente';
  document.getElementById('clienteId').value         = id;
  document.getElementById('fNome').value             = c.nome          || '';
  document.getElementById('fCognome').value          = c.cognome       || '';
  document.getElementById('fEmail').value            = c.email         || '';
  document.getElementById('fTelefono').value         = c.telefono      || '';
  document.getElementById('fIndirizzo').value        = c.indirizzo     || '';
  document.getElementById('fCodiceFiscale').value    = c.codiceFiscale || '';
  document.getElementById('fNote').value             = c.noteGenerali  || '';
  openModal('clienteModal');
}

// --- Submit form ---

function submitClienteForm(e) {
  e.preventDefault();
  var id = document.getElementById('clienteId').value;

  var data = {
    nome:          document.getElementById('fNome').value.trim(),
    cognome:       document.getElementById('fCognome').value.trim(),
    email:         document.getElementById('fEmail').value.trim(),
    telefono:      document.getElementById('fTelefono').value.trim(),
    indirizzo:     document.getElementById('fIndirizzo').value.trim(),
    codiceFiscale: document.getElementById('fCodiceFiscale').value.trim().toUpperCase(),
    noteGenerali:  document.getElementById('fNote').value.trim()
  };

  // Validazione base
  if (!data.nome || !data.cognome || !data.email) {
    showToast('Compilare i campi obbligatori', 'warning');
    return;
  }

  var btn = document.getElementById('submitBtn');
  btn.disabled    = true;
  btn.innerHTML   = '<i class="fas fa-spinner fa-spin"></i> Salvataggio…';

  var promise = id ? updateCliente(id, data) : addCliente(data);
  promise
    .then(function () {
      closeClienteModal();
      showToast(id ? 'Cliente aggiornato con successo' : 'Cliente aggiunto con successo', 'success');
    })
    .catch(function (err) {
      console.error('Salvataggio cliente:', err);
      showToast('Errore: ' + (err.message || err), 'error');
    })
    .finally(function () {
      btn.disabled  = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Salva';
    });
}

// --- CRUD Firestore ---

function addCliente(data) {
  data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  return db.collection('clienti').add(data);
}

function updateCliente(id, data) {
  data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  return db.collection('clienti').doc(id).update(data);
}

function deleteCliente(id) {
  // Elimina il documento cliente. Eventuali relazioni (pratiche, note, etc.)
  // non vengono rimosse automaticamente — gestire con Cloud Functions o batch
  // se necessario.
  return db.collection('clienti').doc(id).delete();
}

// --- Conferma eliminazione ---

function confirmDelete(id) {
  var c = _allClienti.find(function (x) { return x.id === id; });
  var name = c ? ((c.nome || '') + ' ' + (c.cognome || '')).trim() : id;
  _deleteTargetId = id;
  document.getElementById('confirmDeleteMsg').textContent =
    'Sei sicuro di voler eliminare il cliente "' + name + '"? ' +
    'L\'operazione è irreversibile.';
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

  deleteCliente(id)
    .then(function () {
      closeConfirmDelete();
      showToast('Cliente eliminato', 'success');
    })
    .catch(function (err) {
      console.error('deleteCliente:', err);
      showToast('Errore: ' + (err.message || err), 'error');
      btn.disabled  = false;
      btn.innerHTML = '<i class="fas fa-trash"></i> Elimina';
    });
}

// --- Event listeners + bootstrap ---

document.addEventListener('DOMContentLoaded', function () {
  // Chiudi modale cliccando sull'overlay
  var clienteModal = document.getElementById('clienteModal');
  if (clienteModal) {
    clienteModal.addEventListener('click', function (e) {
      if (e.target === clienteModal) closeModal('clienteModal');
    });
  }

  var confirmOverlay = document.getElementById('confirmDeleteOverlay');
  if (confirmOverlay) {
    confirmOverlay.addEventListener('click', function (e) {
      if (e.target === confirmOverlay) closeConfirmDelete();
    });
  }

  // Escape chiude i modali
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModal('clienteModal');
      closeConfirmDelete();
    }
  });

  initClienti();
});
