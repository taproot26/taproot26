(function () {
  var m = location.pathname.match(/^\/p\/([a-z0-9-]+)\/?$/i);
  var slug = m && m[1];
  var errEl = document.getElementById('post-error');
  function fail(msg) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
  if (!slug) { fail('Post not found.'); return; }

  var client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  client.from('posts').select('title, body, created_at').eq('slug', slug).maybeSingle()
    .then(function (res) {
      if (res.error) { fail("Couldn't load post, try again later."); return; }
      if (!res.data) { fail('Post not found.'); return; }
      document.title = res.data.title + " - Taproot's Blog";
      document.getElementById('post-title').textContent = res.data.title;
      document.getElementById('post-date').textContent = PostUtils.formatPostDate(res.data.created_at);
      document.getElementById('post-content').innerHTML = PostUtils.renderParagraphs(res.data.body);
      // Feedback loads only after the slug is known, so it queries the right thread.
      var fb = document.getElementById('feedback');
      fb.setAttribute('data-slug', slug);
      var s = document.createElement('script');
      s.src = '/feedback.js';
      document.body.appendChild(s);
    });
})();
