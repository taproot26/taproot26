(function () {
  'use strict';

  // Same password hash as /gate — unlocks in-app editing for this session.
  var GATE_HASH = 'd7193ec2f221e36fea3663db6c72fbc1c650aa785795a6d76b9f5d167196ff54';

  var DATA = window.JAPAN_DATA;
  var sectionsById = {};
  DATA.sections.forEach(function (s) { sectionsById[s.id] = s; });

  // ---------- storage helpers ----------
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  // ---------- pure logic (exposed for tests) ----------
  function mergeRules(seed, edits, user, deleted) {
    return seed
      .map(function (r) { return Object.assign({}, r, edits[r.id] || {}); })
      .concat(user)
      .filter(function (r) { return deleted.indexOf(r.id) === -1; });
  }
  function normalizeAnswer(s) {
    return (s || '').toLowerCase().replace(/\s+/g, '').replace(/[。.、,!！?？]/g, '').trim();
  }
  function checkAnswer(input, answers) {
    var n = normalizeAnswer(input);
    if (!n) return false;
    return answers.some(function (a) { return normalizeAnswer(a) === n; });
  }
  window.JapanLogic = { mergeRules: mergeRules, normalizeAnswer: normalizeAnswer, checkAnswer: checkAnswer };

  function getAllRules() {
    return mergeRules(DATA.rules, load('jp_edits', {}), load('jp_user', []), load('jp_deleted', []));
  }

  // ---------- DOM refs ----------
  var $ = function (id) { return document.getElementById(id); };
  var grid = $('jpGrid');
  var filters = $('jpFilters');
  var searchInput = $('jpSearchInput');
  var overlay = $('jpOverlay');

  var activeSection = 'all';
  var query = '';

  // ---------- reference rendering ----------
  function renderFilters() {
    var html = '<button class="jp-chip' + (activeSection === 'all' ? ' active' : '') + '" data-sec="all">All</button>';
    DATA.sections.forEach(function (s) {
      html += '<button class="jp-chip' + (activeSection === s.id ? ' active' : '') + '" data-sec="' + s.id + '">' +
        '<span class="jp-dot" style="background:' + s.color + '"></span>' + esc(s.label) + '</button>';
    });
    filters.innerHTML = html;
    Array.prototype.forEach.call(filters.querySelectorAll('.jp-chip'), function (chip) {
      chip.addEventListener('click', function () { activeSection = chip.getAttribute('data-sec'); renderFilters(); renderCards(); });
    });
  }

  function matches(rule) {
    if (activeSection !== 'all' && rule.section !== activeSection) return false;
    if (!query) return true;
    var hay = [rule.pattern, rule.gloss, rule.example, rule.romaji, rule.translation, rule.note].join(' ').toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function renderCards() {
    var rules = getAllRules().filter(matches);
    if (!rules.length) { grid.innerHTML = '<div class="jp-empty">No rules match.</div>'; return; }
    grid.innerHTML = rules.map(function (r) {
      var sec = sectionsById[r.section] || { color: 'var(--card-border)' };
      return '<div class="jp-card" data-id="' + esc(r.id) + '">' +
        '<div class="jp-bar" style="background:' + sec.color + '"></div>' +
        '<div class="jp-body">' +
          '<div class="jp-cardtop">' +
            '<div class="jp-pattern">' + esc(r.pattern) + '</div>' +
            '<button class="jp-edit" data-id="' + esc(r.id) + '" aria-label="Edit">✎</button>' +
          '</div>' +
          '<div class="jp-gloss">' + esc(r.gloss) + '</div>' +
          '<div class="jp-example">' + esc(r.example) + '</div>' +
          '<div class="jp-romaji">' + esc(r.romaji) + '</div>' +
          '<div class="jp-translation">' + esc(r.translation) + '</div>' +
          (r.note ? '<div class="jp-note">' + esc(r.note) + '</div>' : '') +
        '</div></div>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('.jp-card'), function (card) {
      card.addEventListener('click', function () { openDetailModal(card.getAttribute('data-id')); });
    });
    Array.prototype.forEach.call(grid.querySelectorAll('.jp-edit'), function (btn) {
      btn.addEventListener('click', function (e) { e.stopPropagation(); openRuleModal(btn.getAttribute('data-id')); });
    });
  }

  // ---------- detail modal (examples) ----------
  function openDetailModal(id) {
    var r = getAllRules().filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var sec = sectionsById[r.section] || { color: 'var(--card-border)', label: '' };
    var items = [{ jp: r.example, romaji: r.romaji, en: r.translation }].concat(r.examples || []);
    var rows = items.map(function (ex) {
      return '<div class="jp-ex">' +
        '<div class="jp-ex-jp">' + esc(ex.jp) + '</div>' +
        '<div class="jp-ex-romaji">' + esc(ex.romaji) + '</div>' +
        (ex.en ? '<div class="jp-ex-en">' + esc(ex.en) + '</div>' : '') +
      '</div>';
    }).join('');
    overlay.innerHTML =
      '<div class="jp-modal jp-detail">' +
        '<div class="jp-detail-head">' +
          '<div>' +
            '<div class="jp-detail-tag"><span class="jp-dot" style="background:' + sec.color + '"></span>' + esc(sec.label) + '</div>' +
            '<div class="jp-detail-pattern">' + esc(r.pattern) + '</div>' +
            '<div class="jp-detail-gloss">' + esc(r.gloss) + '</div>' +
          '</div>' +
          '<button class="jp-close" data-close aria-label="Close">×</button>' +
        '</div>' +
        (r.note ? '<div class="jp-detail-note">' + esc(r.note) + '</div>' : '') +
        '<div class="jp-ex-list">' + rows + '</div>' +
      '</div>';
    overlay.classList.add('open');
    wireClose();
  }

  // ---------- tabs ----------
  Array.prototype.forEach.call(document.querySelectorAll('.jp-tab'), function (tab) {
    if (tab.disabled) return;
    tab.addEventListener('click', function () {
      var view = tab.getAttribute('data-view');
      document.querySelectorAll('.jp-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
      document.querySelectorAll('.jp-view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
      if (view === 'drills') nextDrill();
      if (view === 'words') $('jpWordSearch').focus();
    });
  });

  // ---------- search ----------
  searchInput.addEventListener('input', function () { query = searchInput.value.toLowerCase().trim(); renderCards(); });
  $('jpWordSearch').addEventListener('input', function () { wordQuery = $('jpWordSearch').value.toLowerCase().trim(); renderWords(); });

  // ---------- edit unlock ----------
  function isUnlocked() { return sessionStorage.getItem('jp_edit') === '1'; }
  function applyEditState() { document.body.classList.toggle('jp-editing', isUnlocked()); }

  $('jpAddBtn').addEventListener('click', function () {
    if (isUnlocked()) openRuleModal(null); else openUnlockModal();
  });

  function openUnlockModal(after) {
    overlay.innerHTML =
      '<div class="jp-modal"><h3>Unlock editing</h3>' +
      '<div class="jp-field"><label>Password</label><input type="password" id="jpPass" autofocus></div>' +
      '<div class="jp-modal-error" id="jpModalErr">Nope.</div>' +
      '<div class="jp-modal-actions">' +
        '<button class="jp-btn" data-close>Cancel</button>' +
        '<button class="jp-btn jp-primary" id="jpUnlock">Unlock</button>' +
      '</div></div>';
    overlay.classList.add('open');
    wireClose();
    var tryUnlock = function () {
      var v = $('jpPass').value;
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)).then(function (buf) {
        var hex = Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        if (hex === GATE_HASH) {
          sessionStorage.setItem('jp_edit', '1');
          sessionStorage.setItem('jp_pw', v);
          applyEditState(); closeOverlay();
          if (after) after(); else openRuleModal(null);
        }
        else { $('jpModalErr').style.display = 'block'; }
      });
    };
    $('jpUnlock').addEventListener('click', tryUnlock);
    $('jpPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryUnlock(); });
  }

  // ---------- add / edit rule ----------
  function openRuleModal(id) {
    var rule = id ? getAllRules().filter(function (r) { return r.id === id; })[0] : null;
    var secOpts = DATA.sections.map(function (s) {
      return '<option value="' + s.id + '"' + (rule && rule.section === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>';
    }).join('');
    overlay.innerHTML =
      '<div class="jp-modal"><h3>' + (rule ? 'Edit rule' : 'Add rule') + '</h3>' +
      field('Section', '<select id="f_section">' + secOpts + '</select>') +
      field('Pattern', inp('f_pattern', rule && rule.pattern)) +
      field('Gloss (short meaning)', inp('f_gloss', rule && rule.gloss)) +
      field('Example (JP)', inp('f_example', rule && rule.example)) +
      field('Romaji', inp('f_romaji', rule && rule.romaji)) +
      field('Translation', inp('f_translation', rule && rule.translation)) +
      field('Note (optional)', inp('f_note', rule && rule.note)) +
      '<div class="jp-modal-error" id="jpModalErr">Fill in pattern, example, and romaji.</div>' +
      '<div class="jp-modal-actions">' +
        (rule ? '<button class="jp-btn" id="jpDelete" style="margin-right:auto;color:#D85A30">Delete</button>' : '') +
        '<button class="jp-btn" data-close>Cancel</button>' +
        '<button class="jp-btn jp-primary" id="jpSave">Save</button>' +
      '</div></div>';
    overlay.classList.add('open');
    wireClose();
    $('jpSave').addEventListener('click', function () { saveFromForm(rule); });
    if (rule) $('jpDelete').addEventListener('click', function () { deleteRule(rule.id); });
  }

  function saveFromForm(rule) {
    var r = {
      section: $('f_section').value,
      pattern: val('f_pattern'), gloss: val('f_gloss'), example: val('f_example'),
      romaji: val('f_romaji'), translation: val('f_translation'), note: val('f_note'),
    };
    if (!r.pattern || !r.example || !r.romaji) { $('jpModalErr').style.display = 'block'; return; }

    var seedIds = DATA.rules.map(function (x) { return x.id; });
    if (!rule) {
      var user = load('jp_user', []);
      r.id = 'u_' + Date.now();
      user.push(r); save('jp_user', user);
    } else if (seedIds.indexOf(rule.id) !== -1) {
      var edits = load('jp_edits', {}); edits[rule.id] = r; save('jp_edits', edits);
    } else {
      var u = load('jp_user', []);
      for (var i = 0; i < u.length; i++) { if (u[i].id === rule.id) { r.id = rule.id; u[i] = r; } }
      save('jp_user', u);
    }
    closeOverlay(); renderCards();
  }

  function deleteRule(id) {
    var seedIds = DATA.rules.map(function (x) { return x.id; });
    if (seedIds.indexOf(id) !== -1) {
      var del = load('jp_deleted', []); if (del.indexOf(id) === -1) del.push(id); save('jp_deleted', del);
    } else {
      save('jp_user', load('jp_user', []).filter(function (r) { return r.id !== id; }));
    }
    closeOverlay(); renderCards();
  }

  // ---------- drills ----------
  var current = null, done = 0, correct = 0, answered = false;
  function nextDrill() {
    var d = DATA.drills[Math.floor(Math.random() * DATA.drills.length)];
    current = d;
    answered = false;
    var sec = sectionsById[d.section] || { color: 'var(--card-border)', label: '' };
    $('view-drills').querySelector('.jp-drill').innerHTML =
      '<div class="jp-drill-tag"><span class="jp-dot" style="background:' + sec.color + '"></span>' + esc(sec.label) + '</div>' +
      '<div class="jp-drill-target">Give the ' + esc(d.target) + '</div>' +
      '<div class="jp-drill-verb">' + esc(d.verb) + '</div>' +
      '<div class="jp-drill-meaning">' + esc(d.verbRomaji) + ' · ' + esc(d.meaning) + '</div>' +
      '<div class="jp-drill-row"><input id="jpDrillInput" placeholder="type kana or romaji" autocomplete="off">' +
        '<button class="jp-btn jp-primary" id="jpAction">Check</button></div>' +
      '<div class="jp-drill-feedback" id="jpDrillFeedback"></div>' +
      '<div class="jp-drill-progress">' + correct + ' / ' + done + ' correct</div>';
    var input = $('jpDrillInput');
    input.focus();
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); handleAction(); } });
    $('jpAction').addEventListener('click', handleAction);
    renderDrillLog();
  }
  // Drill history. Always saved in this browser first. "Sync" uploads whatever
  // hasn't been uploaded yet to the database (needs your password), in one batch.
  var logMsg = '';
  // A local copy has no API of its own, so it syncs up to the live site.
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'https://taproot.love' : '';

  function getLog() { return load('jp_drill_log', []); }

  function logAttempt(entry) {
    var log = getLog();
    log.push(Object.assign({ t: Date.now(), synced: false }, entry));
    save('jp_drill_log', log.slice(-500));
    renderDrillLog();
  }

  function syncLog() {
    if (!sessionStorage.getItem('jp_pw')) { openUnlockModal(syncLog); return; }
    var log = getLog();
    var pending = log.filter(function (e) { return !e.synced; });
    if (!pending.length) return;
    var batch = pending.slice(0, 200);
    logMsg = 'Syncing…'; renderDrillLog();
    fetch(API + '/api/japan/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: sessionStorage.getItem('jp_pw'), entries: batch }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status }; });
    }).then(function (r) {
      if (!r.ok) {
        if (r.status === 401) sessionStorage.removeItem('jp_pw');
        logMsg = r.status === 401 ? 'Wrong password. Try Sync again.' : 'Couldn\'t sync. Your attempts are still saved here.';
        renderDrillLog(); return;
      }
      var sent = {};
      batch.forEach(function (e) { sent[e.t] = true; });
      save('jp_drill_log', getLog().map(function (e) { return sent[e.t] ? Object.assign(e, { synced: true }) : e; }));
      logMsg = 'Synced ' + batch.length + '.';
      renderDrillLog();
      if (pending.length > batch.length) syncLog();
    }).catch(function () {
      logMsg = 'Couldn\'t sync (offline?). Your attempts are still saved here.';
      renderDrillLog();
    });
  }

  function renderDrillLog() {
    var el = $('jpDrillLog');
    var log = getLog().slice().reverse();
    var right = log.filter(function (e) { return e.ok; }).length;
    var pending = log.filter(function (e) { return !e.synced; }).length;
    var rows = log.slice(0, 20).map(function (e) {
      return '<div class="jp-log-row ' + (e.ok ? 'ok' : 'no') + '">' +
        '<span class="jp-log-mark">' + (e.ok ? '✓' : '✕') + '</span>' +
        '<span class="jp-log-q">' + esc(e.verb) + ' → ' + esc(e.target) + '</span>' +
        '<span class="jp-log-a">' + (e.ok ? esc(e.typed) : esc(e.typed) + ' (answer: ' + esc(e.answer) + ')') + '</span>' +
      '</div>';
    }).join('');
    var summary = log.length ? right + ' / ' + log.length + ' correct (' + Math.round(100 * right / log.length) + '%)' : 'no attempts yet';
    el.innerHTML =
      (logMsg ? '<div class="jp-log-msg">' + esc(logMsg) + '</div>' : '') +
      '<div class="jp-log-head"><span>History · ' + summary + (log.length ? ' · ' + pending + ' not synced' : '') + '</span>' +
      '<span>' + (pending ? '<button class="jp-log-clear" id="jpLogSync">Sync ' + pending + '</button> ' : '') +
      (log.length ? '<button class="jp-log-clear" id="jpLogClear">Clear</button>' : '') + '</span></div>' + rows;
    if (pending) $('jpLogSync').addEventListener('click', syncLog);
    if (log.length) $('jpLogClear').addEventListener('click', function () {
      if (!confirm('Clear your drill history on this browser? Anything already synced stays in the database.')) return;
      save('jp_drill_log', []); logMsg = ''; renderDrillLog();
    });
  }

  // One handler, state-driven: first call checks, second goes to the next drill.
  function handleAction() {
    if (answered) { nextDrill(); return; }
    var input = $('jpDrillInput');
    var fb = $('jpDrillFeedback');
    if (!input.value.trim()) { fb.innerHTML = '<div class="jp-drill-no">Type an answer first.</div>'; return; }
    answered = true;
    done++;
    var ok = checkAnswer(input.value, current.answers);
    if (ok) correct++;
    logAttempt({ verb: current.verb, target: current.target, section: current.section, typed: input.value.trim(), answer: current.answers[0], ok: ok });
    input.setAttribute('readonly', 'readonly');
    var ans = current.answers[0], romaji = current.answers[current.answers.length - 1];
    fb.innerHTML =
      (ok ? '<div class="jp-drill-ok">✓ <span class="jp-drill-answer">' + esc(ans) + '</span> <span style="font-style:italic;opacity:.7">' + esc(romaji) + '</span></div>'
          : '<div class="jp-drill-no">✕ answer: <span class="jp-drill-answer">' + esc(ans) + '</span> <span style="font-style:italic;opacity:.7">' + esc(romaji) + '</span></div>') +
      '<div class="jp-drill-rule">rule: ' + esc(current.rule) + '</div>';
    var btn = $('jpAction');
    btn.textContent = 'Next →';
    document.querySelector('.jp-drill-progress').textContent = correct + ' / ' + done + ' correct';
  }

  // ---------- word bank ----------
  var WORD_TYPES = [
    { id: 'verb', label: 'Verbs' }, { id: 'adj', label: 'Adjectives' }, { id: 'noun', label: 'Nouns' },
    { id: 'adverb', label: 'Adverbs' }, { id: 'phrase', label: 'Phrases' }, { id: 'pronoun', label: 'Pronouns' },
    { id: 'slang', label: 'Slang' },
  ];
  var wordQuery = '', wordType = 'all', wordStatus = 'all';
  var WORD_STATUS = [{ id: 'all', label: 'All' }, { id: 'learning', label: 'Learning' }, { id: 'known', label: 'Known' }];
  var known = {};
  (load('jp_known', [])).forEach(function (k) { known[k] = true; });
  function saveKnown() { save('jp_known', Object.keys(known).filter(function (k) { return known[k]; })); }

  function renderWordFilters() {
    var el = $('jpWordFilters');
    var html = '<button class="jp-chip' + (wordType === 'all' ? ' active' : '') + '" data-t="all">All</button>';
    WORD_TYPES.forEach(function (t) {
      html += '<button class="jp-chip' + (wordType === t.id ? ' active' : '') + '" data-t="' + t.id + '">' + esc(t.label) + '</button>';
    });
    el.innerHTML = html;
    Array.prototype.forEach.call(el.querySelectorAll('.jp-chip'), function (chip) {
      chip.addEventListener('click', function () { wordType = chip.getAttribute('data-t'); renderWordFilters(); renderWords(); });
    });

    var se = $('jpWordStatus');
    se.innerHTML = WORD_STATUS.map(function (s) {
      return '<button class="jp-chip' + (wordStatus === s.id ? ' active' : '') + '" data-s="' + s.id + '">' + esc(s.label) + '</button>';
    }).join('');
    Array.prototype.forEach.call(se.querySelectorAll('.jp-chip'), function (chip) {
      chip.addEventListener('click', function () { wordStatus = chip.getAttribute('data-s'); renderWordFilters(); renderWords(); });
    });
  }

  function renderWords() {
    var all = window.JAPAN_WORDS || [];
    var knownCount = all.filter(function (w) { return known[w.jp]; }).length;
    var words = all.filter(function (w) {
      if (wordType !== 'all' && w.type !== wordType) return false;
      if (wordStatus === 'known' && !known[w.jp]) return false;
      if (wordStatus === 'learning' && known[w.jp]) return false;
      if (!wordQuery) return true;
      return [w.jp, w.romaji, w.meaning].join(' ').toLowerCase().indexOf(wordQuery) !== -1;
    });
    $('jpWordCount').textContent = words.length + (words.length === 1 ? ' word' : ' words') + ' · ' + knownCount + ' known (tap to toggle)';
    var list = $('jpWordList');
    if (!words.length) { list.innerHTML = '<div class="jp-empty">No words match.</div>'; return; }
    list.innerHTML = words.map(function (w) {
      return '<div class="jp-word' + (known[w.jp] ? ' known' : '') + '" data-jp="' + esc(w.jp) + '">' +
        '<div class="jp-word-text">' +
          '<span class="jp-word-jp">' + esc(w.jp) + '</span>' +
          '<span class="jp-word-romaji">' + esc(w.romaji) + '</span>' +
          '<span class="jp-word-meaning">' + esc(w.meaning) + '</span>' +
        '</div>' +
        '<div class="jp-word-right">' +
          '<span class="jp-word-type">' + esc(w.type) + '</span>' +
          '<input type="checkbox" class="jp-word-box" aria-label="known"' + (known[w.jp] ? ' checked' : '') + '>' +
        '</div>' +
      '</div>';
    }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('.jp-word-box'), function (box) {
      box.addEventListener('change', function () {
        var jp = box.closest('.jp-word').getAttribute('data-jp');
        known[jp] = box.checked;
        saveKnown();
        renderWords();
      });
    });
  }

  // ---------- small helpers ----------
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function field(label, inner) { return '<div class="jp-field"><label>' + esc(label) + '</label>' + inner + '</div>'; }
  function inp(id, v) { return '<input id="' + id + '" value="' + esc(v) + '">'; }
  function val(id) { return $(id).value.trim(); }
  function wireClose() {
    Array.prototype.forEach.call(overlay.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', closeOverlay); });
  }
  function closeOverlay() { overlay.classList.remove('open'); overlay.innerHTML = ''; }

  // ---------- init ----------
  // Close overlay on backdrop click or Escape.
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeOverlay(); });

  applyEditState();
  renderFilters();
  renderCards();
  renderWordFilters();
  renderWords();
})();
