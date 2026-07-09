(function () {
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return;
  var client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  // Derive a slug from the current path: "/" -> "home", "/dystopia-utopia/" -> "dystopia-utopia"
  function slugFromPath() {
    var p = window.location.pathname.replace(/\/+$/, '');
    if (p === '') return 'home';
    var parts = p.split('/');
    return parts[parts.length - 1] || 'home';
  }

  // Fire-and-forget insert into the events table; never throws, never blocks the page.
  function track(eventType, meta) {
    try {
      var slug = (meta && meta.post_slug) || slugFromPath();
      client
        .from('events')
        .insert([{ event_type: eventType, post_slug: slug, meta: meta || null }])
        .then(function () {}, function () {});
    } catch (e) { /* analytics must never break the page */ }
  }

  window.trackEvent = track;

  // Page view on every load.
  track('page_view', { post_slug: slugFromPath() });

  // Track clicks on internal post links (mainly from the index page).
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('http') === 0 || href.indexOf('mailto:') === 0) return;
    // Internal post links look like "/slug" (static) or "/p/slug" (dynamic).
    if (/^\/?(p\/)?[a-z0-9-]+\/?$/i.test(href)) {
      var target = href.replace(/^\//, '').replace(/^p\//, '').replace(/\/$/, '');
      track('post_click', { post_slug: target, from: slugFromPath() });
    }
  });
})();
