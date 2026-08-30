'use strict';

const UNMATCHED_SURROGATE = /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g;
const PERCENT_ESCAPE = /(%[0-9A-Fa-f]{2})/;

module.exports = function encodeurl(value) {
  if (value === undefined || value === null) return value;

  // encodeURI throws on lone surrogates, and a URL encoder handed untrusted
  // input must not throw, so they become the replacement character first.
  const normalized = String(value).replace(UNMATCHED_SURROGATE, '$1\uFFFD$2');

  // Splitting on the capture group parks existing %XX escapes in the odd slots
  // so they survive untouched. Encoding them again is the bug this whole
  // module exists to avoid.
  return normalized
    .split(PERCENT_ESCAPE)
    .map((part, index) => (index % 2 === 1 ? part : encodeSegment(part)))
    .join('');
};

function encodeSegment(segment) {
  return encodeURI(segment).replace(/%5B/gi, '[').replace(/%5D/gi, ']');
}
