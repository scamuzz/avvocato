// ============================================================
// RICHIESTE.JS - Contact requests management
// ============================================================
var allRichieste = [];

async function loadRichieste() {
  try {
    const snap = await db.collection('richiesteContatto').orderBy('dataInvio','desc').get();
    allRichieste = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    renderStats();
    applyFilters();
  } catch (err) { showToast('Errore caricamento richieste', 'error'); }
}

function renderStats() {
  const nuove = allRichieste.filter(r => r.stato === 'Nuova').length;
  const inGestione = allRichieste.filter(r => r.stato === 'In gestione').length;
  const chiuse = allRichieste.filter(r => r.stato === 'Chiusa').length;
  document.getElementById('richiesteStats').innerHTML = `
    <div class="card" style="padding:1rem 1.5rem;display:flex;align-items:center;gap:0.75rem;min-width:150px">
      <div style="width:40px;height:40px;background:#FED7D7;border-radius:10px;display:flex;align-items:center;justify-content:center"><i class="fas fa-envelope" style="color:#E53E3E"></i></div>
      <div><div style="font-size:1.5rem;font-weight:800;color:#E53E3E">${nuove}</div><div class="text-small text-muted">Nuove</div></div>
    </div>
    <div class="card" style="padding:1rem 1.5rem;display:flex;align-items:center;gap:0.75rem;min-width:150px">
      <div style="width:40px;height:40px;background:#FEEBC8;border-radius:10px;display:flex;align-items:center;justify-content:center"><i class="fas fa-clock" style="color:#DD6B20"></i></div>
      <div><div style="font-size:1.5rem;font-weight:800;color:#DD6B20">${inGestione}</div><div class="text-small text-muted">In gestione</div></div>
    </div>
    <div class="card" style="padding:1rem 1.5rem;display:flex;align-items:center;gap:0.75rem;min-width:150px">
      <div style="width:40px;height:40px;background:#C6F6D5;border-radius:10px;display:flex;align-items:center;justify-content:center"><i class="fas fa-check-circle" style="color:#276749"></i></div>
      <div><div style="font-size:1.5rem;font-weight:800;color:#276749">${chiuse}</div><div class="text-small text-muted">Chiuse</div></div>
    </div>`;
}

function applyFilters() {
  const stato = document.getElementById('filterStato').value;
  const tipo = document.getElementById('filterTipo').value;
  const search = document.getElementById('searchInput').value.toLowerCase();
  let filtered = allRichieste.filter(r => {
    return (!stato || r.stato === stato) &&
           (!tipo || r.tipo === tipo) &&
           (!search || (r.nome||'').toLowerCase().includes(search) || (r.email||'').toLowerCase().includes(search));
  });
  document.getElementById('countLabel').textContent = filtered.length + ' richieste';
  renderRichieste(filtered);
}

function renderRichieste(list) {
  const container = document.getElementById('richiesteContainer');
  if (!list.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><h3>Nessuna richiesta</h3><p>Le richieste dal sito pubblico appariranno qui</p></div>';
    return;
  }
  const rows = list.map(r => {
    const statoClass = r.stato === 'Nuova' ? 'badge-danger' : r.stato === 'In gestione' ? 'badge-warning' : 'badge-success';
    const tipoLabel = r.tipo === 'appuntamento' ? '📅 Appuntamento' : '✉️ Informazioni';
    return `<tr style="cursor:pointer" onclick="viewRichiesta('${r.id}')">
      <td><div class="font-semibold">${sanitizeInput(r.nome||'—')}</div></td>
      <td>${r.email ? `<a href="mailto:${sanitizeInput(r.email)}" style="color:var(--accent)" onclick="event.stopPropagation()">${sanitizeInput(r.email)}</a>` : '—'}</td>
      <td>${sanitizeInput(r.telefono||'—')}</td>
      <td class="text-small">${sanitizeInput(tipoLabel)}</td>
      <td class="text-muted text-small">${sanitizeInput(truncate(r.messaggio||'',60))}</td>
      <td class="text-muted text-small">${formatDate(r.dataInvio)}</td>
      <td><span class="badge ${statoClass}">${sanitizeInput(r.stato||'Nuova')}</span></td>
      <td onclick="event.stopPropagation()"><div class="table-actions">
        <button class="btn btn-sm btn-success" onclick="updateStato('${r.id}','Chiusa')" title="Segna come chiusa"><i class="fas fa-check"></i></button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteRichiesta('${r.id}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
  container.innerHTML = `<div class="card"><div class="table-wrapper"><table class="table">
    <thead><tr><th>Nome</th><th>Email</th><th>Telefono</th><th>Tipo</th><th>Messaggio</th><th>Data</th><th>Stato</th><th style="text-align:right">Azioni</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div></div>`;
}

function viewRichiesta(id) {
  const r = allRichieste.find(x => x.id === id);
  if (!r) return;
  const statoClass = r.stato === 'Nuova' ? 'badge-danger' : r.stato === 'In gestione' ? 'badge-warning' : 'badge-success';
  document.getElementById('detailModalTitle').textContent = 'Richiesta da ' + (r.nome || 'Sconosciuto');
  document.getElementById('detailContent').innerHTML = `
    <div class="d-flex gap-2 mb-3 flex-wrap">
      <span class="badge ${statoClass}">${sanitizeInput(r.stato||'Nuova')}</span>
      <span class="badge badge-gray">${sanitizeInput(r.tipo||'informazioni')}</span>
      <span class="text-small text-muted"><i class="fas fa-clock"></i> ${formatDateTime(r.dataInvio)}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
      <div><div class="text-small text-muted">Nome</div><div class="font-semibold">${sanitizeInput(r.nome||'—')}</div></div>
      <div><div class="text-small text-muted">Email</div><a href="mailto:${sanitizeInput(r.email)}" style="color:var(--accent)">${sanitizeInput(r.email||'—')}</a></div>
      <div><div class="text-small text-muted">Telefono</div><div>${sanitizeInput(r.telefono||'—')}</div></div>
    </div>
    <div class="form-group"><div class="form-label">Messaggio</div>
      <div style="background:var(--bg);padding:1rem;border-radius:8px;white-space:pre-wrap;line-height:1.7">${sanitizeInput(r.messaggio||'—')}</div>
    </div>`;
  document.getElementById('detailFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('detailModalOverlay')">Chiudi</button>
    ${r.stato !== 'In gestione' ? `<button class="btn btn-secondary" onclick="updateStato('${r.id}','In gestione')">Prendi in carico</button>` : ''}
    ${r.stato !== 'Chiusa' ? `<button class="btn btn-success" onclick="updateStato('${r.id}','Chiusa')"><i class="fas fa-check"></i> Chiudi</button>` : ''}
    ${r.email ? `<a href="mailto:${sanitizeInput(r.email)}" class="btn btn-primary"><i class="fas fa-reply"></i> Rispondi</a>` : ''}`;
  openModal('detailModalOverlay');
}

async function updateStato(id, stato) {
  try {
    await db.collection('richiesteContatto').doc(id).update({ stato });
    showToast('Stato aggiornato: ' + stato, 'success');
    loadRichieste();
    closeModal('detailModalOverlay');
  } catch (err) { showToast('Errore: ' + err.message, 'error'); }
}

async function confirmDeleteRichiesta(id) {
  if (await confirmDialog('Eliminare questa richiesta?')) {
    await db.collection('richiesteContatto').doc(id).delete();
    showToast('Richiesta eliminata', 'success');
    loadRichieste();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  auth.onAuthStateChanged(u => { if (u) loadRichieste(); });
});
