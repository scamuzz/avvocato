// ============================================================
// NOTE.JS - Internal notes CRUD
// ============================================================
var allNote = [];
var praticheMap = {};

async function loadNote() {
  try {
    const [noteSnap, pratSnap] = await Promise.all([
      db.collection('noteInterne').orderBy('dataCreazione','desc').get(),
      db.collection('pratiche').get()
    ]);
    pratSnap.forEach(d => { praticheMap[d.id] = d.data().titolo || 'Pratica'; });
    allNote = noteSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    populatePraticheFilter();
    applyFilters();
  } catch (err) { showToast('Errore caricamento note', 'error'); }
}

function populatePraticheFilter() {
  const sel = document.getElementById('filterPratica');
  sel.innerHTML = '<option value="">Tutte le pratiche</option>';
  Object.entries(praticheMap).forEach(([id, t]) => {
    sel.innerHTML += `<option value="${id}">${sanitizeInput(t)}</option>`;
  });
}

function applyFilters() {
  const pratica = document.getElementById('filterPratica').value;
  const search = document.getElementById('searchInput').value.toLowerCase();
  let filtered = allNote.filter(n => {
    return (!pratica || n.praticaId === pratica) &&
           (!search || (n.contenuto||'').toLowerCase().includes(search));
  });
  document.getElementById('countLabel').textContent = filtered.length + ' note';
  renderNote(filtered);
}

function renderNote(list) {
  const container = document.getElementById('noteContainer');
  if (!list.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-sticky-note"></i><h3>Nessuna nota</h3><p>Aggiungi note private per le pratiche</p></div>';
    return;
  }
  const cards = list.map(n => `
    <div class="card" style="border-left:4px solid var(--primary);cursor:pointer" onclick="viewNota('${n.id}')">
      <div style="padding:1.25rem">
        <div class="d-flex justify-between align-center mb-2">
          <span class="badge badge-primary">${sanitizeInput(praticheMap[n.praticaId] || 'Generale')}</span>
          <span class="text-small text-muted">${formatDate(n.dataCreazione)}</span>
        </div>
        <div style="color:var(--text);line-height:1.6;white-space:pre-wrap">${sanitizeInput(truncate(n.contenuto||'', 200))}</div>
        <div class="divider" style="margin:0.75rem 0"></div>
        <div class="d-flex justify-between align-center">
          <span class="text-small text-muted"><i class="fas fa-user"></i> ${sanitizeInput(n.autore||'—')}</span>
          <div class="d-flex gap-2" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-secondary" onclick="openEditModal('${n.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-danger" onclick="confirmDelete('${n.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>
    </div>`).join('');
  container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem">${cards}</div>`;
}

function viewNota(id) {
  const n = allNote.find(x => x.id === id);
  if (!n) return;
  document.getElementById('viewNotaTitle').textContent = praticheMap[n.praticaId] ? 'Nota - ' + praticheMap[n.praticaId] : 'Nota';
  document.getElementById('viewNotaContent').textContent = n.contenuto || '';
  document.getElementById('viewNotaAutore').textContent = n.autore || '—';
  document.getElementById('viewNotaData').textContent = formatDateTime(n.dataCreazione);
  openModal('viewNotaModalOverlay');
}

async function loadPraticheDropdown() {
  const sel = document.getElementById('notaPraticaId');
  sel.innerHTML = '<option value="">Nessuna pratica specifica</option>';
  const snap = await db.collection('pratiche').orderBy('titolo').get();
  snap.forEach(d => { sel.innerHTML += `<option value="${d.id}">${sanitizeInput(d.data().titolo)}</option>`; });
}

async function openAddModal() {
  document.getElementById('notaId').value = '';
  document.getElementById('notaContenuto').value = '';
  document.getElementById('notaModalTitle').textContent = 'Nuova Nota';
  await loadPraticheDropdown();
  openModal('notaModalOverlay');
}

async function openEditModal(id) {
  const doc = await db.collection('noteInterne').doc(id).get();
  if (!doc.exists) return;
  const n = doc.data();
  await loadPraticheDropdown();
  document.getElementById('notaId').value = id;
  document.getElementById('notaPraticaId').value = n.praticaId || '';
  document.getElementById('notaContenuto').value = n.contenuto || '';
  document.getElementById('notaModalTitle').textContent = 'Modifica Nota';
  openModal('notaModalOverlay');
}

async function saveNota() {
  const id = document.getElementById('notaId').value;
  const contenuto = document.getElementById('notaContenuto').value.trim();
  if (!contenuto) { showToast('Il contenuto è obbligatorio', 'warning'); return; }
  const autore = window.currentUserData ? (window.currentUserData.nome + ' ' + window.currentUserData.cognome).trim() :
    (window.currentUser ? window.currentUser.email : 'Utente');
  const data = {
    praticaId: document.getElementById('notaPraticaId').value,
    contenuto, autore
  };
  try {
    if (id) {
      await db.collection('noteInterne').doc(id).update({ ...data, dataModifica: firebase.firestore.FieldValue.serverTimestamp() });
      showToast('Nota aggiornata!', 'success');
    } else {
      data.dataCreazione = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('noteInterne').add(data);
      showToast('Nota salvata!', 'success');
    }
    closeModal('notaModalOverlay');
    loadNote();
  } catch (err) { showToast('Errore: ' + err.message, 'error'); }
}

async function confirmDelete(id) {
  if (await confirmDialog('Eliminare questa nota?')) {
    await db.collection('noteInterne').doc(id).delete();
    showToast('Nota eliminata', 'success');
    loadNote();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  auth.onAuthStateChanged(u => { if (u) loadNote(); });
});
