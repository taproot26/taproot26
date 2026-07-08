const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml, formatRelativeDate, renderFeedbackItem } = require('../feedback-render.js');

test('escapeHtml escapes html special characters', () => {
  assert.equal(escapeHtml(`<script>&"'`), '&lt;script&gt;&amp;&quot;&#39;');
});

test('formatRelativeDate returns "just now" for timestamps under a minute old', () => {
  const now = new Date('2026-07-08T12:00:00Z');
  const ts = new Date('2026-07-08T11:59:30Z').toISOString();
  assert.equal(formatRelativeDate(ts, now), 'just now');
});

test('formatRelativeDate returns minutes ago', () => {
  const now = new Date('2026-07-08T12:00:00Z');
  const ts = new Date('2026-07-08T11:55:00Z').toISOString();
  assert.equal(formatRelativeDate(ts, now), '5 minutes ago');
});

test('formatRelativeDate returns hours ago', () => {
  const now = new Date('2026-07-08T12:00:00Z');
  const ts = new Date('2026-07-08T09:00:00Z').toISOString();
  assert.equal(formatRelativeDate(ts, now), '3 hours ago');
});

test('formatRelativeDate returns days ago under 30 days', () => {
  const now = new Date('2026-07-08T12:00:00Z');
  const ts = new Date('2026-07-05T12:00:00Z').toISOString();
  assert.equal(formatRelativeDate(ts, now), '3 days ago');
});

test('formatRelativeDate falls back to a full date at 30+ days', () => {
  const now = new Date('2026-07-08T12:00:00Z');
  const ts = new Date('2026-05-01T12:00:00Z').toISOString();
  assert.equal(formatRelativeDate(ts, now), 'May 1, 2026');
});

test('renderFeedbackItem shows "Anonymous" when name is missing', () => {
  const now = new Date('2026-07-08T12:00:00Z');
  const html = renderFeedbackItem({ name: null, body: 'hello', created_at: now.toISOString() }, now);
  assert.match(html, /Anonymous/);
  assert.match(html, /hello/);
});

test('renderFeedbackItem escapes name and body', () => {
  const now = new Date('2026-07-08T12:00:00Z');
  const html = renderFeedbackItem({ name: '<b>bob</b>', body: '<i>hi</i>', created_at: now.toISOString() }, now);
  assert.doesNotMatch(html, /<b>bob<\/b>/);
  assert.match(html, /&lt;b&gt;bob&lt;\/b&gt;/);
});
