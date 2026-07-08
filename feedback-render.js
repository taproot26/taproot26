(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FeedbackRender = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  var ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) { return ESCAPE_MAP[c]; });
  }

  function formatRelativeDate(isoString, now) {
    now = now || new Date();
    var then = new Date(isoString);
    var diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return 'just now';
    var diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return diffMin + (diffMin === 1 ? ' minute ago' : ' minutes ago');
    var diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return diffHour + (diffHour === 1 ? ' hour ago' : ' hours ago');
    var diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return diffDay + (diffDay === 1 ? ' day ago' : ' days ago');
    return then.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function renderFeedbackItem(item, now) {
    var name = item.name ? escapeHtml(item.name) : 'Anonymous';
    var body = escapeHtml(item.body);
    var date = formatRelativeDate(item.created_at, now);
    return '<div class="feedback-item">' +
      '<div class="feedback-meta"><span class="feedback-name">' + name + '</span>' +
      '<span class="feedback-date">' + date + '</span></div>' +
      '<p class="feedback-body">' + body + '</p></div>';
  }

  return { escapeHtml: escapeHtml, formatRelativeDate: formatRelativeDate, renderFeedbackItem: renderFeedbackItem };
});
