# avvocato

Sito HTML dimostrativo per uno studio legale individuale con:

- area pubblica clienti
- area riservata clienti
- area interna per l'avvocato

Apri `index.html` in un browser (dalla tua copia locale del repository) per visualizzarlo.

## Collegamento Firebase (Area Interna)

Le funzioni dell'area interna ora supportano Firestore per:

- elenco TODO giornaliero (`internal_todos`)
- nota interna (`internal_area/main`)

Per abilitare Firebase, prima dello script principale in `index.html` imposta una configurazione globale:

```html
<script>
  window.AVVOCATO_FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    appId: "YOUR_APP_ID"
  };
</script>
```

Se vuoi anche inizializzare automaticamente Firestore con i TODO statici presenti in pagina quando la collection è vuota:

```html
<script>
  window.AVVOCATO_ENABLE_TODO_SEED = true;
</script>
```

Nota: per evitare sovrascritture involontarie, se esiste una nota locale diversa da quella remota viene mantenuta quella locale.

Se la configurazione non è presente o Firebase non è raggiungibile, la pagina continua a funzionare in locale (senza blocchi).
