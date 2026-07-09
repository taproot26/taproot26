const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify, renderParagraphs, formatPostDate } = require('../post-utils.js');

test('slugify lowercases and hyphenates', () => {
  assert.equal(slugify('My New Post'), 'my-new-post');
});

test('slugify collapses punctuation and trims hyphens', () => {
  assert.equal(slugify('  Foid Debasement: Theory!! '), 'foid-debasement-theory');
});

test('slugify handles repeated separators', () => {
  assert.equal(slugify('a --- b'), 'a-b');
});

test('renderParagraphs splits on blank lines and wraps in <p>', () => {
  assert.equal(renderParagraphs('one\n\ntwo'), '<p>one</p><p>two</p>');
});

test('renderParagraphs escapes html and converts inner newlines to <br>', () => {
  assert.equal(renderParagraphs('a<b\nc'), '<p>a&lt;b<br>c</p>');
});

test('renderParagraphs ignores extra blank lines and trailing whitespace', () => {
  assert.equal(renderParagraphs('one\n\n\n\ntwo\n'), '<p>one</p><p>two</p>');
});

test('formatPostDate renders long month day year', () => {
  assert.equal(formatPostDate('2026-07-09T00:30:00Z'), 'July 9, 2026');
});
