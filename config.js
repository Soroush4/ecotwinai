(function() {
  var hostname = window.location.hostname;
  var envBase = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : null;
  var defaultProd = 'https://ecotwin-energyvis-api.onrender.com';
  var defaultLocal = 'http://localhost:3000';

  // Optional overrides: URL param ?api=... or localStorage
  var url = new URL(window.location.href);
  var paramBase = url.searchParams.get('api');
  var storedBase = null;
  try { storedBase = window.localStorage.getItem('API_BASE_URL') || null; } catch (_) {}

  // Persist param override
  if (paramBase) {
    try { window.localStorage.setItem('API_BASE_URL', paramBase); } catch (_) {}
  }

  // Auto-detect localhost for development
  var isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';

  // Priority: explicit > param > stored > localhost detection > DEFAULT TO PRODUCTION
  var base = envBase || paramBase || storedBase || (isLocalhost ? defaultLocal : defaultProd);
  window.API_BASE_URL = base;
  console.info('[Config] API_BASE_URL =', window.API_BASE_URL);
})();
