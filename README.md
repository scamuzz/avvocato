# Studio Legale – Gestionale Web

Applicazione web completa per la gestione di uno studio legale, basata su HTML5, CSS3, JavaScript Vanilla e Firebase.

## 🏗️ Struttura del Progetto

```
/
├── index.html              # Home pubblica (servizi, contatti, form)
├── firebase.json           # Configurazione Firebase Hosting
├── firestore.rules         # Regole sicurezza Firestore
├── storage.rules           # Regole sicurezza Firebase Storage
│
├── /css
│   ├── style.css           # Design system globale (sidebar, navbar, componenti)
│   ├── dashboard.css       # Stili dashboard
│   ├── clienti.css         # Stili gestione clienti
│   ├── pratiche.css        # Stili gestione pratiche
│   └── calendario.css      # Stili calendario e agenda
│
├── /js
│   ├── firebase-config.js  # ⚠️ Configurazione Firebase (da aggiornare)
│   ├── utilities.js        # Funzioni condivise (date, toast, modal, ecc.)
│   ├── auth.js             # Autenticazione Firebase
│   ├── dashboard.js        # Logica dashboard
│   ├── clienti.js          # CRUD clienti
│   ├── pratiche.js         # CRUD pratiche
│   ├── appuntamenti.js     # CRUD appuntamenti
│   ├── udienze.js          # CRUD udienze
│   ├── documenti.js        # Upload/download documenti (Firebase Storage)
│   ├── note.js             # CRUD note interne
│   └── richieste.js        # Gestione richieste di contatto
│
└── /pages
    ├── login.html          # Pagina di accesso
    ├── dashboard.html      # Dashboard principale
    ├── clienti.html        # Gestione clienti
    ├── pratiche.html       # Gestione pratiche
    ├── appuntamenti.html   # Gestione appuntamenti
    ├── udienze.html        # Gestione udienze
    ├── documenti.html      # Gestione documenti
    ├── note.html           # Note interne
    ├── richieste.html      # Richieste di contatto
    └── profilo-cliente.html # Scheda dettaglio cliente
```

## ⚙️ Setup Firebase

### 1. Crea un progetto Firebase
1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuovo progetto
3. Abilita **Authentication** → Email/Password
4. Crea un database **Firestore** (modalità produzione)
5. Abilita **Firebase Storage**

> ℹ️ L'applicazione usa **Cloud Firestore** (sezione **Firestore Database**) e non **Realtime Database**.
> Se apri la sezione Realtime Database in console è normale non vedere lì i documenti dell'app.

### 2. Configura le credenziali
Apri `js/firebase-config.js` e sostituisci i valori con quelli del tuo progetto:

```javascript
const firebaseConfig = {
  apiKey: "LA_TUA_API_KEY",
  authDomain: "IL_TUO_PROJECT_ID.firebaseapp.com",
  projectId: "IL_TUO_PROJECT_ID",
  storageBucket: "IL_TUO_PROJECT_ID.appspot.com",
  messagingSenderId: "IL_TUO_SENDER_ID",
  appId: "IL_TUO_APP_ID"
};
```

Le credenziali si trovano in:  
**Firebase Console → Impostazioni Progetto → Generale → Le tue app**

### 3. Crea il primo utente (Avvocato)
1. In Firebase Console, vai su **Authentication → Utenti**
2. Aggiungi un utente con email e password
3. In **Firestore**, crea un documento nella collezione `users`:

```json
{
  "uid": "UID_DELL_UTENTE",
  "nome": "Mario",
  "cognome": "Rossi",
  "email": "mario.rossi@studio.it",
  "ruolo": "avvocato",
  "dataCreazione": "2024-01-01T00:00:00Z"
}
```

### 4. Applica le regole Firestore e Storage
```bash
# Installa Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Deploy regole
firebase deploy --only firestore:rules,storage
```

### 5. Configura CORS per Firebase Storage

> ⚠️ Necessario se il sito è ospitato su un dominio esterno (es. GitHub Pages). Senza questa configurazione, il browser bloccherà il caricamento dei file con errore CORS.

Il file `cors.json` nella root del progetto contiene già la configurazione corretta. Applicala al bucket con Google Cloud SDK:

```bash
# Con gsutil
gsutil cors set cors.json gs://studio-avvocato.firebasestorage.app

# Oppure con gcloud
gcloud storage buckets update gs://studio-avvocato.firebasestorage.app --cors-file=cors.json

# Verifica
gsutil cors get gs://studio-avvocato.firebasestorage.app
```

In alternativa puoi impostare il CORS dalla [Google Cloud Console](https://console.cloud.google.com/storage/browser/studio-avvocato.firebasestorage.app) → scheda **Configuration** → **CORS**.

> 💡 `gsutil` e `gcloud` sono inclusi nel [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).

### 6. Deploy su Firebase Hosting
```bash
firebase deploy --only hosting
```

## 🔐 Ruoli Utente

| Ruolo | Accesso |
|-------|---------|
| `avvocato` | Accesso completo a tutto |
| `collaboratore` | Accesso lettura/scrittura (no eliminazione) |
| `cliente` | Solo visualizzazione propri dati |

## 📦 Collezioni Firestore

| Collezione | Descrizione |
|-----------|-------------|
| `users` | Profili utente con ruoli |
| `clienti` | Anagrafica clienti |
| `pratiche` | Pratiche legali |
| `documenti` | Metadati documenti (file su Storage) |
| `appuntamenti` | Appuntamenti con clienti |
| `udienze` | Udienze in tribunale |
| `promemoria` | Promemoria e scadenze |
| `noteInterne` | Note private per pratica |
| `richiesteContatto` | Richieste dal sito pubblico |

## 🎨 Design

- **Colori**: Blu scuro `#1E3A5F`, bianco, grigio chiaro
- **Font**: system-ui (no dipendenze)
- **Icone**: Font Awesome 6.4 (CDN)
- **Layout**: Sidebar fissa + navbar superiore
- **Responsive**: Breakpoint mobile a 768px con sidebar collassabile

## 🆓 Modalità upload PDF free

- Upload documenti configurato per uso senza abbonamento interno all'app.
- Consentiti solo file **PDF** (`application/pdf`) in Firebase Storage.
- Limite per file: **10 MB** (coerente con uso su piano gratuito Firebase entro le soglie disponibili).

## ⚠️ Indici Firestore Necessari

Alcune query richiedono indici compositi. Firebase mostrerà un link in console per crearli automaticamente. I principali:
- `promemoria`: `completato ASC + dataScadenza ASC`
- `appuntamenti`: `data ASC + ora ASC`
- `noteInterne`: `praticaId ASC + dataCreazione DESC`
