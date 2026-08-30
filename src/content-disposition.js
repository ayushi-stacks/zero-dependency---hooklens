'use strict';

const path = require('node:path');

const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const ATTR_CHAR = /^[!#$&+\-.^_`|~0-9A-Za-z]$/;
const ASCII_PRINTABLE = /^[\x20-\x7e]+$/;
const NOT_ASCII_PRINTABLE = /[^\x20-\x7e]/g;
const PERCENT_ESCAPE = /%[0-9A-Fa-f]{2}/;
const EXTENDED_VALUE = /^([!#$%&+\-^_`{}~0-9A-Za-z]+)'(?:[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)?'(.*)$/;

function contentDisposition(filename, options = {}) {
  const type = options.type === undefined ? 'attachment' : String(options.type);
  if (!TOKEN.test(type)) throw new TypeError(`Invalid Content-Disposition type: ${type}`);
  if (filename === undefined || filename === null) return type.toLowerCase();

  // Only the basename is emitted, so a caller cannot smuggle a directory path
  // through a download name.
  const name = path.basename(String(filename));
  if (!name) throw new TypeError('Content-Disposition filename cannot be empty');

  // Two reasons to take the extended path: anything outside printable ASCII
  // cannot ride in a quoted-string at all (which is also what stops a CR/LF in
  // a webhook-supplied name from reaching the header), and a literal %XX would
  // be read back as an escape by a client that decodes the fallback.
  const plain = ASCII_PRINTABLE.test(name) && !PERCENT_ESCAPE.test(name);
  const parameters = [`filename="${quote(plain ? name : asciiFallback(name))}"`];
  if (!plain) parameters.push(`filename*=UTF-8''${encodeExtended(name)}`);

  return `${type.toLowerCase()}; ${parameters.join('; ')}`;
}

function parse(header) {
  if (typeof header !== 'string') throw new TypeError('Content-Disposition header is required');

  const semicolon = header.indexOf(';');
  const type = (semicolon === -1 ? header : header.slice(0, semicolon)).trim().toLowerCase();
  if (!TOKEN.test(type)) throw new TypeError(`Invalid Content-Disposition header: ${header}`);

  const parameters = Object.create(null);
  if (semicolon === -1) return { type, parameters };

  const extended = new Set();
  for (const part of splitParameters(header.slice(semicolon + 1))) {
    const equals = part.indexOf('=');
    if (equals === -1) continue;
    const key = part.slice(0, equals).trim().toLowerCase();
    const value = part.slice(equals + 1).trim();
    if (!key) continue;

    // filename* carries the real bytes and filename only an ASCII fallback, so
    // the extended form wins no matter which order they arrive in.
    if (key.endsWith('*')) {
      const name = key.slice(0, -1);
      parameters[name] = decodeExtended(value);
      extended.add(name);
    } else if (!extended.has(key)) {
      parameters[key] = unquote(value);
    }
  }

  return { type, parameters };
}

// Splitting on a bare semicolon would truncate filename="report; final.pdf",
// so quoted sections are tracked while scanning.
function splitParameters(input) {
  const parts = [];
  let current = '';
  let quoted = false;
  let escaped = false;

  for (const character of input) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (quoted && character === '\\') {
      current += character;
      escaped = true;
    } else if (character === '"') {
      current += character;
      quoted = !quoted;
    } else if (character === ';' && !quoted) {
      parts.push(current);
      current = '';
    } else {
      current += character;
    }
  }

  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function encodeExtended(value) {
  return [...Buffer.from(value, 'utf8')]
    .map((byte) => (ATTR_CHAR.test(String.fromCharCode(byte))
      ? String.fromCharCode(byte)
      : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`))
    .join('');
}

function decodeExtended(value) {
  const match = EXTENDED_VALUE.exec(value);
  if (!match) throw new TypeError(`Invalid extended parameter value: ${value}`);

  const charset = match[1].toLowerCase();
  if (charset !== 'utf-8' && charset !== 'iso-8859-1') {
    throw new TypeError(`Unsupported extended parameter charset: ${match[1]}`);
  }

  const bytes = [];
  const encoded = match[2];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] !== '%') {
      bytes.push(encoded.charCodeAt(index));
      continue;
    }
    const hex = encoded.slice(index + 1, index + 3);
    if (!/^[0-9A-Fa-f]{2}$/.test(hex)) throw new TypeError(`Invalid percent escape: %${hex}`);
    bytes.push(Number.parseInt(hex, 16));
    index += 2;
  }

  return Buffer.from(bytes).toString(charset === 'utf-8' ? 'utf8' : 'latin1');
}

// Every emitted header byte stays printable ASCII. The package allows raw
// Latin-1, which leaves the receiving client to guess the encoding.
function asciiFallback(name) {
  return name.replace(NOT_ASCII_PRINTABLE, '?');
}

function quote(value) {
  return value.replace(/(["\\])/g, '\\$1');
}

function unquote(value) {
  if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) return value;
  return value.slice(1, -1).replace(/\\(.)/g, '$1');
}

contentDisposition.parse = parse;

module.exports = contentDisposition;
