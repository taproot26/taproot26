(function () {
  if (sessionStorage.getItem('gateOk') !== '1') { location.href = '/gate/'; return; }
  var client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  var titleEl = document.getElementById('post-title');
  var catEl = document.getElementById('post-category');
  var slugEl = document.getElementById('slug-preview');
  var bodyEl = document.getElementById('post-body');
  var passEl = document.getElementById('publish-pass');
  var errEl = document.getElementById('write-error');
  var okEl = document.getElementById('write-success');

  titleEl.addEventListener('input', function () {
    slugEl.value = PostUtils.slugify(titleEl.value);
  });

  document.getElementById('write-form').addEventListener('submit', function (e) {
    e.preventDefault();
    errEl.style.display = 'none';
    okEl.style.display = 'none';
    var slug = PostUtils.slugify(titleEl.value);
    if (!slug || !bodyEl.value.trim()) {
      errEl.textContent = 'Title and body are required.';
      errEl.style.display = 'block';
      return;
    }
    client.rpc('publish_post', {
      p_secret: passEl.value,
      p_title: titleEl.value.trim(),
      p_slug: slug,
      p_category: catEl.value,
      p_body: bodyEl.value
    }).then(function (res) {
      passEl.value = '';
      if (res.error) {
        var m = res.error.message || '';
        errEl.textContent = m.indexOf('invalid secret') !== -1 ? 'Wrong publish password.'
          : m.indexOf('duplicate key') !== -1 ? 'A post with this slug already exists.'
          : "Couldn't publish, try again.";
        errEl.style.display = 'block';
        return;
      }
      okEl.innerHTML = 'Published: <a href="/p/' + slug + '">/p/' + slug + '</a>';
      okEl.style.display = 'block';
      titleEl.value = '';
      bodyEl.value = '';
      slugEl.value = '';
    });
  });
})();
