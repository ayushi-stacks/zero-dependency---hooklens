'use strict';

const createApplication = require('./application');
const { json, urlencoded } = require('./body-parser');
const logger = require('./logger');
const serveStatic = require('./static');

createApplication.json = json;
createApplication.urlencoded = urlencoded;
createApplication.static = serveStatic;
createApplication.logger = logger;

module.exports = createApplication;
