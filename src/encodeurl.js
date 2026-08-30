'use strict';

module.exports = function encodeurl(value) {
  if (value === undefined || value === null) return value;
  const string = String(value);
  if (string === '') return string;
  return encodeURI(string).replace(/%5B/gi, '[').replace(/%5D/gi, ']');
};
