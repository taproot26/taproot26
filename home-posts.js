(function () {
  var door = document.getElementById('corner-door');
  if (door) door.addEventListener('click', function () { location.href = '/gate/'; });

  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return;
  var client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  var lists = {};
  document.querySelectorAll('.category').forEach(function (sec) {
    var titleEl = sec.querySelector('.category-title');
    var listEl = sec.querySelector('.list');
    if (titleEl && listEl) lists[titleEl.textContent.trim().toLowerCase()] = listEl;
  });

  client.from('posts').select('slug, title, category, created_at')
    .order('created_at', { ascending: false })
    .then(function (res) {
      if (res.error || !res.data) return;
      res.data.forEach(function (post) {
        var list = lists[post.category];
        if (!list) return;
        var li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = '<a href="/p/' + post.slug + '">' + PostUtils.escapeHtml(post.title) + '</a>' +
          '<span class="article-date">' + PostUtils.formatPostDate(post.created_at) + '</span>';
        // Insert in date order among the existing (static) entries.
        var when = new Date(post.created_at).getTime();
        var items = Array.prototype.slice.call(list.querySelectorAll('.list-item'));
        var before = null;
        for (var i = 0; i < items.length; i++) {
          var dateEl = items[i].querySelector('.article-date');
          var d = dateEl ? Date.parse(dateEl.textContent) : NaN;
          if (!isNaN(d) && d < when) { before = items[i]; break; }
        }
        list.insertBefore(li, before);
      });
    });
})();
