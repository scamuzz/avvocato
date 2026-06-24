/**
 * internal.js – Logica area interna: Auth Firebase, Firestore CRUD, indicatore DB.
 * Importato come <script type="module" src="js/internal.js"> in interna.html.
 */

import { FIREBASE_CONFIG, FIREBASE_SDK_VERSION } from "./firebase-config.js";

const SDK = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

// === Costanti Firestore ===
const TODOS_COLLECTION = "internal_todos";
const AGENDA_COLLECTION = "internal_agenda";
const PRATICHE_COLLECTION = "internal_pratiche";
const ARCHIVIO_COLLECTION = "internal_archivio";
const PROMEMORIA_COLLECTION = "internal_promemoria";
const INTERNAL_AREA_COLLECTION = "internal_area";
const INTERNAL_AREA_MAIN_DOC = "main";
const NOTE_STORAGE_KEY = "avvocato.internal.note";
const TODO_CHECKBOX_SELECTOR = 'input[type="checkbox"]';

// === Costanti valori pratica ===
const STATO_IN_CORSO = "In corso";
const STATO_QUASI_CHIUSA = "Quasi chiusa";
const STATO_PRECONTENZIOSO = "Precontenzioso";
const STATO_CHIUSA = "Chiusa";
const STATI_PRATICA = [STATO_IN_CORSO, STATO_QUASI_CHIUSA, STATO_PRECONTENZIOSO, STATO_CHIUSA];

// === Riferimenti DOM – auth/layout ===
const loadingSection = document.getElementById("loading-section");
const loginSection = document.getElementById("login-section");
const internalSection = document.getElementById("internal-section");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const userEmailDisplay = document.getElementById("user-email-display");
const userBar = document.getElementById("user-bar");
const dbStatusBadge = document.getElementById("db-status-badge");
const dbStatusMsg = document.getElementById("db-status-msg");
const dbStatusTime = document.getElementById("db-status-time");

// === Riferimenti DOM – TODO ===
const todoList = document.getElementById("todo-list");
const addTodoBtn = document.getElementById("add-todo");
const newTodoInput = document.getElementById("new-todo");
const saveNoteBtn = document.getElementById("save-note");
const noteFeedback = document.getElementById("note-feedback");
const internalNoteInput = document.getElementById("internal-note");
const kpiAttivita = document.getElementById("kpi-attivita");
const kpiPratiche = document.getElementById("kpi-pratiche");
const kpiUdienze = document.getElementById("kpi-udienze");
const kpiParcelle = document.getElementById("kpi-parcelle");

// === Riferimenti DOM – Agenda ===
const agendaList = document.getElementById("agenda-list");
const addAgendaBtn = document.getElementById("add-agenda");
const newAgendaDatetime = document.getElementById("new-agenda-datetime");
const newAgendaText = document.getElementById("new-agenda-text");

// === Riferimenti DOM – Pratiche ===
const praticheTbody = document.getElementById("pratiche-tbody");
const addPraticaBtn = document.getElementById("add-pratica");
const newPraticaCliente = document.getElementById("new-pratica-cliente");
const newPraticaNome = document.getElementById("new-pratica-nome");
const newPraticaStato = document.getElementById("new-pratica-stato");
const newPraticaScadenza = document.getElementById("new-pratica-scadenza");
const newPraticaAzione = document.getElementById("new-pratica-azione");

// === Riferimenti DOM – Archivio ===
const archivioList = document.getElementById("archivio-list");
const addArchivioBtn = document.getElementById("add-archivio");
const newArchivioNome = document.getElementById("new-archivio-nome");

// === Riferimenti DOM – Promemoria ===
const promemoriaList = document.getElementById("promemoria-list");
const addPromemoriaBtn = document.getElementById("add-promemoria");
const newPromemoriaInput = document.getElementById("new-promemoria");

// === Stato modulo ===
let firebaseApp = null;
let firestoreDb = null;
let firestoreApi = null;
let authModule = null;
let authInstance = null;
let firebaseEnabled = false;
let seedInProgress = false;

// =============================================================
// Indicatore stato connessione DB
// =============================================================

const DB_STATE_LABELS = {
  connecting: "⏳ Connessione…",
  connected: "🟢 Connesso a Firebase",
  error: "🔴 Errore Firebase",
  local: "🟡 Solo locale",
};

function setDbStatus(state, message = "") {
  if (dbStatusBadge) {
    dbStatusBadge.className = `db-badge ${state}`;
    dbStatusBadge.textContent = DB_STATE_LABELS[state] ?? state;
  }
  if (dbStatusMsg) dbStatusMsg.textContent = message;
  if (dbStatusTime) {
    dbStatusTime.textContent = `Aggiornato: ${new Date().toLocaleTimeString("it-IT")}`;
  }
}

// =============================================================
// Helpers UI
// =============================================================

function makeIconBtn(icon, title) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-icon";
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.textContent = `${icon} ${title}`;
  return btn;
}

function formatAgendaDateTime(value) {
  const safe = String(value || "").trim();
  if (!safe) return "";
  const parsed = new Date(safe);
  if (Number.isNaN(parsed.getTime())) return safe;
  return parsed.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Rimpiazza spanEl con un input per la modifica inline.
 * Funziona su qualsiasi elemento con .textContent (span, button, ecc.).
 */
function inlineEditSpan(spanEl, onSave) {
  if (!spanEl.isConnected) return;
  const currentText = spanEl.textContent;
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentText;
  input.style.width = "auto";
  input.style.flex = "1";
  input.style.minWidth = "4rem";
  spanEl.replaceWith(input);
  input.focus();
  input.select();

  async function save() {
    const val = input.value.trim();
    const finalText = val || currentText;
    spanEl.textContent = finalText;
    input.replaceWith(spanEl);
    if (val && val !== currentText) await onSave(finalText);
  }

  input.addEventListener("blur", save);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { input.replaceWith(spanEl); }
  });
}

function setNoteMessage(msg) {
  if (noteFeedback) noteFeedback.textContent = msg;
}

// =============================================================
// Helpers priorità TODO
// =============================================================

function normalizePriority(p) {
  if (p === "high" || p === "low") return p;
  return "medium";
}

function priorityLabel(p) {
  if (p === "high") return "Alta";
  if (p === "low") return "Bassa";
  return "Media";
}

// =============================================================
// KPI
// =============================================================

function syncTodoKpi() {
  if (!todoList || !kpiAttivita) return;
  const remaining = todoList.querySelectorAll(`${TODO_CHECKBOX_SELECTOR}:not(:checked)`).length;
  kpiAttivita.textContent = String(remaining);
}

function syncKpiPratiche() {
  if (!praticheTbody || !kpiPratiche) return;
  kpiPratiche.textContent = String(
    countPraticheByStato((s) => s !== STATO_CHIUSA),
  );
}

function syncKpiUdienze() {
  if (!agendaList || !kpiUdienze) return;
  kpiUdienze.textContent = String(agendaList.querySelectorAll("li").length);
}

function syncKpiParcelle() {
  if (!praticheTbody || !kpiParcelle) return;
  kpiParcelle.textContent = String(
    countPraticheByStato((s) => s === STATO_QUASI_CHIUSA),
  );
}

function countPraticheByStato(predicate) {
  if (!praticheTbody) return 0;
  let count = 0;
  for (const row of praticheTbody.querySelectorAll("tr[data-id]")) {
    if (predicate(row.dataset.stato ?? "")) count++;
  }
  return count;
}

// =============================================================
// Inizializzazione Firebase
// =============================================================

const isFirestoreReady = () => Boolean(firebaseEnabled && firestoreDb && firestoreApi);

async function initFirebase() {
  setDbStatus("connecting");
  try {
    const [{ initializeApp }, fsModule, auth] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-firestore.js`),
      import(`${SDK}/firebase-auth.js`),
    ]);

    firebaseApp = initializeApp(FIREBASE_CONFIG);
    firestoreDb = fsModule.getFirestore(firebaseApp);
    firestoreApi = fsModule;
    authModule = auth;
    authInstance = auth.getAuth(firebaseApp);
    firebaseEnabled = true;
    setDbStatus("connected", "Firestore attivo");
    return authInstance;
  } catch (err) {
    console.error("Errore inizializzazione Firebase:", err);
    setDbStatus("error", err.message || "Inizializzazione fallita");
    return null;
  }
}

// =============================================================
// TODO – rendering e CRUD
// =============================================================

function createTodoElement(todo) {
  const item = document.createElement("li");
  const safeText = String(todo.text || "").trim();
  const priority = normalizePriority(todo.priority);

  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.setAttribute("aria-label", safeText);
  checkbox.checked = Boolean(todo.completed);
  if (todo.id) checkbox.dataset.id = todo.id;

  const textSpan = document.createElement("span");
  textSpan.textContent = safeText;
  label.appendChild(checkbox);
  label.appendChild(textSpan);

  const badge = document.createElement("span");
  badge.className = `priority ${priority}`;
  badge.textContent = priorityLabel(priority);

  const editBtn = makeIconBtn("✏", "Modifica");
  editBtn.addEventListener("click", () => {
    inlineEditSpan(textSpan, async (newText) => {
      if (!todo.id || !isFirestoreReady()) return;
      try {
        await firestoreApi.updateDoc(
          firestoreApi.doc(firestoreDb, TODOS_COLLECTION, todo.id),
          { text: newText },
        );
      } catch (err) {
        console.error("Errore modifica TODO:", err);
        setNoteMessage("Errore modifica TODO su Firebase.");
      }
    });
  });

  const delBtn = makeIconBtn("🗑", "Elimina");
  delBtn.addEventListener("click", () => handleDeleteTodo(todo.id, item));

  const actions = document.createElement("span");
  actions.className = "item-actions";
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  item.appendChild(label);
  item.appendChild(badge);
  item.appendChild(actions);
  return item;
}

function renderTodos(todos) {
  if (!todoList) return;
  todoList.innerHTML = "";
  for (const todo of todos) {
    if (!todo.text) continue;
    todoList.appendChild(createTodoElement(todo));
  }
  syncTodoKpi();
}

async function syncTodosFromFirestore() {
  if (!isFirestoreReady()) return;
  try {
    const todosRef = firestoreApi.collection(firestoreDb, TODOS_COLLECTION);
    const snap = await firestoreApi.getDocs(
      firestoreApi.query(todosRef, firestoreApi.orderBy("createdAt", "asc")),
    );
    renderTodos(
      snap.docs.map((d) => ({
        id: d.id,
        text: String(d.data().text || ""),
        completed: Boolean(d.data().completed),
        priority: normalizePriority(d.data().priority),
      })),
    );
  } catch (err) {
    console.error("Errore caricamento TODO:", err);
    setNoteMessage("Errore lettura TODO da Firebase.");
    setDbStatus("error", err.message);
  }
}

async function handleAddTodo() {
  if (seedInProgress) { setNoteMessage("Sincronizzazione in corso, attendi."); return; }
  const value = newTodoInput instanceof HTMLInputElement ? newTodoInput.value.trim() : "";
  if (!value || !todoList) {
    setNoteMessage("Inserisci una descrizione per il to-do.");
    return;
  }

  if (isFirestoreReady()) {
    try {
      const ref = await firestoreApi.addDoc(
        firestoreApi.collection(firestoreDb, TODOS_COLLECTION),
        { text: value, completed: false, priority: "medium", createdAt: firestoreApi.serverTimestamp() },
      );
      todoList.appendChild(createTodoElement({ id: ref.id, text: value, completed: false, priority: "medium" }));
      newTodoInput.value = "";
      syncTodoKpi();
      return;
    } catch (err) {
      console.error("Errore aggiunta TODO:", err);
      setNoteMessage("Errore Firebase: TODO aggiunto solo in locale.");
    }
  }

  todoList.appendChild(createTodoElement({ text: value, completed: false, priority: "medium" }));
  if (newTodoInput instanceof HTMLInputElement) newTodoInput.value = "";
  syncTodoKpi();
}

async function handleDeleteTodo(id, itemEl) {
  itemEl.remove();
  syncTodoKpi();
  if (!id || !isFirestoreReady()) return;
  try {
    await firestoreApi.deleteDoc(firestoreApi.doc(firestoreDb, TODOS_COLLECTION, id));
  } catch (err) {
    console.error("Errore eliminazione TODO:", err);
    setNoteMessage("Errore eliminazione TODO su Firebase.");
  }
}

async function handleTodoChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches(TODO_CHECKBOX_SELECTOR)) return;
  if (seedInProgress) { setNoteMessage("Sincronizzazione in corso, riprova tra poco."); return; }
  const todoId = target.dataset.id;
  syncTodoKpi();
  if (!isFirestoreReady()) return;
  if (!todoId) { setNoteMessage("TODO locale: modifica non sincronizzata con Firebase."); return; }
  try {
    await firestoreApi.updateDoc(
      firestoreApi.doc(firestoreDb, TODOS_COLLECTION, todoId),
      { completed: target.checked },
    );
  } catch (err) {
    console.error("Errore aggiornamento TODO:", err);
    setNoteMessage("Errore aggiornamento su Firebase.");
    setDbStatus("error", err.message);
  }
}

// =============================================================
// Agenda – rendering e CRUD
// =============================================================

function createAgendaElement(item) {
  const li = document.createElement("li");

  const content = document.createElement("span");
  content.className = "item-content";

  const strongEl = document.createElement("strong");
  strongEl.textContent = formatAgendaDateTime(item.dataOra);

  const textSpan = document.createElement("span");
  textSpan.textContent = item.testo ? ` ${item.testo}` : "";

  content.appendChild(strongEl);
  content.appendChild(textSpan);

  const editBtn = makeIconBtn("✏", "Modifica");
  editBtn.addEventListener("click", () => handleEditAgenda(item, li, content, strongEl, textSpan));

  const delBtn = makeIconBtn("🗑", "Elimina");
  delBtn.addEventListener("click", () => handleDeleteAgenda(item.id, li));

  const actions = document.createElement("span");
  actions.className = "item-actions";
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  li.appendChild(content);
  li.appendChild(actions);
  return li;
}

function renderAgenda(items) {
  if (!agendaList) return;
  agendaList.innerHTML = "";
  for (const item of items) {
    if (!item.testo && !item.dataOra) continue;
    agendaList.appendChild(createAgendaElement(item));
  }
  syncKpiUdienze();
}

async function syncAgendaFromFirestore() {
  if (!isFirestoreReady()) return;
  try {
    const snap = await firestoreApi.getDocs(
      firestoreApi.query(
        firestoreApi.collection(firestoreDb, AGENDA_COLLECTION),
        firestoreApi.orderBy("createdAt", "asc"),
      ),
    );
    renderAgenda(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("Errore caricamento agenda:", err);
    setNoteMessage("Errore lettura agenda da Firebase.");
  }
}

async function handleAddAgenda() {
  const dt = newAgendaDatetime instanceof HTMLInputElement ? newAgendaDatetime.value.trim() : "";
  const txt = newAgendaText instanceof HTMLInputElement ? newAgendaText.value.trim() : "";
  if (!dt || !txt || !agendaList) {
    setNoteMessage("Compila data/ora e descrizione per aggiungere un elemento agenda.");
    return;
  }

  const newItem = { dataOra: dt, testo: txt };

  if (isFirestoreReady()) {
    try {
      const docRef = await firestoreApi.addDoc(
        firestoreApi.collection(firestoreDb, AGENDA_COLLECTION),
        { ...newItem, createdAt: firestoreApi.serverTimestamp() },
      );
      agendaList.appendChild(createAgendaElement({ id: docRef.id, ...newItem }));
      if (newAgendaDatetime instanceof HTMLInputElement) newAgendaDatetime.value = "";
      if (newAgendaText instanceof HTMLInputElement) newAgendaText.value = "";
      syncKpiUdienze();
      return;
    } catch (err) {
      console.error("Errore aggiunta agenda:", err);
      setNoteMessage("Errore Firebase: agenda aggiunta solo in locale.");
    }
  }

  agendaList.appendChild(createAgendaElement(newItem));
  if (newAgendaDatetime instanceof HTMLInputElement) newAgendaDatetime.value = "";
  if (newAgendaText instanceof HTMLInputElement) newAgendaText.value = "";
  syncKpiUdienze();
}

async function handleDeleteAgenda(id, li) {
  li.remove();
  syncKpiUdienze();
  if (!id || !isFirestoreReady()) return;
  try {
    await firestoreApi.deleteDoc(firestoreApi.doc(firestoreDb, AGENDA_COLLECTION, id));
  } catch (err) {
    console.error("Errore eliminazione agenda:", err);
    setNoteMessage("Errore eliminazione agenda su Firebase.");
  }
}

function handleEditAgenda(item, li, contentEl, strongEl, textSpan) {
  if (!contentEl.isConnected) return;

  const dtInput = document.createElement("input");
  dtInput.type = "datetime-local";
  dtInput.value = item.dataOra || "";
  dtInput.style.cssText = "width:13rem;flex-shrink:0;";

  const txtInput = document.createElement("input");
  txtInput.type = "text";
  txtInput.value = item.testo || "";
  txtInput.style.cssText = "flex:1;min-width:0;";

  const saveBtn = makeIconBtn("✓", "Salva");
  saveBtn.className = "btn";
  saveBtn.style.cssText = "padding:0.2rem 0.5rem;font-size:0.8rem;flex-shrink:0;";

  const cancelBtn = makeIconBtn("✕", "Annulla");
  cancelBtn.className = "btn secondary";
  cancelBtn.style.cssText = "padding:0.2rem 0.5rem;font-size:0.8rem;flex-shrink:0;";

  const editContent = document.createElement("span");
  editContent.className = "item-content";
  editContent.style.cssText = "display:flex;gap:0.4rem;flex:1;";
  editContent.appendChild(dtInput);
  editContent.appendChild(txtInput);
  editContent.appendChild(saveBtn);
  editContent.appendChild(cancelBtn);

  contentEl.replaceWith(editContent);
  dtInput.focus();

  cancelBtn.addEventListener("click", () => editContent.replaceWith(contentEl));

  saveBtn.addEventListener("click", async () => {
    const newDt = dtInput.value.trim() || item.dataOra || "";
    const newTxt = txtInput.value.trim() || item.testo || "";
    if (!newDt || !newTxt) {
      setNoteMessage("Data/ora e descrizione sono obbligatorie.");
      return;
    }
    strongEl.textContent = formatAgendaDateTime(newDt);
    textSpan.textContent = newTxt ? ` ${newTxt}` : "";
    editContent.replaceWith(contentEl);
    item.dataOra = newDt;
    item.testo = newTxt;
    syncKpiUdienze();
    if (item.id && isFirestoreReady()) {
      try {
        await firestoreApi.updateDoc(
          firestoreApi.doc(firestoreDb, AGENDA_COLLECTION, item.id),
          { dataOra: newDt, testo: newTxt },
        );
      } catch (err) {
        console.error("Errore modifica agenda:", err);
        setNoteMessage("Errore modifica agenda su Firebase.");
      }
    }
  });
}

// =============================================================
// Pipeline pratiche – rendering e CRUD
// =============================================================

function praticaStatoClass(stato) {
  return stato === STATO_QUASI_CHIUSA || stato === STATO_CHIUSA ? "status-ok" : "status-warn";
}

function createPraticaRow(pratica) {
  const tr = document.createElement("tr");
  if (pratica.id) tr.dataset.id = pratica.id;
  tr.dataset.stato = pratica.stato || "";

  const tdC = document.createElement("td");
  tdC.textContent = pratica.cliente || "";

  const tdP = document.createElement("td");
  tdP.textContent = pratica.pratica || "";

  const tdS = document.createElement("td");
  const statoSpan = document.createElement("span");
  statoSpan.className = praticaStatoClass(pratica.stato);
  statoSpan.textContent = pratica.stato || "";
  tdS.appendChild(statoSpan);

  const tdSc = document.createElement("td");
  tdSc.textContent = pratica.scadenza || "";

  const tdA = document.createElement("td");
  tdA.textContent = pratica.prossimaAzione || "";

  const tdBtn = document.createElement("td");
  tdBtn.style.whiteSpace = "nowrap";
  const editBtn = makeIconBtn("✏", "Modifica");
  editBtn.addEventListener("click", () => handleEditPratica(pratica, tr));
  const delBtn = makeIconBtn("🗑", "Elimina");
  delBtn.addEventListener("click", () => handleDeletePratica(pratica.id, tr));
  tdBtn.appendChild(editBtn);
  tdBtn.appendChild(delBtn);

  tr.appendChild(tdC);
  tr.appendChild(tdP);
  tr.appendChild(tdS);
  tr.appendChild(tdSc);
  tr.appendChild(tdA);
  tr.appendChild(tdBtn);
  return tr;
}

function renderPratiche(items) {
  if (!praticheTbody) return;
  praticheTbody.innerHTML = "";
  for (const item of items) {
    praticheTbody.appendChild(createPraticaRow(item));
  }
  syncKpiPratiche();
  syncKpiParcelle();
}

async function syncPraticheFromFirestore() {
  if (!isFirestoreReady()) return;
  try {
    const snap = await firestoreApi.getDocs(
      firestoreApi.query(
        firestoreApi.collection(firestoreDb, PRATICHE_COLLECTION),
        firestoreApi.orderBy("createdAt", "asc"),
      ),
    );
    renderPratiche(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("Errore caricamento pratiche:", err);
    setNoteMessage("Errore lettura pratiche da Firebase.");
  }
}

async function handleAddPratica() {
  const cliente = newPraticaCliente instanceof HTMLInputElement ? newPraticaCliente.value.trim() : "";
  const pratica = newPraticaNome instanceof HTMLInputElement ? newPraticaNome.value.trim() : "";
  const stato = newPraticaStato instanceof HTMLSelectElement ? newPraticaStato.value : "In corso";
  const scadenza = newPraticaScadenza instanceof HTMLInputElement ? newPraticaScadenza.value : "";
  const prossimaAzione = newPraticaAzione instanceof HTMLInputElement ? newPraticaAzione.value.trim() : "";

  if (!cliente || !pratica || !praticheTbody) {
    setNoteMessage("Inserisci almeno cliente e nome pratica.");
    return;
  }

  const newPratica = { cliente, pratica, stato, scadenza, prossimaAzione };

  if (isFirestoreReady()) {
    try {
      const docRef = await firestoreApi.addDoc(
        firestoreApi.collection(firestoreDb, PRATICHE_COLLECTION),
        { ...newPratica, createdAt: firestoreApi.serverTimestamp() },
      );
      praticheTbody.appendChild(createPraticaRow({ id: docRef.id, ...newPratica }));
      [newPraticaCliente, newPraticaNome, newPraticaScadenza, newPraticaAzione].forEach((el) => {
        if (el instanceof HTMLInputElement) el.value = "";
      });
      syncKpiPratiche();
      syncKpiParcelle();
      return;
    } catch (err) {
      console.error("Errore aggiunta pratica:", err);
      setNoteMessage("Errore Firebase: pratica aggiunta solo in locale.");
    }
  }

  praticheTbody.appendChild(createPraticaRow(newPratica));
  [newPraticaCliente, newPraticaNome, newPraticaScadenza, newPraticaAzione].forEach((el) => {
    if (el instanceof HTMLInputElement) el.value = "";
  });
  syncKpiPratiche();
  syncKpiParcelle();
}

async function handleDeletePratica(id, tr) {
  tr.remove();
  syncKpiPratiche();
  syncKpiParcelle();
  if (!id || !isFirestoreReady()) return;
  try {
    await firestoreApi.deleteDoc(firestoreApi.doc(firestoreDb, PRATICHE_COLLECTION, id));
  } catch (err) {
    console.error("Errore eliminazione pratica:", err);
    setNoteMessage("Errore eliminazione pratica su Firebase.");
  }
}

function handleEditPratica(pratica, tr) {
  if (!tr.isConnected) return;

  function makeInputTd(value, placeholder) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.placeholder = placeholder || "";
    input.style.cssText = "width:100%;min-width:60px;";
    td.appendChild(input);
    return { td, input };
  }

  function makeSelectTd(value) {
    const td = document.createElement("td");
    const select = document.createElement("select");
    for (const opt of STATI_PRATICA) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === value) o.selected = true;
      select.appendChild(o);
    }
    td.appendChild(select);
    return { td, select };
  }

  const { td: tdC, input: inpC } = makeInputTd(pratica.cliente, "Cliente");
  const { td: tdP, input: inpP } = makeInputTd(pratica.pratica, "Pratica");
  const { td: tdS, select: selS } = makeSelectTd(pratica.stato);
  const { td: tdSc, input: inpSc } = makeInputTd(pratica.scadenza, "YYYY-MM-DD");
  inpSc.type = "date";
  const { td: tdA, input: inpA } = makeInputTd(pratica.prossimaAzione, "Prossima azione");

  const tdBtn = document.createElement("td");
  tdBtn.style.whiteSpace = "nowrap";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn";
  saveBtn.style.cssText = "padding:0.2rem 0.45rem;font-size:0.8rem;margin-right:0.2rem;";
  saveBtn.textContent = "✓";
  saveBtn.title = "Salva";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn secondary";
  cancelBtn.style.cssText = "padding:0.2rem 0.45rem;font-size:0.8rem;";
  cancelBtn.textContent = "✕";
  cancelBtn.title = "Annulla";
  tdBtn.appendChild(saveBtn);
  tdBtn.appendChild(cancelBtn);

  const editTr = document.createElement("tr");
  editTr.appendChild(tdC);
  editTr.appendChild(tdP);
  editTr.appendChild(tdS);
  editTr.appendChild(tdSc);
  editTr.appendChild(tdA);
  editTr.appendChild(tdBtn);

  tr.replaceWith(editTr);
  inpC.focus();

  cancelBtn.addEventListener("click", () => editTr.replaceWith(tr));

  saveBtn.addEventListener("click", async () => {
    const updated = {
      ...pratica,
      cliente: inpC.value.trim() || pratica.cliente,
      pratica: inpP.value.trim() || pratica.pratica,
      stato: selS.value,
      scadenza: inpSc.value,
      prossimaAzione: inpA.value.trim(),
    };
    editTr.replaceWith(createPraticaRow(updated));
    syncKpiPratiche();
    syncKpiParcelle();
    if (pratica.id && isFirestoreReady()) {
      try {
        await firestoreApi.updateDoc(
          firestoreApi.doc(firestoreDb, PRATICHE_COLLECTION, pratica.id),
          {
            cliente: updated.cliente,
            pratica: updated.pratica,
            stato: updated.stato,
            scadenza: updated.scadenza,
            prossimaAzione: updated.prossimaAzione,
          },
        );
      } catch (err) {
        console.error("Errore modifica pratica:", err);
        setNoteMessage("Errore modifica pratica su Firebase.");
      }
    }
  });
}

// =============================================================
// Archivio – rendering e CRUD
// =============================================================

function createArchivioElement(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "archivio-item";
  if (item.id) wrapper.dataset.id = item.id;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn secondary";
  btn.textContent = item.nome || "";

  const editBtn = makeIconBtn("✏", "Rinomina");
  editBtn.addEventListener("click", () => {
    inlineEditSpan(btn, async (newNome) => {
      if (item.id && isFirestoreReady()) {
        try {
          await firestoreApi.updateDoc(
            firestoreApi.doc(firestoreDb, ARCHIVIO_COLLECTION, item.id),
            { nome: newNome },
          );
        } catch (err) {
          console.error("Errore modifica archivio:", err);
          setNoteMessage("Errore modifica archivio su Firebase.");
        }
      }
      item.nome = newNome;
    });
  });

  const delBtn = makeIconBtn("🗑", "Elimina");
  delBtn.addEventListener("click", () => handleDeleteArchivio(item.id, wrapper));

  wrapper.appendChild(btn);
  wrapper.appendChild(editBtn);
  wrapper.appendChild(delBtn);
  return wrapper;
}

function renderArchivio(items) {
  if (!archivioList) return;
  archivioList.innerHTML = "";
  for (const item of items) {
    if (!item.nome) continue;
    archivioList.appendChild(createArchivioElement(item));
  }
}

async function syncArchivioFromFirestore() {
  if (!isFirestoreReady()) return;
  try {
    const snap = await firestoreApi.getDocs(
      firestoreApi.query(
        firestoreApi.collection(firestoreDb, ARCHIVIO_COLLECTION),
        firestoreApi.orderBy("createdAt", "asc"),
      ),
    );
    renderArchivio(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("Errore caricamento archivio:", err);
    setNoteMessage("Errore lettura archivio da Firebase.");
  }
}

async function handleAddArchivio() {
  const nome = newArchivioNome instanceof HTMLInputElement ? newArchivioNome.value.trim() : "";
  if (!nome || !archivioList) {
    setNoteMessage("Inserisci un nome per lo strumento/voce di archivio.");
    return;
  }

  if (isFirestoreReady()) {
    try {
      const docRef = await firestoreApi.addDoc(
        firestoreApi.collection(firestoreDb, ARCHIVIO_COLLECTION),
        { nome, createdAt: firestoreApi.serverTimestamp() },
      );
      archivioList.appendChild(createArchivioElement({ id: docRef.id, nome }));
      if (newArchivioNome instanceof HTMLInputElement) newArchivioNome.value = "";
      return;
    } catch (err) {
      console.error("Errore aggiunta archivio:", err);
      setNoteMessage("Errore Firebase: archivio aggiunto solo in locale.");
    }
  }

  archivioList.appendChild(createArchivioElement({ nome }));
  if (newArchivioNome instanceof HTMLInputElement) newArchivioNome.value = "";
}

async function handleDeleteArchivio(id, wrapper) {
  wrapper.remove();
  if (!id || !isFirestoreReady()) return;
  try {
    await firestoreApi.deleteDoc(firestoreApi.doc(firestoreDb, ARCHIVIO_COLLECTION, id));
  } catch (err) {
    console.error("Errore eliminazione archivio:", err);
    setNoteMessage("Errore eliminazione archivio su Firebase.");
  }
}

// =============================================================
// Promemoria – rendering e CRUD
// =============================================================

function createPromemoriaElement(item) {
  const li = document.createElement("li");

  const textSpan = document.createElement("span");
  textSpan.className = "item-text";
  textSpan.textContent = item.testo || "";

  const editBtn = makeIconBtn("✏", "Modifica");
  editBtn.addEventListener("click", () => {
    inlineEditSpan(textSpan, async (newTesto) => {
      if (item.id && isFirestoreReady()) {
        try {
          await firestoreApi.updateDoc(
            firestoreApi.doc(firestoreDb, PROMEMORIA_COLLECTION, item.id),
            { testo: newTesto },
          );
        } catch (err) {
          console.error("Errore modifica promemoria:", err);
          setNoteMessage("Errore modifica promemoria su Firebase.");
        }
      }
      item.testo = newTesto;
    });
  });

  const delBtn = makeIconBtn("🗑", "Elimina");
  delBtn.addEventListener("click", () => handleDeletePromemoria(item.id, li));

  const actions = document.createElement("span");
  actions.className = "item-actions";
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  li.appendChild(textSpan);
  li.appendChild(actions);
  return li;
}

function renderPromemoria(items) {
  if (!promemoriaList) return;
  promemoriaList.innerHTML = "";
  for (const item of items) {
    if (!item.testo) continue;
    promemoriaList.appendChild(createPromemoriaElement(item));
  }
}

async function syncPromemoriaFromFirestore() {
  if (!isFirestoreReady()) return;
  try {
    const snap = await firestoreApi.getDocs(
      firestoreApi.query(
        firestoreApi.collection(firestoreDb, PROMEMORIA_COLLECTION),
        firestoreApi.orderBy("createdAt", "asc"),
      ),
    );
    renderPromemoria(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("Errore caricamento promemoria:", err);
    setNoteMessage("Errore lettura promemoria da Firebase.");
  }
}

async function handleAddPromemoria() {
  const testo = newPromemoriaInput instanceof HTMLInputElement ? newPromemoriaInput.value.trim() : "";
  if (!testo || !promemoriaList) {
    setNoteMessage("Inserisci un testo per il promemoria.");
    return;
  }

  if (isFirestoreReady()) {
    try {
      const docRef = await firestoreApi.addDoc(
        firestoreApi.collection(firestoreDb, PROMEMORIA_COLLECTION),
        { testo, createdAt: firestoreApi.serverTimestamp() },
      );
      promemoriaList.appendChild(createPromemoriaElement({ id: docRef.id, testo }));
      if (newPromemoriaInput instanceof HTMLInputElement) newPromemoriaInput.value = "";
      return;
    } catch (err) {
      console.error("Errore aggiunta promemoria:", err);
      setNoteMessage("Errore Firebase: promemoria aggiunto solo in locale.");
    }
  }

  promemoriaList.appendChild(createPromemoriaElement({ testo }));
  if (newPromemoriaInput instanceof HTMLInputElement) newPromemoriaInput.value = "";
}

async function handleDeletePromemoria(id, li) {
  li.remove();
  if (!id || !isFirestoreReady()) return;
  try {
    await firestoreApi.deleteDoc(firestoreApi.doc(firestoreDb, PROMEMORIA_COLLECTION, id));
  } catch (err) {
    console.error("Errore eliminazione promemoria:", err);
    setNoteMessage("Errore eliminazione promemoria su Firebase.");
  }
}

// =============================================================
// Nota interna
// =============================================================

async function syncNoteFromFirestore() {
  if (!isFirestoreReady() || !(internalNoteInput instanceof HTMLTextAreaElement)) return;
  try {
    const noteRef = firestoreApi.doc(firestoreDb, INTERNAL_AREA_COLLECTION, INTERNAL_AREA_MAIN_DOC);
    const snap = await firestoreApi.getDoc(noteRef);
    if (!snap.exists()) return;
    const remoteNote = String(snap.data().note || "").trim();
    if (!remoteNote) return;
    const localNote = localStorage.getItem(NOTE_STORAGE_KEY)?.trim();
    if (localNote && localNote !== remoteNote) {
      setNoteMessage("Conflitto locale/remoto: mantenuta nota locale.");
      console.warn("Conflitto nota locale/remota: mantenuta nota locale.");
      return;
    }
    internalNoteInput.value = remoteNote;
    localStorage.setItem(NOTE_STORAGE_KEY, remoteNote);
  } catch (err) {
    console.error("Errore caricamento nota:", err);
    setNoteMessage("Errore lettura nota da Firebase.");
  }
}

function loadLocalNote() {
  if (!(internalNoteInput instanceof HTMLTextAreaElement)) return;
  const saved = localStorage.getItem(NOTE_STORAGE_KEY);
  if (saved) internalNoteInput.value = saved;
}

async function handleSaveNote() {
  if (!(internalNoteInput instanceof HTMLTextAreaElement)) return;
  const noteValue = internalNoteInput.value.trim();
  localStorage.setItem(NOTE_STORAGE_KEY, noteValue);

  if (isFirestoreReady()) {
    try {
      await firestoreApi.setDoc(
        firestoreApi.doc(firestoreDb, INTERNAL_AREA_COLLECTION, INTERNAL_AREA_MAIN_DOC),
        { note: noteValue, updatedAt: firestoreApi.serverTimestamp() },
        { merge: true },
      );
      setNoteMessage("Nota salvata su Firebase.");
      return;
    } catch (err) {
      console.error("Errore salvataggio nota:", err);
      setNoteMessage("Errore Firebase: nota salvata localmente.");
      setDbStatus("error", err.message);
      return;
    }
  }
  setNoteMessage("Nota salvata localmente.");
}

// =============================================================
// Gestione visibilità sezioni
// =============================================================

function showLoading() {
  if (loadingSection) loadingSection.hidden = false;
  if (loginSection) loginSection.hidden = true;
  if (internalSection) internalSection.hidden = true;
}

function showLogin() {
  if (loadingSection) loadingSection.hidden = true;
  if (loginSection) loginSection.hidden = false;
  if (internalSection) internalSection.hidden = true;
  if (userBar) userBar.hidden = true;
}

function showInternal(user) {
  if (loadingSection) loadingSection.hidden = true;
  if (loginSection) loginSection.hidden = true;
  if (internalSection) internalSection.hidden = false;
  if (userBar) userBar.hidden = false;
  if (userEmailDisplay) userEmailDisplay.textContent = user.email ?? "utente locale";
}

// =============================================================
// Autenticazione
// =============================================================

async function handleLogin(e) {
  e.preventDefault();
  if (loginError) loginError.textContent = "";
  const email = loginEmail instanceof HTMLInputElement ? loginEmail.value.trim() : "";
  const password = loginPassword instanceof HTMLInputElement ? loginPassword.value : "";
  if (!email || !password) {
    if (loginError) loginError.textContent = "Inserisci email e password.";
    return;
  }
  if (!authModule || !authInstance) {
    if (loginError) loginError.textContent = "Firebase non disponibile.";
    return;
  }
  try {
    await authModule.signInWithEmailAndPassword(authInstance, email, password);
  } catch (err) {
    console.error("Errore login:", err);
    const MESSAGES = {
      "auth/wrong-password": "Password non corretta.",
      "auth/user-not-found": "Utente non trovato.",
      "auth/invalid-email": "Email non valida.",
      "auth/too-many-requests": "Troppi tentativi, attendi qualche minuto.",
      "auth/invalid-credential": "Credenziali non valide.",
    };
    if (loginError) loginError.textContent = MESSAGES[err.code] ?? "Errore di accesso.";
  }
}

async function handleLogout() {
  if (!authModule || !authInstance) return;
  try {
    await authModule.signOut(authInstance);
  } catch (err) {
    console.error("Errore logout:", err);
  }
}

// =============================================================
// Bootstrap area interna
// =============================================================

async function bootstrap() {
  showLoading();
  const auth = await initFirebase();

  if (!auth) {
    setDbStatus("local", "Firebase non raggiungibile: modalità solo locale.");
    showInternal({ email: null });
    loadLocalNote();
    syncTodoKpi();
    return;
  }

  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  authModule.onAuthStateChanged(auth, async (user) => {
    if (user) {
      showInternal(user);
      loadLocalNote();
      syncTodoKpi();
      await Promise.all([
        syncTodosFromFirestore(),
        syncAgendaFromFirestore(),
        syncPraticheFromFirestore(),
        syncArchivioFromFirestore(),
        syncPromemoriaFromFirestore(),
        syncNoteFromFirestore(),
      ]);
    } else {
      showLogin();
    }
  });
}

// Wire up eventi statici
if (addTodoBtn) addTodoBtn.addEventListener("click", handleAddTodo);
if (todoList) todoList.addEventListener("change", handleTodoChange);
if (saveNoteBtn) saveNoteBtn.addEventListener("click", handleSaveNote);
if (addAgendaBtn) addAgendaBtn.addEventListener("click", handleAddAgenda);
if (addPraticaBtn) addPraticaBtn.addEventListener("click", handleAddPratica);
if (addArchivioBtn) addArchivioBtn.addEventListener("click", handleAddArchivio);
if (addPromemoriaBtn) addPromemoriaBtn.addEventListener("click", handleAddPromemoria);

// Enter key per i form di aggiunta
if (newTodoInput) newTodoInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTodo(); } });
if (newAgendaText) newAgendaText.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAgenda(); } });
if (newAgendaDatetime) newAgendaDatetime.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAgenda(); } });
if (newArchivioNome) newArchivioNome.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); handleAddArchivio(); } });
if (newPromemoriaInput) newPromemoriaInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); handleAddPromemoria(); } });
if (newPraticaAzione) newPraticaAzione.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); handleAddPratica(); } });

bootstrap().catch((err) => {
  console.error("Errore non gestito nel bootstrap:", err);
  setDbStatus("error", "Errore avvio.");
});
