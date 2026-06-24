// ============================================================
// DOCUMENTI.JS — Document management with Firebase Storage
// ============================================================

var _docList        = [];
var _docFiltered    = [];
var _praticheDocMap = {};
var _pendingFile    = null;

document.addEventListener('DOMContentLoaded', function() {
  loadDocumenti();
  loadPraticheDocDropdown();
});

// ── Helpers ───────────────────────────────────────────────────

function _fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function _tipoBadge(tipo) {
  var map = {
    'Atto':           'badge-primary',
    'Contratto':      'badge-info',
    'Fattura':        'badge-success',
    'Corrispondenza': 'badge-warning',
    'Altro':          'badge-neutral'
  };
  var cls = 'badge ' + (map[tipo] || 'badge-neutral');
  return '<span class="' + cls + '">' + escapeHtml(tipo || 'Altro') + '</span>';
}

function _getFileIcon(tipo) {
  switch (tipo) {
    case 'Atto':           return 'fas fa-file-pdf';
    case 'Contratto':      return 'fas fa-file-contract';
    case 'Fattura':        return 'fas fa-file-invoice';
    case 'Corrispondenza': return 'fas fa-envelope';
    default:               return 'fas fa-file';
  }
}

function _isPDF(nome) {
  return nome && nome.toLowerCase().endsWith('.pdf');
}

function _fmtDateDoc(ts) {
  if (!ts) return '—';
  if (ts.toDate) return formatDate(ts);
  return '—';
}

// ── Data loading ──────────────────────────────────────────────

async function loadDocumenti() {
  var grid = document.getElementById('docs-grid');
  try {
    var snap = await db.collection('documenti').orderBy('createdAt', 'desc').get();
    _docList = [];
    snap.forEach(function(doc) {
      _docList.push(Object.assign({ id: doc.id }, doc.data()));
    });
    _docFiltered = _docList.slice();
    renderDocumenti(_docFiltered);
  } catch (e) {
    console.error('Errore caricamento documenti:', e);
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">Errore nel caricamento</div>';
    showToast('Errore nel caricamento dei documenti', 'error');
  }
}

// ── Render grid ───────────────────────────────────────────────

function renderDocumenti(docs) {
  var grid = document.getElementById('docs-grid');
  if (!docs || docs.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;">' + emptyStateHtml('fas fa-file-alt', 'Nessun documento caricato') + '</div>';
    return;
  }
  var html = '';
  docs.forEach(function(d) {
    var pratica   = _praticheDocMap[d.praticaId] || '—';
    var iconClass = _getFileIcon(d.tipo);
    var isPDF     = _isPDF(d.nome);
    html += '<div class="doc-card">';
    html += '<div class="doc-icon"><i class="' + iconClass + '"></i></div>';
    html += '<div class="doc-name" title="' + escapeHtml(d.nome || '') + '">' + escapeHtml(truncate(d.nome || 'Documento', 40)) + '</div>';
    html += '<div>' + _tipoBadge(d.tipo) + '</div>';
    html += '<div class="doc-meta"><i class="fas fa-folder-open"></i> ' + escapeHtml(pratica) + '</div>';
    html += '<div class="doc-meta"><i class="fas fa-calendar"></i> ' + _fmtDateDoc(d.createdAt) + '</div>';
    if (d.size) html += '<div class="doc-meta"><i class="fas fa-hdd"></i> ' + _fmtSize(d.size) + '</div>';
    html += '<div class="doc-actions">';
    if (isPDF && d.url) {
      html += '<button class="btn btn-ghost btn-sm" title="Anteprima" onclick="previewPDF(\'' + escapeHtml(d.url) + '\', \'' + escapeHtml(d.nome || 'Documento') + '\')">';
      html += '<i class="fas fa-eye"></i></button>';
    }
    if (d.url) {
      html += '<button class="btn btn-outline-primary btn-sm" title="Scarica" onclick="downloadDocumento(\'' + escapeHtml(d.url) + '\', \'' + escapeHtml(d.nome || 'documento') + '\')">';
      html += '<i class="fas fa-download"></i></button>';
    }
    html += '<button class="btn btn-danger btn-sm btn-icon" title="Elimina" onclick="deleteDocumento(\'' + d.id + '\', \'' + escapeHtml(d.url || '') + '\')">';
    html += '<i class="fas fa-trash"></i></button>';
    html += '</div></div>';
  });
  grid.innerHTML = html;
}

// ── Filters ───────────────────────────────────────────────────

function applyDocFilters() {
  var praticaId = document.getElementById('filter-pratica-doc').value;
  var tipo      = document.getElementById('filter-tipo').value;

  _docFiltered = _docList.filter(function(d) {
    if (praticaId && d.praticaId !== praticaId) return false;
    if (tipo && d.tipo !== tipo) return false;
    return true;
  });
  renderDocumenti(_docFiltered);
}

// ── Drag & Drop ───────────────────────────────────────────────

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.add('drag-over');
}

function handleDragLeave(e) {
  document.getElementById('drop-zone').classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-over');
  var files = e.dataTransfer.files;
  if (files.length > 0) {
    _setPendingFile(files[0]);
  }
}

function handleFileSelect(e) {
  var file = e.target.files[0];
  if (file) _setPendingFile(file);
}

function _setPendingFile(file) {
  _pendingFile = file;
  var fnEl = document.getElementById('drop-filename');
  fnEl.textContent = file.name + ' (' + _fmtSize(file.size) + ')';
  fnEl.classList.remove('d-none');
}

// ── Upload ────────────────────────────────────────────────────

function saveUpload() {
  var praticaId = document.getElementById('up-praticaId').value;
  var tipo      = document.getElementById('up-tipo').value;

  if (!praticaId)  { showToast('Seleziona una pratica', 'error'); return; }
  if (!tipo)       { showToast('Seleziona il tipo documento', 'error'); return; }
  if (!_pendingFile) { showToast('Seleziona un file da caricare', 'error'); return; }

  uploadDocumento(praticaId, tipo, _pendingFile);
}

function uploadDocumento(praticaId, tipo, file) {
  var progressContainer = document.getElementById('up-progress');
  var progressFill      = document.getElementById('up-progress-fill');
  var progressLabel     = document.getElementById('up-progress-label');
  var btnUpload         = document.getElementById('btn-upload');

  progressContainer.style.display = 'block';
  btnUpload.disabled = true;

  var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  var filename = Date.now() + '_' + safeName;
  var ref  = storage.ref('documenti/' + praticaId + '/' + filename);
  var task = ref.put(file);

  task.on('state_changed',
    function(snapshot) {
      var pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      progressFill.style.width = pct + '%';
      progressLabel.textContent = pct + '%';
    },
    function(error) {
      console.error('Errore upload:', error);
      showToast('Errore durante il caricamento', 'error');
      progressContainer.style.display = 'none';
      btnUpload.disabled = false;
    },
    async function() {
      try {
        var url = await task.snapshot.ref.getDownloadURL();
        await db.collection('documenti').add({
          praticaId: praticaId,
          tipo:      tipo,
          nome:      file.name,
          url:       url,
          size:      file.size,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeModal('modal-upload');
        showToast('Documento caricato con successo', 'success');
        _pendingFile = null;
        progressContainer.style.display = 'none';
        progressFill.style.width = '0%';
        progressLabel.textContent = '0%';
        btnUpload.disabled = false;
        document.getElementById('drop-filename').classList.add('d-none');
        document.getElementById('up-praticaId').value = '';
        document.getElementById('up-tipo').value = '';
        document.getElementById('up-file').value = '';
        loadDocumenti();
      } catch (e) {
        console.error('Errore salvataggio Firestore:', e);
        showToast('Errore nel salvataggio dei metadati', 'error');
        progressContainer.style.display = 'none';
        btnUpload.disabled = false;
      }
    }
  );
}

// ── Delete ────────────────────────────────────────────────────

async function deleteDocumento(id, url) {
  if (!confirm('Sei sicuro di voler eliminare questo documento?')) return;
  try {
    if (url) {
      try {
        await storage.refFromURL(url).delete();
      } catch (storageErr) {
        console.warn('File Storage già eliminato o non trovato:', storageErr);
      }
    }
    await db.collection('documenti').doc(id).delete();
    showToast('Documento eliminato', 'success');
    loadDocumenti();
  } catch (e) {
    console.error(e);
    showToast('Errore nell\'eliminazione', 'error');
  }
}

// ── Download / Preview ────────────────────────────────────────

function downloadDocumento(url, nome) {
  var a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function previewPDF(url, nome) {
  document.getElementById('pdf-iframe').src = url;
  document.getElementById('modal-pdf-title').textContent = nome || 'Anteprima Documento';
  openModal('modal-pdf');
}

// ── Dropdown loader ───────────────────────────────────────────

async function loadPraticheDocDropdown() {
  try {
    var snap = await db.collection('pratiche').orderBy('titolo').get();
    var selFilter = document.getElementById('filter-pratica-doc');
    var selForm   = document.getElementById('up-praticaId');
    selFilter.innerHTML = '<option value="">Tutte le pratiche</option>';
    selForm.innerHTML   = '<option value="">Seleziona pratica...</option>';
    _praticheDocMap = {};
    snap.forEach(function(doc) {
      var p = doc.data();
      _praticheDocMap[doc.id] = p.titolo || ('Pratica ' + doc.id);
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
    if (_docFiltered.length) renderDocumenti(_docFiltered);
  } catch (e) {
    console.error('Errore caricamento pratiche:', e);
  }
}
