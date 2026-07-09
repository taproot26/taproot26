(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PostUtils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  var ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) { return ESCAPE_MAP[c]; });
  }

  function slugify(title) {
    return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function renderParagraphs(body) {
    return String(body).split(/\n\s*\n/).map(function (block) {
      return block.trim();
    }).filter(Boolean).map(function (block) {
      return '<p>' + escapeHtml(block).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function formatPostDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }

  return { escapeHtml: escapeHtml, slugify: slugify, renderParagraphs: renderParagraphs, formatPostDate: formatPostDate };
});
