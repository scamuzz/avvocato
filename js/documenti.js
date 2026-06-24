// ============================================================
// DOCUMENTI.JS - Document management with Firebase Storage
// ============================================================
var allDocs = [];
var praticheMap = {};

async function loadDocumenti() {
  try {
    const [docsSnap, pratSnap] = await Promise.all([
      db.collection('documenti').orderBy('dataUpload','desc').get(),
      db.collection('pratiche').get()
    ]);
    pratSnap.forEach(d => { praticheMap[d.id] = d.data().titolo || 'Pratica'; });
    allDocs = docsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    populatePraticheFilter();
    applyFilters();
  } catch (err) { showToast('Errore caricamento', 'error'); }
}

function populatePraticheFilter() {
  const sel = document.getElementById('filterPratica');
  sel.innerHTML = '<option value="">Tutte le pratiche</option>';
  Object.entries(praticheMap).forEach(([id,t]) => { sel.innerHTML += `<option value="${id}">${sanitizeInput(t)}</option>`; });
}

function applyFilters() {
  const pratica = document.getElementById('filterPratica').value;
  const tipo = document.getElementById('filterTipo').value;
  const search = document.getElementById('searchInput').value.toLowerCase();
  let filtered = allDocs.filter(d => (!pratica||d.praticaId===pratica)&&(!tipo||d.tipo===tipo)&&(!search||(d.nomeFile||'').toLowerCase().includes(search)));
  document.getElementById('countLabel').textContent = filtered.length + ' documenti';
  renderDocumenti(filtered);
}

const TIPO_ICONS = { 'Atto':'fa-file-contract','Contratto':'fa-file-signature','Sentenza':'fa-gavel','Procura':'fa-stamp','Documento cliente':'fa-id-card','Altro':'fa-file-alt' };

function renderDocumenti(list) {
  const container = document.getElementById('documentiContainer');
  if (!list.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><h3>Nessun documento</h3><p>Carica il primo documento</p></div>'; return; }
  const cards = list.map(d => {
    const icon = TIPO_ICONS[d.tipo] || 'fa-file-alt';
    const isPdf = (d.nomeFile||'').toLowerCase().endsWith('.pdf');
    return `<div class="card" style="display:flex;flex-direction:column">
      <div style="padding:1.25rem;display:flex;align-items:flex-start;gap:1rem">
        <div style="width:48px;height:48px;background:#EBF8FF;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas ${icon}" style="font-size:1.3rem;color:#2C5282"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div class="font-semibold" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${sanitizeInput(d.nomeFile)}">${sanitizeInput(d.nomeFile||'—')}</div>
          <div class="text-small text-muted">${sanitizeInput(d.tipo||'—')}</div>
          <div class="text-small text-muted">${sanitizeInput(praticheMap[d.praticaId]||'—')}</div>
          <div class="text-small text-muted">${formatDate(d.dataUpload)}</div>
        </div>
      </div>
      <div style="padding:0.75rem 1.25rem;border-top:1px solid #E2E8F0;display:flex;gap:0.5rem;flex-wrap:wrap">
        ${isPdf?`<button class="btn btn-sm btn-secondary" onclick="previewDoc('${sanitizeInput(d.urlFile)}','${sanitizeInput(d.nomeFile)}')"><i class="fas fa-eye"></i> Anteprima</button>`:''}
        <a href="${sanitizeInput(d.urlFile)}" target="_blank" class="btn btn-sm btn-secondary"><i class="fas fa-download"></i> Scarica</a>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteDoc('${d.id}','${sanitizeInput(d.urlFile)}','${sanitizeInput(d.nomeFile)}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
  container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem">${cards}</div>`;
}

async function openUploadModal() {
  const sel = document.getElementById('uploadPraticaId');
  sel.innerHTML = '<option value="">Seleziona pratica...</option>';
  const snap = await db.collection('pratiche').orderBy('titolo').get();
  snap.forEach(d => { sel.innerHTML += `<option value="${d.id}">${sanitizeInput(d.data().titolo)}</option>`; });
  document.getElementById('selectedFileName').textContent = '';
  document.getElementById('fileInput').value = '';
  document.getElementById('uploadProgress').style.display = 'none';
  openModal('uploadModalOverlay');
}

function fileSelected(input) {
  if (input.files[0]) {
    document.getElementById('selectedFileName').textContent = '📎 ' + input.files[0].name;
    document.getElementById('dropZone').style.borderColor = '#3182CE';
  }
}

// Drag & drop setup
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  const dz = document.getElementById('dropZone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor='#3182CE'; dz.style.background='#EBF8FF'; });
    dz.addEventListener('dragleave', () => { dz.style.borderColor='#E2E8F0'; dz.style.background=''; });
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.style.borderColor='#E2E8F0'; dz.style.background='';
      if (e.dataTransfer.files[0]) { const dt = new DataTransfer(); dt.items.add(e.dataTransfer.files[0]); document.getElementById('fileInput').files = dt.files; fileSelected(document.getElementById('fileInput')); }
    });
  }
  auth.onAuthStateChanged(u => { if (u) loadDocumenti(); });
});

async function uploadDocumento() {
  const praticaId = document.getElementById('uploadPraticaId').value;
  const tipo = document.getElementById('uploadTipo').value;
  const fileInput = document.getElementById('fileInput');
  if (!praticaId) { showToast('Seleziona una pratica','warning'); return; }
  if (!fileInput.files[0]) { showToast('Seleziona un file','warning'); return; }
  const file = fileInput.files[0];
  if (file.size > 50*1024*1024) { showToast('File troppo grande (max 50MB)','error'); return; }
  const btn = document.getElementById('btnUpload');
  btn.disabled = true;
  document.getElementById('uploadProgress').style.display = 'block';
  try {
    const filename = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const ref = storage.ref('documenti/' + praticaId + '/' + filename);
    const task = ref.put(file);
    task.on('state_changed', snap => {
      const pct = (snap.bytesTransferred/snap.totalBytes*100).toFixed(0);
      document.getElementById('progressBar').style.width = pct + '%';
      document.getElementById('progressText').textContent = 'Caricamento: ' + pct + '%';
    });
    await task;
    const url = await ref.getDownloadURL();
    await db.collection('documenti').add({ praticaId, tipo, nomeFile: file.name, urlFile: url, dataUpload: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Documento caricato!','success');
    closeModal('uploadModalOverlay');
    loadDocumenti();
  } catch (err) { showToast('Errore upload: '+err.message,'error'); }
  finally { btn.disabled=false; document.getElementById('uploadProgress').style.display='none'; }
}

function previewDoc(url, name) {
  document.getElementById('previewTitle').textContent = name;
  document.getElementById('previewFrame').src = url;
  openModal('previewModalOverlay');
}

async function confirmDeleteDoc(id, url, name) {
  if (!await confirmDialog('Eliminare "'+name+'"?')) return;
  try {
    try { await storage.refFromURL(url).delete(); } catch (e) {}
    await db.collection('documenti').doc(id).delete();
    showToast('Documento eliminato','success');
    loadDocumenti();
  } catch (err) { showToast('Errore: '+err.message,'error'); }
}
