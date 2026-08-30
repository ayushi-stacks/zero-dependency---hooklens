'use strict';

const cookie = require('./cookie');
const cookieSignature = require('./cookie-signature');

const SIGNED_PREFIX = 's:';

function cookies(secret) {
  if (secret !== undefined && typeof secret !== 'string') {
    throw new TypeError('Cookie secret must be a string');
  }

  return (request, response, next) => {
    request.secret = secret;
    request.cookies = Object.create(null);
    request.signedCookies = Object.create(null);

    for (const [name, value] of Object.entries(cookie.parse(request.headers.cookie))) {
      if (!secret || !value.startsWith(SIGNED_PREFIX)) {
        request.cookies[name] = value;
        continue;
      }

      // A cookie that claims to be signed but fails verification is dropped
      // rather than handed to the application as an ordinary value.
      const unsigned = cookieSignature.unsign(value.slice(SIGNED_PREFIX.length), secret);
      if (unsigned !== false) request.signedCookies[name] = unsigned;
    }

    next();
  };
}

module.exports = cookies;
