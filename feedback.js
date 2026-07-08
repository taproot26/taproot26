(function () {
  var container = document.getElementById('feedback');
  if (!container) return;

  var slug = container.getAttribute('data-slug');
  var client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  var listEl = document.getElementById('feedback-list');
  var formEl = document.getElementById('feedback-form');
  var nameEl = document.getElementById('feedback-name');
  var bodyEl = document.getElementById('feedback-body');
  var errorEl = document.getElementById('feedback-error');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  function renderList(items) {
    if (!items.length) {
      listEl.innerHTML = '<p class="feedback-empty">No feedback yet — be the first.</p>';
      return;
    }
    listEl.innerHTML = items.map(function (item) {
      return FeedbackRender.renderFeedbackItem(item);
    }).join('');
  }

  function loadFeedback() {
    client
      .from('feedback')
      .select('name, body, created_at')
      .eq('post_slug', slug)
      .order('created_at', { ascending: true })
      .then(function (res) {
        if (res.error) {
          showError("Couldn't load feedback, try again later.");
          return;
        }
        renderList(res.data);
      });
  }

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    var body = bodyEl.value.trim();
    if (!body) {
      showError('Feedback cannot be empty.');
      return;
    }
    var name = nameEl.value.trim() || null;
    client
      .from('feedback')
      .insert([{ post_slug: slug, name: name, body: body }])
      .select()
      .then(function (res) {
        if (res.error || !res.data || !res.data[0]) {
          showError("Couldn't post feedback, try again.");
          return;
        }
        var emptyMsg = listEl.querySelector('.feedback-empty');
        if (emptyMsg) listEl.innerHTML = '';
        listEl.insertAdjacentHTML('beforeend', FeedbackRender.renderFeedbackItem(res.data[0]));
        bodyEl.value = '';
        nameEl.value = '';
      });
  });

  loadFeedback();
})();
