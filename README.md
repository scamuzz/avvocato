# avvocato

Portale web per Studio Legale individuale strutturato in tre aree distinte:

- **Area Pubblica** (`index.html`) – presentazione servizi, prenotazione consulenza, contatti
- **Area Clienti** (`clienti.html`) – stato pratica, documenti, messaggi, fatture
- **Area Interna** (`interna.html`) – uso esclusivo dell'avvocato; richiede autenticazione Firebase

## Struttura del progetto

```
avvocato/
├── index.html          # Area Pubblica
├── clienti.html        # Area Clienti
├── interna.html        # Area Interna (protetta da Firebase Auth)
├── css/
│   └── style.css       # Stili condivisi tra tutte le pagine
├── js/
│   ├── firebase-config.js  # Configurazione Firebase centralizzata
│   └── internal.js         # Logica area interna: Auth, Firestore, indicatore DB
└── README.md
```

## Come avviare

Apri `index.html` in un browser (dalla copia locale del repository).
Non è richiesto alcun server – tutti i file sono statici.

> **Nota:** Per caricare file `.js` come moduli ES (`type="module"`) alcuni browser
> richiedono un server locale invece di aprire il file direttamente come `file://`.
> Usa ad esempio `npx serve .` oppure l'estensione **Live Server** di VS Code.

## Area Interna e Firebase

### Autenticazione

L'accesso all'area interna è protetto da **Firebase Authentication** (email/password).

1. Vai su [Firebase Console](https://console.firebase.google.com/) → progetto **studio-avvocato**
2. Apri **Authentication → Users** e aggiungi un utente con email e password
3. Apri `interna.html`, inserisci le credenziali e accedi

### Indicatore stato connessione DB

L'header dell'area interna mostra sempre la barra di stato Firebase:

| Badge | Significato |
|---|---|
| ⏳ Connessione… | Inizializzazione in corso |
| 🟢 Connesso a Firebase | Firestore e Auth operativi |
| 🔴 Errore Firebase | Problema di rete o configurazione |
| 🟡 Solo locale | Firebase non raggiungibile; dati solo in `localStorage` |

### Funzionalità Firestore

| Funzione | Collection / Document |
|---|---|
| TODO giornalieri | `internal_todos` |
| Nota interna | `internal_area/main` |

Le modifiche (aggiunta TODO, spunta completato, salvataggio nota) sono sincronizzate
in tempo reale su Firestore. In caso di assenza di connessione la pagina rimane
funzionante in modalità locale (`localStorage`).

### Configurazione Firebase

La configurazione è centralizzata in `js/firebase-config.js`.
La chiave API web di Firebase è **pubblica per design**: la sicurezza è gestita
server-side tramite le **Firebase Security Rules** sul progetto.

Esempio di regole Firestore consigliate (solo utenti autenticati):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

