// ============================================================
// UDIENZE.JS - Hearing management CRUD
// ============================================================
var allUdienze = [];
var praticheMap = {};

async function loadUdienze() {
  try {
    const [udiSnap, pratSnap] = await Promise.all([
      db.collection('udienze').orderBy('data').get(),
      db.collection('pratiche').get()
    ]);
    pratSnap.forEach(d => { praticheMap[d.id] = d.data().titolo || 'Pratica'; });
    allUdienze = udiSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    loadProssime();
    populatePraticheFilter();
    applyFilters();
  } catch (err) { showToast('Errore caricamento udienze', 'error'); }
}

function loadProssime() {
  const today = formatDateInput(new Date());
  const week = new Date(); week.setDate(week.getDate() + 7);
  const weekStr = formatDateInput(week);
  const prossime = allUdienze.filter(u => u.data >= today && u.data <= weekStr);
  const container = document.getElementById('prossimeContainer');
  if (!prossime.length) { container.innerHTML = ''; return; }
  container.innerHTML = `<div class="alert alert-warning"><i class="fas fa-exclamation-triangle"></i>
    <div><strong>${prossime.length} udienza/e nei prossimi 7 giorni:</strong>
    <ul style="margin-top:0.4rem;padding-left:1.25rem">
    ${prossime.map(u=>`<li>${formatDate(u.data)} ${u.ora||''} — ${sanitizeInput(u.tribunale)} (${sanitizeInput(praticheMap[u.praticaId]||'—')})</li>`).join('')}
    </ul></div></div>`;
}

function populatePraticheFilter() {
  const sel = document.getElementById('filterPratica');
  sel.innerHTML = '<option value="">Tutte le pratiche</option>';
  Object.entries(praticheMap).forEach(([id,t]) => { sel.innerHTML += `<option value="${id}">${sanitizeInput(t)}</option>`; });
}

function applyFilters() {
  const pratica = document.getElementById('filterPratica').value;
  const da = document.getElementById('filterDa').value;
  const a = document.getElementById('filterA').value;
  let filtered = allUdienze.filter(u => (!pratica||u.praticaId===pratica)&&(!da||u.data>=da)&&(!a||u.data<=a));
  document.getElementById('countLabel').textContent = filtered.length + ' udienze';
  renderUdienze(filtered);
}

function clearFilters() {
  document.getElementById('filterPratica').value = '';
  document.getElementById('filterDa').value = '';
  document.getElementById('filterA').value = '';
  applyFilters();
}

function renderUdienze(list) {
  const container = document.getElementById('udienzeContainer');
  if (!list.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-gavel"></i><h3>Nessuna udienza trovata</h3></div>'; return; }
  const today = formatDateInput(new Date());
  const week = new Date(); week.setDate(week.getDate() + 7);
  const weekStr = formatDateInput(week);
  const rows = list.map(u => {
    const urgent = u.data >= today && u.data <= weekStr;
    const past = u.data < today;
    return `<tr style="background:${urgent?'#FFFFF0':''};opacity:${past?'0.7':'1'}">
      <td><div class="font-semibold">${formatDate(u.data)}</div><div class="text-small text-muted">${sanitizeInput(u.ora||'')}</div></td>
      <td>${sanitizeInput(u.tribunale||'—')}</td>
      <td>${sanitizeInput(u.giudice||'—')}</td>
      <td>${sanitizeInput(praticheMap[u.praticaId]||'—')}</td>
      <td class="text-small">${sanitizeInput(truncate(u.note||'',60))}</td>
      <td><div class="table-actions">
        ${urgent?'<span class="badge badge-warning">Imminente</span>':''}
        <button class="btn btn-sm btn-secondary" onclick="openEditModal('${u.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-danger" onclick="confirmDelete('${u.id}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
  container.innerHTML = `<div class="card"><div class="table-wrapper"><table class="table">
    <thead><tr><th>Data/Ora</th><th>Tribunale</th><th>Giudice</th><th>Pratica</th><th>Note</th><th style="text-align:right">Azioni</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}

async function loadPraticheDropdown() {
  const sel = document.getElementById('uPraticaId');
  sel.innerHTML = '<option value="">Seleziona pratica...</option>';
  const snap = await db.collection('pratiche').orderBy('titolo').get();
  snap.forEach(d => { sel.innerHTML += `<option value="${d.id}">${sanitizeInput(d.data().titolo||'Pratica')}</option>`; });
}

function openAddModal() {
  document.getElementById('udienzaId').value = '';
  document.getElementById('udienzaForm').reset();
  document.getElementById('uData').value = formatDateInput(new Date());
  document.getElementById('udienzaModalTitle').textContent = 'Nuova Udienza';
  loadPraticheDropdown();
  openModal('udienzaModalOverlay');
}

async function openEditModal(id) {
  const doc = await db.collection('udienze').doc(id).get();
  if (!doc.exists) return;
  const u = doc.data();
  await loadPraticheDropdown();
  populateForm({ udienzaId: id, uPraticaId: u.praticaId, uData: u.data, uOra: u.ora, uTribunale: u.tribunale, uGiudice: u.giudice, uNote: u.note });
  document.getElementById('udienzaModalTitle').textContent = 'Modifica Udienza';
  openModal('udienzaModalOverlay');
}

async function saveUdienza() {
  const id = document.getElementById('udienzaId').value;
  const praticaId = document.getElementById('uPraticaId').value;
  const data = document.getElementById('uData').value;
  const tribunale = document.getElementById('uTribunale').value.trim();
  if (!praticaId||!data||!tribunale) { showToast('Compila i campi obbligatori','warning'); return; }
  const payload = { praticaId, data, ora: document.getElementById('uOra').value, tribunale, giudice: document.getElementById('uGiudice').value.trim(), note: document.getElementById('uNote').value.trim() };
  try {
    if (id) { await db.collection('udienze').doc(id).update(payload); showToast('Udienza aggiornata!','success'); }
    else { await db.collection('udienze').add(payload); showToast('Udienza aggiunta!','success'); }
    closeModal('udienzaModalOverlay');
    loadUdienze();
  } catch (err) { showToast('Errore: '+err.message,'error'); }
}

async function confirmDelete(id) {
  if (await confirmDialog('Eliminare questa udienza?')) {
    await db.collection('udienze').doc(id).delete();
    showToast('Eliminata','success');
    loadUdienze();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  auth.onAuthStateChanged(u => { if (u) loadUdienze(); });
});
