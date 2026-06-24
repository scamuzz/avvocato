// Firebase compat SDK initialization — Studio Legale Avv. Corrado Scamuzzi
// La chiave API web è pubblica per design; la sicurezza è delegata alle Firebase Security Rules.
// Richiede: firebase-app-compat, firebase-auth-compat, firebase-firestore-compat,
//           firebase-storage-compat caricati via CDN prima di questo script.

(function () {
  var firebaseConfig = {
   apiKey: "AIzaSyDP-OTmxD0w3a1GwV4Swv5al4iD7LjkRQc",
  authDomain: "studio-avvocato.firebaseapp.com",
  projectId: "studio-avvocato",
  storageBucket: "studio-avvocato.firebasestorage.app",
  messagingSenderId: "937368694167",
  appId: "1:937368694167:web:afcd02a0f1b8ae5c66a8d2",
  };

  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  if (typeof firebase !== 'undefined') {
    window.auth = firebase.auth();
    window.db   = firebase.firestore();
    if (typeof firebase.storage === 'function') {
      window.storage = firebase.storage();
    }

    // Persistenza offline (opzionale — commentare se non necessario)
    window.db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
      if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
        console.warn('Firestore persistence error:', err);
      }
    });
  }
})();
