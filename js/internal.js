/**
 * internal.js – Logica area interna: Auth Firebase, Firestore CRUD, indicatore DB.
 * Importato come <script type="module" src="js/internal.js"> in interna.html.
 */

import { FIREBASE_CONFIG, FIREBASE_SDK_VERSION } from "./firebase-config.js";

const SDK = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

// === Costanti Firestore ===
const TODOS_COLLECTION = "internal_todos";
const INTERNAL_AREA_COLLECTION = "internal_area";
const INTERNAL_AREA_MAIN_DOC = "main";
const NOTE_STORAGE_KEY = "avvocato.internal.note";
const TODO_CHECKBOX_SELECTOR = 'input[type="checkbox"]';

// === Riferimenti DOM ===
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

const todoList = document.getElementById("todo-list");
const addTodoBtn = document.getElementById("add-todo");
const newTodoInput = document.getElementById("new-todo");
const saveNoteBtn = document.getElementById("save-note");
const noteFeedback = document.getElementById("note-feedback");
const internalNoteInput = document.getElementById("internal-note");
const kpiAttivita = document.getElementById("kpi-attivita");

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
// Rendering TODO
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

  const text = document.createElement("span");
  text.textContent = safeText;
  label.appendChild(checkbox);
  label.appendChild(text);

  const badge = document.createElement("span");
  badge.className = `priority ${priority}`;
  badge.textContent = priorityLabel(priority);

  item.appendChild(label);
  item.appendChild(badge);
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

function syncTodoKpi() {
  if (!todoList || !kpiAttivita) return;
  const remaining = todoList.querySelectorAll(`${TODO_CHECKBOX_SELECTOR}:not(:checked)`).length;
  kpiAttivita.textContent = String(remaining);
}

// =============================================================
// Feedback nota
// =============================================================

function setNoteMessage(msg) {
  if (noteFeedback) noteFeedback.textContent = msg;
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
// Sincronizzazione Firestore
// =============================================================

async function syncTodosFromFirestore() {
  if (!isFirestoreReady()) return;
  try {
    const todosRef = firestoreApi.collection(firestoreDb, TODOS_COLLECTION);
    const snap = await firestoreApi.getDocs(
      firestoreApi.query(todosRef, firestoreApi.orderBy("createdAt", "asc")),
    );
    const todos = snap.docs.map((d) => ({
      id: d.id,
      text: String(d.data().text || ""),
      completed: Boolean(d.data().completed),
      priority: normalizePriority(d.data().priority),
    }));
    renderTodos(todos);
  } catch (err) {
    console.error("Errore caricamento TODO:", err);
    setNoteMessage("Errore lettura TODO da Firebase.");
    setDbStatus("error", err.message);
  }
}

async function syncNoteFromFirestore() {
  if (!isFirestoreReady() || !(internalNoteInput instanceof HTMLTextAreaElement)) return;
  try {
    const noteRef = firestoreApi.doc(
      firestoreDb,
      INTERNAL_AREA_COLLECTION,
      INTERNAL_AREA_MAIN_DOC,
    );
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

// =============================================================
// Gestione locale nota
// =============================================================

function loadLocalNote() {
  if (!(internalNoteInput instanceof HTMLTextAreaElement)) return;
  const saved = localStorage.getItem(NOTE_STORAGE_KEY);
  if (saved) internalNoteInput.value = saved;
}

// =============================================================
// Handler aggiunta TODO
// =============================================================

async function handleAddTodo() {
  if (seedInProgress) {
    setNoteMessage("Sincronizzazione in corso, attendi.");
    return;
  }
  const value = newTodoInput instanceof HTMLInputElement ? newTodoInput.value.trim() : "";
  if (!value || !todoList) return;

  if (isFirestoreReady()) {
    try {
      const ref = await firestoreApi.addDoc(
        firestoreApi.collection(firestoreDb, TODOS_COLLECTION),
        {
          text: value,
          completed: false,
          priority: "medium",
          createdAt: firestoreApi.serverTimestamp(),
        },
      );
      todoList.appendChild(
        createTodoElement({ id: ref.id, text: value, completed: false, priority: "medium" }),
      );
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

// =============================================================
// Handler cambio stato checkbox TODO
// =============================================================

async function handleTodoChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches(TODO_CHECKBOX_SELECTOR)) return;
  if (seedInProgress) {
    setNoteMessage("Sincronizzazione in corso, riprova tra poco.");
    return;
  }
  const todoId = target.dataset.id;
  syncTodoKpi();

  if (!isFirestoreReady()) return;
  if (!todoId) {
    setNoteMessage("TODO locale: modifica non sincronizzata con Firebase.");
    return;
  }
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
// Handler salvataggio nota
// =============================================================

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
    // Firebase non raggiungibile: mostra area interna in modalità locale
    setDbStatus("local", "Firebase non raggiungibile: modalità solo locale.");
    showInternal({ email: null });
    loadLocalNote();
    syncTodoKpi();
    return;
  }

  // Registra handler auth
  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  // Ascolta cambi stato autenticazione
  authModule.onAuthStateChanged(auth, async (user) => {
    if (user) {
      showInternal(user);
      loadLocalNote();
      syncTodoKpi();
      await syncTodosFromFirestore();
      await syncNoteFromFirestore();
    } else {
      showLogin();
    }
  });
}

// Wire up eventi statici
if (addTodoBtn) addTodoBtn.addEventListener("click", handleAddTodo);
if (todoList) todoList.addEventListener("change", handleTodoChange);
if (saveNoteBtn) saveNoteBtn.addEventListener("click", handleSaveNote);

bootstrap().catch((err) => {
  console.error("Errore non gestito nel bootstrap:", err);
  setDbStatus("error", "Errore avvio.");
});
