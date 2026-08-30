'use strict';

const DIGITS = /^\d+$/;
const MALFORMED = -2;
const UNSATISFIABLE = -1;

function parseRange(size, header) {
  if (typeof header !== 'string') throw new TypeError('Range header must be a string');
  if (!Number.isInteger(size) || size < 0) {
    throw new TypeError('Range size must be a non-negative integer');
  }

  const equals = header.indexOf('=');
  if (equals === -1) return MALFORMED;

  const ranges = [];
  ranges.type = header.slice(0, equals).trim().toLowerCase();

  for (const specifier of header.slice(equals + 1).split(',')) {
    const hyphen = specifier.indexOf('-');
    if (hyphen === -1) return MALFORMED;

    const rawStart = specifier.slice(0, hyphen).trim();
    const rawEnd = specifier.slice(hyphen + 1).trim();
    if (rawStart === '' && rawEnd === '') return MALFORMED;
    if (rawStart !== '' && !DIGITS.test(rawStart)) return MALFORMED;
    if (rawEnd !== '' && !DIGITS.test(rawEnd)) return MALFORMED;

    let start = rawStart === '' ? Number.NaN : Number(rawStart);
    let end = rawEnd === '' ? Number.NaN : Number(rawEnd);

    if (Number.isNaN(start)) {
      // A suffix range asks for the last N bytes, so it resolves against the
      // entity size instead of being read as an offset.
      start = size - end;
      end = size - 1;
    } else if (Number.isNaN(end)) {
      end = size - 1;
    }

    if (end > size - 1) end = size - 1;
    if (start > end || start < 0) continue;
    ranges.push({ start, end });
  }

  return ranges.length === 0 ? UNSATISFIABLE : ranges;
}

// The package signals failure with bare -1 and -2. The numbers are kept for
// drop-in comparisons, but callers here read the names instead.
parseRange.MALFORMED = MALFORMED;
parseRange.UNSATISFIABLE = UNSATISFIABLE;

module.exports = parseRange;
