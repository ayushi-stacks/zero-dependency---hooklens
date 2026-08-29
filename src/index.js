'use strict';

const createApplication = require('./application');
const { json, urlencoded } = require('./body-parser');
const contentType = require('./content-type');
const { parse: parseCookie, serialize: serializeCookie } = require('./cookie');
const cookieSignature = require('./cookie-signature');
const httpError = require('./http-errors');
const encodeurl = require('./encodeurl');
const logger = require('./logger');
const serveStatic = require('./static');
const statuses = require('./statuses');

createApplication.json = json;
createApplication.urlencoded = urlencoded;
createApplication.static = serveStatic;
createApplication.logger = logger;
createApplication.httpError = httpError;
createApplication.httpErrors = httpError;
createApplication.statuses = statuses;
createApplication.contentType = contentType;
createApplication['content-type'] = contentType;
createApplication.encodeurl = encodeurl;
createApplication.encodeUrl = encodeurl;
createApplication.cookie = { parse: parseCookie, serialize: serializeCookie };
createApplication.cookieSignature = cookieSignature;

module.exports = createApplication;
