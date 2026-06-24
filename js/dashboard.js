// ============================================================
// DASHBOARD.JS
// ============================================================
// Funzioni:
//   initDashboard()        — bootstrap, imposta data/ora benvenuto
//   loadAll()              — chiama tutte le funzioni di caricamento
//   loadStats()            — conta clienti, pratiche, appuntamenti, udienze
//   loadAgendaOggi()       — appuntamenti + udienze di oggi
//   renderAgenda(items)    — HTML agenda
//   loadPromemoria()       — promemoria non completati in scadenza entro 30gg
//   loadRecentiPratiche()  — ultime 5 pratiche modificate
//   loadRecentiRichieste() — ultime 5 richieste ricevute
// Auto-refresh ogni 5 minuti.
// ============================================================

var _dashboardTimer = null;

// --- Bootstrap ---

function initDashboard() {
  // Imposta data corrente nel banner
  var opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('welcomeDate').textContent =
    new Date().toLocaleDateString('it-IT', opts);

  auth.onAuthStateChanged(function (user) {
    if (!user) return;
    var rawName = user.displayName || user.email || '';
    var shortName = rawName.split('@')[0].split(' ')[0];
    var nameEl = document.getElementById('welcomeName');
    if (nameEl) nameEl.textContent = capitalize(shortName);

    loadAll();

    // Auto-refresh ogni 5 minuti
    if (_dashboardTimer) clearInterval(_dashboardTimer);
    _dashboardTimer = setInterval(loadAll, 5 * 60 * 1000);
  });
}

function loadAll() {
  loadStats();
  loadAgendaOggi();
  loadPromemoria();
  loadRecentiPratiche();
  loadRecentiRichieste();
}

// --- Stats ---

function loadStats() {
  // Clienti totali
  db.collection('clienti').get()
    .then(function (s) { _setStatText('statClienti', s.size); })
    .catch(function ()  { _setStatText('statClienti', '—'); });

  // Pratiche aperte (stato in [Aperta, In lavorazione, In attesa])
  db.collection('pratiche')
    .where('stato', 'in', ['Aperta', 'In lavorazione', 'In attesa'])
    .get()
    .then(function (s) { _setStatText('statPratiche', s.size); })
    .catch(function ()  { _setStatText('statPratiche', '—'); });

  // Appuntamenti oggi
  var todayStart = new Date(); todayStart.setHours(0,0,0,0);
  var todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);

  db.collection('appuntamenti')
    .where('data', '>=', firebase.firestore.Timestamp.fromDate(todayStart))
    .where('data', '<=', firebase.firestore.Timestamp.fromDate(todayEnd))
    .get()
    .then(function (s) { _setStatText('statAppuntamenti', s.size); })
    .catch(function ()  { _setStatText('statAppuntamenti', '—'); });

  // Udienze nei prossimi 7 giorni
  var weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7); weekEnd.setHours(23,59,59,999);

  db.collection('udienze')
    .where('data', '>=', firebase.firestore.Timestamp.fromDate(todayStart))
    .where('data', '<=', firebase.firestore.Timestamp.fromDate(weekEnd))
    .get()
    .then(function (s) { _setStatText('statUdienze', s.size); })
    .catch(function ()  { _setStatText('statUdienze', '—'); });
}

function _setStatText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

// --- Agenda giornata ---

function loadAgendaOggi() {
  var container = document.getElementById('agendaList');
  var todayStart = new Date(); todayStart.setHours(0,0,0,0);
  var todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);

  var items   = [];
  var pending = 2;

  function tryRender() {
    pending--;
    if (pending === 0) renderAgenda(items);
  }

  db.collection('appuntamenti')
    .where('data', '>=', firebase.firestore.Timestamp.fromDate(todayStart))
    .where('data', '<=', firebase.firestore.Timestamp.fromDate(todayEnd))
    .orderBy('data')
    .get()
    .then(function (snap) {
      snap.forEach(function (doc) {
        var d = doc.data();
        items.push({
          type: 'appuntamento',
          data: d.data,
          titolo: d.titolo || d.oggetto || 'Appuntamento',
          cliente: d.clienteNome || '',
          note: d.note || ''
        });
      });
      tryRender();
    })
    .catch(tryRender);

  db.collection('udienze')
    .where('data', '>=', firebase.firestore.Timestamp.fromDate(todayStart))
    .where('data', '<=', firebase.firestore.Timestamp.fromDate(todayEnd))
    .orderBy('data')
    .get()
    .then(function (snap) {
      snap.forEach(function (doc) {
        var d = doc.data();
        items.push({
          type: 'udienza',
          data: d.data,
          titolo: d.tribunale || 'Udienza',
          cliente: d.clienteNome || '',
          note: d.praticaTitolo || ''
        });
      });
      tryRender();
    })
    .catch(tryRender);
}

function renderAgenda(items) {
  var container = document.getElementById('agendaList');
  if (!container) return;

  if (!items.length) {
    container.innerHTML =
      '<div class="empty-agenda">' +
        '<i class="fas fa-calendar-check"></i>' +
        'Nessun impegno per oggi' +
      '</div>';
    return;
  }

  // Ordina per ora
  items.sort(function (a, b) {
    var ta = a.data ? (a.data.toDate ? a.data.toDate() : new Date(a.data)) : new Date(0);
    var tb = b.data ? (b.data.toDate ? b.data.toDate() : new Date(b.data)) : new Date(0);
    return ta - tb;
  });

  container.innerHTML = items.map(function (item) {
    var timeStr = item.data ? formatTime(item.data) : '—';
    var cls     = item.type === 'udienza' ? ' udienza' : '';
    var icon    = item.type === 'udienza' ? 'fas fa-gavel' : 'fas fa-calendar-check';
    return '<div class="agenda-item' + cls + '">' +
      '<div class="agenda-time">' + escapeHtml(timeStr) + '</div>' +
      '<div class="agenda-body">' +
        '<h4><i class="' + icon + '"></i> ' + escapeHtml(item.titolo) + '</h4>' +
        (item.cliente ? '<p><i class="fas fa-user"></i> ' + escapeHtml(item.cliente) + '</p>' : '') +
        (item.note    ? '<p><i class="fas fa-info-circle"></i> ' + escapeHtml(item.note) + '</p>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

// --- Promemoria in scadenza ---

function loadPromemoria() {
  var container = document.getElementById('promemoriaList');
  var today     = new Date(); today.setHours(0,0,0,0);
  var horizon   = new Date(today); horizon.setDate(horizon.getDate() + 30);

  // Nota: questa query richiede un indice composito in Firestore su
  // (completato ASC, scadenza ASC). Creare l'indice dalla Firebase Console
  // se necessario.
  db.collection('promemoria')
    .where('completato', '==', false)
    .where('scadenza',   '<=', firebase.firestore.Timestamp.fromDate(horizon))
    .orderBy('scadenza')
    .limit(10)
    .get()
    .then(function (snap) {
      if (snap.empty) {
        container.innerHTML =
          '<div class="empty-agenda"><i class="fas fa-bell-slash"></i>Nessun promemoria in scadenza</div>';
        return;
      }

      var html = '';
      snap.forEach(function (doc) {
        var d        = doc.data();
        var scadenza = d.scadenza ? (d.scadenza.toDate ? d.scadenza.toDate() : new Date(d.scadenza)) : null;
        var diff     = scadenza ? daysBetween(today, scadenza) : null;
        var labelCls, labelTxt, itemCls;

        if (diff === null) {
          labelCls = 'ok'; labelTxt = '—'; itemCls = '';
        } else if (diff <= 0) {
          labelCls = 'oggi'; labelTxt = 'Scade oggi'; itemCls = 'scade-oggi';
        } else if (diff <= 7) {
          labelCls = 'presto'; labelTxt = 'Scade tra ' + diff + ' gg'; itemCls = 'scade-presto';
        } else {
          labelCls = 'ok'; labelTxt = 'Scade tra ' + diff + ' gg'; itemCls = '';
        }

        html +=
          '<div class="promemoria-item ' + itemCls + '">' +
            '<span class="promemoria-label ' + labelCls + '">' + labelTxt + '</span>' +
            '<span class="promemoria-text">' +
              escapeHtml(truncate(d.testo || d.titolo || 'Promemoria', 60)) +
            '</span>' +
          '</div>';
      });
      container.innerHTML = html;
    })
    .catch(function (err) {
      console.warn('Promemoria load error (indice mancante?):', err.message || err);
      container.innerHTML =
        '<div class="empty-agenda">Nessun dato disponibile</div>';
    });
}

// --- Pratiche recenti ---

function loadRecentiPratiche() {
  var container = document.getElementById('recentiPraticheWrap');

  db.collection('pratiche')
    .orderBy('updatedAt', 'desc')
    .limit(5)
    .get()
    .then(function (snap) {
      if (snap.empty) {
        container.innerHTML = emptyStateHtml('fas fa-briefcase', 'Nessuna pratica');
        return;
      }
      var rows = '';
      snap.forEach(function (doc) {
        var d = doc.data();
        rows +=
          '<tr>' +
            '<td><span style="font-weight:600;color:#1E3A5F;">' + escapeHtml(d.titolo || '—') + '</span>' +
              (d.numeroFascicolo ? '<br><small style="color:#6b7280;">Fasc. ' + escapeHtml(d.numeroFascicolo) + '</small>' : '') +
            '</td>' +
            '<td>' + escapeHtml(d.clienteNome || '—') + '</td>' +
            '<td>' + statoBadge(d.stato) + '</td>' +
            '<td>' + prioritaBadge(d.priorita) + '</td>' +
            '<td>' + formatDate(d.dataApertura) + '</td>' +
            '<td>' +
              '<a href="pratiche.html" class="btn btn-sm btn-outline" title="Vai alle pratiche">' +
                '<i class="fas fa-arrow-right"></i>' +
              '</a>' +
            '</td>' +
          '</tr>';
      });
      container.innerHTML =
        '<table class="data-table">' +
          '<thead><tr>' +
            '<th>Titolo</th><th>Cliente</th><th>Stato</th>' +
            '<th>Priorità</th><th>Data apertura</th><th></th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>';
    })
    .catch(function (err) {
      console.error('Pratiche recenti error:', err);
      container.innerHTML = emptyStateHtml('fas fa-exclamation-circle', 'Errore nel caricamento');
    });
}

// --- Richieste recenti ---

function loadRecentiRichieste() {
  var container = document.getElementById('recentiRichiesteWrap');

  db.collection('richieste')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get()
    .then(function (snap) {
      if (snap.empty) {
        container.innerHTML = emptyStateHtml('fas fa-inbox', 'Nessuna richiesta');
        return;
      }
      var rows = '';
      snap.forEach(function (doc) {
        var d = doc.data();
        var ogg = d.oggetto || truncate(d.testo || '', 50) || '—';
        var statoCls = d.stato === 'Nuova'
          ? 'badge-aperta'
          : d.stato === 'In lavorazione'
            ? 'badge-lavorazione'
            : 'badge-chiusa';
        rows +=
          '<tr>' +
            '<td>' + escapeHtml(d.nome || '—') + '</td>' +
            '<td>' + escapeHtml(ogg) + '</td>' +
            '<td>' + escapeHtml(d.email || '—') + '</td>' +
            '<td><span class="badge ' + statoCls + '">' + escapeHtml(d.stato || 'Nuova') + '</span></td>' +
            '<td>' + formatDate(d.createdAt) + '</td>' +
          '</tr>';
      });
      container.innerHTML =
        '<table class="data-table">' +
          '<thead><tr>' +
            '<th>Nome</th><th>Oggetto</th><th>Email</th><th>Stato</th><th>Data</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>';
    })
    .catch(function (err) {
      console.error('Richieste recenti error:', err);
      container.innerHTML = emptyStateHtml('fas fa-exclamation-circle', 'Errore nel caricamento');
    });
}

// --- Init ---
document.addEventListener('DOMContentLoaded', initDashboard);
