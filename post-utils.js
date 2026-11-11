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

  var IMAGE_LINE = /^!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)$/;

  function blocks(body) {
    return String(body).split(/\n\s*\n/).map(function (b) { return b.trim(); }).filter(Boolean);
  }

  function renderParagraphs(body) {
    return blocks(body).map(function (block) {
      var img = block.match(IMAGE_LINE);
      if (img) {
        var alt = escapeHtml(img[1]);
        return '<figure><img src="' + escapeHtml(img[2]) + '" alt="' + alt + '" loading="lazy">' +
          (alt ? '<figcaption>' + alt + '</figcaption>' : '') + '</figure>';
      }
      return '<p>' + escapeHtml(block).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function toPlainText(body) {
    return blocks(body).map(function (block) {
      var img = block.match(IMAGE_LINE);
      return img ? '[image: ' + img[2] + ']' : block;
    }).join('\n\n');
  }

  function formatPostDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }

  return { escapeHtml: escapeHtml, slugify: slugify, renderParagraphs: renderParagraphs, toPlainText: toPlainText, formatPostDate: formatPostDate };
});
