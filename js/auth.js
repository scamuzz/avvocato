// ============================================================
// AUTH.JS — protezione pagine, logout, display utente
// ============================================================

function logoutUser() {
  auth.signOut()
    .then(function () { window.location.href = '../index.html'; })
    .catch(function (err) { console.error('Errore logout:', err); });
}

document.addEventListener('DOMContentLoaded', function () {
  var isProtected = document.body.getAttribute('data-protected') === 'true';
  if (!isProtected) return;

  // Show brief loading overlay while auth resolves
  var mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.style.visibility = 'hidden';
    mainContent.style.opacity = '0';
  }

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = '../index.html';
      return;
    }

    // Reveal content
    if (mainContent) {
      mainContent.style.visibility = '';
      mainContent.style.opacity = '';
      mainContent.style.transition = 'opacity 0.2s';
      requestAnimationFrame(function () { mainContent.style.opacity = '1'; });
    }

    // Display user name — sidebar and navbar
    var displayName = user.displayName || user.email || '';
    var initials = displayName
      ? displayName.split(/[\s@]+/).filter(Boolean).slice(0, 2).map(function (p) { return p[0].toUpperCase(); }).join('')
      : '?';

    var sidebarNameEl = document.getElementById('userDisplayName');
    if (sidebarNameEl) sidebarNameEl.textContent = displayName;

    var sidebarAvatarEl = document.getElementById('userAvatar');
    if (sidebarAvatarEl) sidebarAvatarEl.textContent = initials;

    var navNameEl = document.getElementById('navUserName');
    if (navNameEl) navNameEl.textContent = displayName;

    var navAvatarEl = document.getElementById('navUserAvatar');
    if (navAvatarEl) navAvatarEl.textContent = initials;

    // Highlight active sidebar link
    var currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-nav a').forEach(function (a) {
      a.classList.remove('active');
      var href = a.getAttribute('href') || '';
      if (href === currentPage || href.split('?')[0] === currentPage) {
        a.classList.add('active');
      }
    });
  });

  // Sidebar toggle (mobile)
  var toggle  = document.getElementById('sidebarToggle');
  var sidebar = document.getElementById('sidebar');
  var main    = document.querySelector('.main-content');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      if (main) main.classList.toggle('sidebar-open');
    });
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function (e) {
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          e.target !== toggle) {
        sidebar.classList.remove('open');
        if (main) main.classList.remove('sidebar-open');
      }
    });
  }
});
