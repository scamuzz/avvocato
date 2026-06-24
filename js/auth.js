// ============================================================
// AUTH.JS - Firebase Authentication management
// Studio Legale Avv. Corrado Scamuzzi
// Firebase SDK v9 compat — no ES6 imports, global scope
// ============================================================
// Expected load order in HTML:
//   1. Firebase compat CDN scripts (app, auth, firestore)
//   2. utilities.js
//   3. auth.js
// ============================================================

// ============================================================
// FIREBASE INITIALISATION
// ============================================================

var _FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDP-OTmxD0w3a1GwV4Swv5al4iD7LjkRQc',
  authDomain:        'studio-avvocato.firebaseapp.com',
  projectId:         'studio-avvocato',
  storageBucket:     'studio-avvocato.firebasestorage.app',
  messagingSenderId: '937368694167',
  appId:             '1:937368694167:web:afcd02a0f1b8ae5c66a8d2'
};

(function _initFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('[auth.js] Firebase SDK not loaded. Include compat CDN scripts before auth.js.');
    return;
  }
  try {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(_FIREBASE_CONFIG);
    }
  } catch (e) {
    console.error('[auth.js] Firebase init error:', e);
  }
}());


// ============================================================
// GLOBAL AUTH STATE
// ============================================================

window.currentUser     = null;   // firebase.User
window.userRole        = null;   // string: 'avvocato' | 'collaboratore' | 'segreteria' | ...
window.currentUserData = null;   // Firestore user document data


// ============================================================
// LOGIN
// ============================================================

/**
 * Signs in with email and password.
 * Sets LOCAL persistence so the session survives browser restarts.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<firebase.User>}
 */
async function loginUser(email, password) {
  await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  var cred = await firebase.auth().signInWithEmailAndPassword(email, password);
  return cred.user;
}


// ============================================================
// LOGOUT
// ============================================================

/**
 * Signs out the current user and redirects to the login page.
 * @returns {Promise<void>}
 */
async function logoutUser() {
  try {
    await firebase.auth().signOut();
  } catch (e) {
    console.warn('[auth.js] Sign-out error:', e);
  } finally {
    window.currentUser     = null;
    window.userRole        = null;
    window.currentUserData = null;
    window.location.href   = _authResolveLoginUrl();
  }
}


// ============================================================
// PASSWORD RECOVERY
// ============================================================

/**
 * Sends a Firebase password-reset email.
 * @param {string} email
 * @returns {Promise<void>}
 */
async function sendPasswordReset(email) {
  await firebase.auth().sendPasswordResetEmail(email);
}


// ============================================================
// GET USER ROLE
// ============================================================

/**
 * Fetches the role for a given uid from the Firestore "users" collection.
 * @param {string} uid
 * @returns {Promise<string|null>}
 */
async function getUserRole(uid) {
  try {
    var doc = await firebase.firestore().collection('users').doc(uid).get();
    if (!doc.exists) return null;
    var data = doc.data();
    return data.ruolo || data.role || null;
  } catch (e) {
    console.warn('[auth.js] getUserRole error:', e);
    return null;
  }
}


// ============================================================
// AUTH STATE CHANGE LISTENER
// ============================================================
// Runs automatically when the script is loaded.
// • Logged in  → populate window.currentUser / userRole / currentUserData,
//                update navbar
// • Not logged in → redirect to login if <body data-protected="true">
// ============================================================

(function _setupAuthStateListener() {
  if (typeof firebase === 'undefined') return;

  firebase.auth().onAuthStateChanged(async function (user) {
    if (user) {
      // ---- user IS authenticated ----
      window.currentUser = user;

      try {
        var doc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (doc.exists) {
          var data           = doc.data();
          window.userRole        = data.ruolo || data.role || 'collaboratore';
          window.currentUserData = data;
        } else {
          // Firestore document missing — create a minimal placeholder
          window.userRole        = 'collaboratore';
          window.currentUserData = { email: user.email };
        }
      } catch (e) {
        console.warn('[auth.js] Error fetching user document:', e);
        window.userRole        = 'collaboratore';
        window.currentUserData = { email: user.email };
      }

      // Update navbar if utilities.js is loaded
      if (typeof displayUserInfo === 'function') displayUserInfo(user);

      // Wire up logout buttons
      document.querySelectorAll('[data-logout], #logout-btn, .logout-btn').forEach(function (btn) {
        // Avoid double-binding
        if (btn.dataset._logoutBound) return;
        btn.dataset._logoutBound = 'true';
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          logoutUser();
        });
      });

    } else {
      // ---- user NOT authenticated ----
      window.currentUser     = null;
      window.userRole        = null;
      window.currentUserData = null;

      var body = document.querySelector('body');
      if (body && body.dataset.protected === 'true') {
        window.location.href = _authResolveLoginUrl();
      }
    }
  });
}());


// ============================================================
// REGISTER USER  (admin only)
// ============================================================

/**
 * Creates a new Firebase Auth user and a corresponding Firestore document.
 * Uses a secondary Firebase app instance to avoid signing out the current admin.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} nome
 * @param {string} cognome
 * @param {string} ruolo   e.g. 'avvocato' | 'collaboratore' | 'segreteria'
 * @returns {Promise<firebase.User>}  the newly created user
 */
async function registerUser(email, password, nome, cognome, ruolo) {
  // Unique name for secondary app to avoid collision on repeated calls
  var secondaryName = '_reg_' + Date.now();
  var secondaryApp  = firebase.initializeApp(_FIREBASE_CONFIG, secondaryName);
  try {
    var cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
    var uid  = cred.user.uid;

    // Optionally set a display name on the Auth profile
    var displayName = (nome + ' ' + cognome).trim();
    if (displayName) {
      await cred.user.updateProfile({ displayName: displayName });
    }

    // Write Firestore user document using the primary (admin) app
    await firebase.firestore().collection('users').doc(uid).set({
      email:     email,
      nome:      nome     || '',
      cognome:   cognome  || '',
      ruolo:     ruolo    || 'collaboratore',
      attivo:    true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return cred.user;
  } finally {
    // Always clean up the secondary app
    await secondaryApp.delete().catch(function () {});
  }
}


// ============================================================
// UPDATE PROFILE
// ============================================================

/**
 * Updates a user's Firestore document and, when appropriate, their Auth profile.
 * @param {string} uid
 * @param {Object} data   — fields to update (nome, cognome, ruolo, etc.)
 * @returns {Promise<void>}
 */
async function updateUserProfile(uid, data) {
  var updatePayload = Object.assign({}, data, {
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await firebase.firestore().collection('users').doc(uid).update(updatePayload);

  // Keep Auth displayName in sync for the currently logged-in user
  var authUser = firebase.auth().currentUser;
  if (authUser && authUser.uid === uid && (data.nome !== undefined || data.cognome !== undefined)) {
    // Fetch latest values if not supplied together
    var doc = await firebase.firestore().collection('users').doc(uid).get();
    if (doc.exists) {
      var d           = doc.data();
      var displayName = ((d.nome || '') + ' ' + (d.cognome || '')).trim();
      if (displayName) await authUser.updateProfile({ displayName: displayName });
    }
  }

  // Refresh cached data if this is the current user
  if (window.currentUser && window.currentUser.uid === uid) {
    window.currentUserData = Object.assign(window.currentUserData || {}, data);
    if (typeof displayUserInfo === 'function') displayUserInfo(window.currentUser);
  }
}


// ============================================================
// LOGIN PAGE HANDLER
// ============================================================

/**
 * Initialises the login page:
 *  - Redirects already-authenticated users to dashboard
 *  - Handles login form submission
 *  - Handles password-reset form submission
 *  - Toggles between login and reset sections
 *
 * Expected DOM ids on login.html:
 *   #login-section   — wrapper div for the login form
 *   #login-form      — the <form> element
 *   #login-error     — <p> / <span> for inline error messages
 *   #show-reset      — link/button to switch to reset section
 *   #reset-section   — wrapper div for the reset form
 *   #reset-form      — the <form> element for password reset
 *   #reset-msg       — feedback message for reset section
 *   #back-to-login   — link/button to return to login section
 */
function initLoginPage() {
  var loginSection  = document.getElementById('login-section');
  var loginForm     = document.getElementById('login-form');
  var loginError    = document.getElementById('login-error');
  var showResetLink = document.getElementById('show-reset');

  var resetSection  = document.getElementById('reset-section');
  var resetForm     = document.getElementById('reset-form');
  var resetMsg      = document.getElementById('reset-msg');
  var backLink      = document.getElementById('back-to-login');

  // If already authenticated, redirect away from login
  var _authUnsub = firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      _authUnsub();
      window.location.href = 'dashboard.html';
    }
  });

  // ---- Toggle between login / reset views ----

  function showSection(show, hide) {
    if (show) show.style.display = '';
    if (hide) hide.style.display = 'none';
    if (loginError) loginError.textContent = '';
    if (resetMsg)   { resetMsg.textContent = ''; resetMsg.style.color = ''; }
  }

  if (showResetLink) {
    showResetLink.addEventListener('click', function (e) {
      e.preventDefault();
      showSection(resetSection, loginSection);
    });
  }

  if (backLink) {
    backLink.addEventListener('click', function (e) {
      e.preventDefault();
      showSection(loginSection, resetSection);
    });
  }

  // ---- Login form ----

  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (loginError) loginError.textContent = '';

      var emailEl    = loginForm.querySelector('[name="email"]');
      var passwordEl = loginForm.querySelector('[name="password"]');
      var submitBtn  = loginForm.querySelector('[type="submit"]');

      var email    = emailEl    ? emailEl.value.trim()    : '';
      var password = passwordEl ? passwordEl.value        : '';

      if (!email || !password) {
        if (loginError) loginError.textContent = 'Inserisci email e password.';
        return;
      }

      if (typeof setButtonLoading === 'function') setButtonLoading(submitBtn, true);

      try {
        await loginUser(email, password);
        // onAuthStateChanged will fire and redirect — also redirect here as fallback
        window.location.href = 'dashboard.html';
      } catch (err) {
        var msg = typeof handleFirebaseError === 'function'
          ? handleFirebaseError(err)
          : (err.message || 'Errore durante l\'accesso.');
        if (loginError) {
          loginError.textContent = msg;
        } else if (typeof showToast === 'function') {
          showToast(msg, 'error');
        }
      } finally {
        if (typeof setButtonLoading === 'function') setButtonLoading(submitBtn, false);
      }
    });
  }

  // ---- Password reset form ----

  if (resetForm) {
    resetForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (resetMsg) { resetMsg.textContent = ''; resetMsg.style.color = ''; }

      var emailEl   = resetForm.querySelector('[name="email"]');
      var submitBtn = resetForm.querySelector('[type="submit"]');
      var email     = emailEl ? emailEl.value.trim() : '';

      if (!email) {
        if (resetMsg) {
          resetMsg.textContent = 'Inserisci il tuo indirizzo email.';
          resetMsg.style.color = '#dc2626';
        }
        return;
      }

      if (typeof setButtonLoading === 'function') setButtonLoading(submitBtn, true);

      try {
        await sendPasswordReset(email);
        if (resetMsg) {
          resetMsg.textContent = 'Email di recupero inviata. Controlla la tua casella di posta.';
          resetMsg.style.color = '#0f766e';
        } else if (typeof showToast === 'function') {
          showToast('Email di recupero inviata.', 'success');
        }
        if (resetForm) resetForm.reset();
      } catch (err) {
        var msg = typeof handleFirebaseError === 'function'
          ? handleFirebaseError(err)
          : (err.message || 'Errore durante l\'invio dell\'email.');
        if (resetMsg) {
          resetMsg.textContent = msg;
          resetMsg.style.color = '#dc2626';
        } else if (typeof showToast === 'function') {
          showToast(msg, 'error');
        }
      } finally {
        if (typeof setButtonLoading === 'function') setButtonLoading(submitBtn, false);
      }
    });
  }
}


// ============================================================
// INTERNAL HELPERS
// ============================================================

/** Resolves the correct login URL based on the current page depth */
function _authResolveLoginUrl() {
  var path = window.location.pathname;
  if (path.indexOf('/pages/') !== -1) return 'login.html';
  var depth = path.replace(/^\//, '').split('/').filter(Boolean).length;
  return depth >= 2 ? '../pages/login.html' : 'pages/login.html';
}


// ============================================================
// AUTO-INIT LOGIN PAGE
// ============================================================
// Runs initLoginPage() automatically when on the login page.
// Detection: <body data-page="login"> OR page URL contains "login.html".
// ============================================================

(function _autoInitLogin() {
  function _tryInit() {
    var body    = document.querySelector('body');
    var isLogin = (body && body.dataset.page === 'login') ||
                  window.location.pathname.indexOf('login') !== -1;
    if (isLogin && typeof firebase !== 'undefined') initLoginPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _tryInit);
  } else {
    _tryInit();
  }
}());
