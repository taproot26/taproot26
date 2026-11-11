(function () {
  if (sessionStorage.getItem('gateOk') !== '1') { location.href = '/gate/'; return; }
  var client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  var $ = function (id) { return document.getElementById(id); };
  var titleEl = $('post-title'), catEl = $('post-category'), slugEl = $('slug-preview');
  var passEl = $('publish-pass'), errEl = $('write-error'), okEl = $('write-success');
  var blocksEl = $('blocks'), fileEl = $('img-file');
  var blocks = [{ t: 'text', v: '' }];
  var insertAt = 0;

  function showError(msg) { errEl.textContent = msg; errEl.style.display = msg ? 'block' : 'none'; }

  function body() {
    return blocks.map(function (b) {
      return b.t === 'img' ? '![' + b.alt.replace(/[\[\]]/g, '') + '](' + b.url + ')' : b.v.trim();
    }).filter(Boolean).join('\n\n');
  }

  function updatePreview() {
    slugEl.value = PostUtils.slugify(titleEl.value);
    $('pv-title').textContent = titleEl.value;
    $('pv-body').innerHTML = PostUtils.renderParagraphs(body());
  }

  function slot(i) {
    var d = document.createElement('div');
    d.className = 'write-slot';
    d.innerHTML = '<button type="button" data-a="text">+ Text</button><button type="button" data-a="img">+ Image</button>';
    d.addEventListener('click', function (e) {
      var a = e.target.getAttribute('data-a');
      if (a === 'text') { blocks.splice(i, 0, { t: 'text', v: '' }); render(i); }
      if (a === 'img') { insertAt = i; fileEl.click(); }
    });
    return d;
  }

  function render(focusIdx) {
    blocksEl.innerHTML = '';
    blocks.forEach(function (b, i) {
      blocksEl.appendChild(slot(i));
      var row = document.createElement('div');
      row.className = 'write-block';
      if (b.t === 'text') {
        var ta = document.createElement('textarea');
        ta.className = 'feedback-textarea';
        ta.placeholder = 'Write. Blank line = new paragraph.';
        ta.value = b.v;
        ta.addEventListener('input', function () { b.v = ta.value; updatePreview(); });
        row.appendChild(ta);
        if (i === focusIdx) setTimeout(function () { ta.focus(); }, 0);
      } else {
        var img = document.createElement('img');
        img.src = b.url;
        var alt = document.createElement('input');
        alt.className = 'feedback-input';
        alt.placeholder = 'Caption / alt text';
        alt.value = b.alt;
        alt.addEventListener('input', function () { b.alt = alt.value; updatePreview(); });
        row.appendChild(img);
        row.appendChild(alt);
      }
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'write-remove';
      rm.textContent = '×';
      rm.setAttribute('aria-label', 'Remove block');
      rm.addEventListener('click', function () {
        blocks.splice(i, 1);
        if (!blocks.length) blocks.push({ t: 'text', v: '' });
        render();
      });
      row.appendChild(rm);
      blocksEl.appendChild(row);
    });
    blocksEl.appendChild(slot(blocks.length));
    updatePreview();
  }

  fileEl.addEventListener('change', function () {
    var f = fileEl.files[0];
    fileEl.value = '';
    if (!f) return;
    showError('');
    var path = Date.now() + '-' + f.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    client.storage.from('post-images').upload(path, f, { contentType: f.type }).then(function (res) {
      if (res.error) { showError("Couldn't upload image, try again."); return; }
      var url = client.storage.from('post-images').getPublicUrl(path).data.publicUrl;
      blocks.splice(insertAt, 0, { t: 'img', url: url, alt: '' });
      render();
    });
  });

  $('copy-x').addEventListener('click', function () {
    var html = '<h1>' + PostUtils.escapeHtml(titleEl.value) + '</h1>' + PostUtils.renderParagraphs(body());
    var text = titleEl.value + '\n\n' + PostUtils.toPlainText(body());
    var btn = $('copy-x');
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy for X'; }, 1500); };
    var fallback = function () { navigator.clipboard.writeText(text).then(done); };
    if (window.ClipboardItem) {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })]).then(done, fallback);
    } else fallback();
  });

  titleEl.addEventListener('input', updatePreview);

  $('write-form').addEventListener('submit', function (e) {
    e.preventDefault();
    okEl.style.display = 'none';
    showError('');
    var slug = PostUtils.slugify(titleEl.value);
    var text = body();
    if (!slug || !text) { showError('Title and body are required.'); return; }
    client.rpc('publish_post', {
      p_secret: passEl.value,
      p_title: titleEl.value.trim(),
      p_slug: slug,
      p_category: catEl.value,
      p_body: text
    }).then(function (res) {
      passEl.value = '';
      if (res.error) {
        var m = res.error.message || '';
        showError(m.indexOf('invalid secret') !== -1 ? 'Wrong publish password.'
          : m.indexOf('duplicate key') !== -1 ? 'A post with this slug already exists.'
          : "Couldn't publish, try again.");
        return;
      }
      okEl.innerHTML = 'Published: <a href="/p/' + slug + '">/p/' + slug + '</a>';
      okEl.style.display = 'block';
      titleEl.value = '';
      blocks = [{ t: 'text', v: '' }];
      render();
    });
  });

  render();
})();
