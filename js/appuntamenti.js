// ============================================================
// APPUNTAMENTI.JS - Appointment management CRUD
// ============================================================

var allApp = [];
var currentView = 'lista';
var calYear, calMonth;

async function loadAppuntamenti() {
  try {
    const snap = await db.collection('appuntamenti').orderBy('data').orderBy('ora').get();
    allApp = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    applyFilters();
  } catch (err) {
    showToast('Errore caricamento appuntamenti', 'error');
  }
}

function applyFilters() {
  const data = document.getElementById('filterData').value;
  const stato = document.getElementById('filterStato').value;
  let filtered = allApp.filter(a => {
    return (!data || a.data === data) && (!stato || a.stato === stato);
  });
  document.getElementById('countLabel').textContent = filtered.length + ' appuntamenti';
  if (currentView === 'calendario') renderCalendario(filtered);
  else renderLista(filtered);
}

function clearFilters() {
  document.getElementById('filterData').value = '';
  document.getElementById('filterStato').value = '';
  applyFilters();
}

function setView(view, btn) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

function renderLista(list) {
  const container = document.getElementById('appContainer');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-check"></i><h3>Nessun appuntamento</h3><p>Aggiungi il primo appuntamento</p></div>';
    return;
  }
  const today = formatDateInput(new Date());
  const rows = list.map(a => {
    const isPast = a.data < today;
    return `<tr style="opacity:${isPast&&a.stato!=='Confermato'?'0.7':'1'}">
      <td><div class="font-semibold">${a.data ? formatDate(a.data) : '—'}</div><div class="text-small text-muted">${sanitizeInput(a.ora||'')}</div></td>
      <td>${sanitizeInput(a.luogo||'—')}</td>
      <td>${sanitizeInput(a.descrizione ? truncate(a.descrizione,50) : '—')}</td>
      <td><span class="badge ${getStatoClass(a.stato)}">${sanitizeInput(a.stato||'—')}</span></td>
      <td><div class="table-actions">
        <button class="btn btn-sm btn-secondary" onclick="openEditModal('${a.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-danger" onclick="confirmDelete('${a.id}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
  container.innerHTML = `<div class="card"><div class="table-wrapper"><table class="table">
    <thead><tr><th>Data / Ora</th><th>Luogo</th><th>Descrizione</th><th>Stato</th><th style="text-align:right">Azioni</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div></div>`;
}

function renderCalendario(list) {
  const container = document.getElementById('appContainer');
  const now = new Date();
  if (!calYear) calYear = now.getFullYear();
  if (calMonth === undefined) calMonth = now.getMonth();

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const months = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const days = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

  // Build event map
  const eventMap = {};
  list.forEach(a => { if (!eventMap[a.data]) eventMap[a.data] = []; eventMap[a.data].push(a); });

  // Build cells
  let cells = '';
  let startDay = (firstDay.getDay() + 6) % 7; // 0=Mon
  for (let i = 0; i < startDay; i++) cells += '<div class="calendar-cell other-month"></div>';
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = calYear + '-' + String(calMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const isToday = dateStr === formatDateInput(now);
    const evs = eventMap[dateStr] || [];
    const evHtml = evs.slice(0,3).map(e => `<div class="cal-event cal-event-appuntamento" title="${sanitizeInput(e.descrizione||'')} ${e.ora||''}">${sanitizeInput(e.ora||'')} ${sanitizeInput(truncate(e.descrizione||'Appuntamento',20))}</div>`).join('');
    const moreHtml = evs.length > 3 ? `<div class="cal-event-more">+${evs.length-3} altri</div>` : '';
    cells += `<div class="calendar-cell${isToday?' today':''}">
      <div class="calendar-day-num">${d}</div>
      <div class="cal-events">${evHtml}${moreHtml}</div>
    </div>`;
  }
  const headerDays = days.map(d => `<div>${d}</div>`).join('');
  container.innerHTML = `<div class="card"><div class="card-body">
    <div class="d-flex align-center justify-between mb-4">
      <button class="btn btn-secondary btn-sm" onclick="prevMonth()"><i class="fas fa-chevron-left"></i></button>
      <span class="font-bold" style="font-size:1.1rem">${months[calMonth]} ${calYear}</span>
      <button class="btn btn-secondary btn-sm" onclick="nextMonth()"><i class="fas fa-chevron-right"></i></button>
    </div>
    <div class="calendar-month">
      <div class="calendar-month-header">${headerDays}</div>
      <div class="calendar-grid">${cells}</div>
    </div>
    <div class="calendar-legend mt-4">
      <div class="legend-item"><div class="legend-dot" style="background:#3182CE"></div> Appuntamento</div>
    </div>
  </div></div>`;
}

function prevMonth() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } applyFilters(); }
function nextMonth() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } applyFilters(); }

async function loadClientiDropdown() {
  const sel = document.getElementById('appClienteId');
  sel.innerHTML = '<option value="">Seleziona cliente...</option>';
  const snap = await db.collection('clienti').orderBy('cognome').get();
  snap.forEach(d => { const c = d.data(); sel.innerHTML += `<option value="${d.id}">${sanitizeInput(c.cognome+' '+c.nome)}</option>`; });
}

async function loadPraticheByCliente(clienteId) {
  const sel = document.getElementById('appPraticaId');
  sel.innerHTML = '<option value="">Nessuna pratica</option>';
  if (!clienteId) return;
  const snap = await db.collection('pratiche').where('clienteId','==',clienteId).get();
  snap.forEach(d => { sel.innerHTML += `<option value="${d.id}">${sanitizeInput(d.data().titolo||'Pratica')}</option>`; });
}

function openAddModal() {
  document.getElementById('appId').value = '';
  document.getElementById('appForm').reset();
  document.getElementById('appData').value = formatDateInput(new Date());
  document.getElementById('appModalTitle').textContent = 'Nuovo Appuntamento';
  loadClientiDropdown();
  openModal('appModalOverlay');
}

async function openEditModal(id) {
  const doc = await db.collection('appuntamenti').doc(id).get();
  if (!doc.exists) return;
  const a = doc.data();
  await loadClientiDropdown();
  document.getElementById('appClienteId').value = a.clienteId || '';
  await loadPraticheByCliente(a.clienteId);
  populateForm({ appId: id, appClienteId: a.clienteId, appPraticaId: a.praticaId, appData: a.data, appOra: a.ora, appLuogo: a.luogo, appDescrizione: a.descrizione, appStato: a.stato });
  document.getElementById('appModalTitle').textContent = 'Modifica Appuntamento';
  openModal('appModalOverlay');
}

async function saveAppuntamento() {
  const id = document.getElementById('appId').value;
  const data = document.getElementById('appData').value;
  const ora = document.getElementById('appOra').value;
  if (!data || !ora) { showToast('Data e ora sono obbligatorie', 'warning'); return; }
  const payload = {
    clienteId: document.getElementById('appClienteId').value,
    praticaId: document.getElementById('appPraticaId').value,
    data, ora,
    luogo: document.getElementById('appLuogo').value.trim(),
    descrizione: document.getElementById('appDescrizione').value.trim(),
    stato: document.getElementById('appStato').value
  };
  try {
    if (id) { await db.collection('appuntamenti').doc(id).update(payload); showToast('Aggiornato!', 'success'); }
    else { await db.collection('appuntamenti').add(payload); showToast('Appuntamento aggiunto!', 'success'); }
    closeModal('appModalOverlay');
    loadAppuntamenti();
  } catch (err) { showToast('Errore: '+err.message, 'error'); }
}

async function confirmDelete(id) {
  if (await confirmDialog('Eliminare questo appuntamento?')) {
    await db.collection('appuntamenti').doc(id).delete();
    showToast('Eliminato', 'success');
    loadAppuntamenti();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  auth.onAuthStateChanged(user => { if (user) loadAppuntamenti(); });
});
