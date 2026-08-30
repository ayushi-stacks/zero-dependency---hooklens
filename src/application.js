'use strict';

const http = require('node:http');
const decorateResponse = require('./response');
const { compilePath, matchPath, parseRequestUrl } = require('./router');
const statuses = require('./statuses');

const ROUTE_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function createApplication() {
  const layers = [];

  function app(request, response) {
    decorateResponse(request, response);

    try {
      parseRequestUrl(request);
    } catch (error) {
      finish(error, response);
      return;
    }

    let index = 0;

    function next(error) {
      if (response.writableEnded) return;

      while (index < layers.length) {
        const layer = layers[index];
        index += 1;

        let params;
        try {
          params = layer.type === 'route' ? routeParams(layer, request) : {};
        } catch (matchError) {
          next(matchError);
          return;
        }

        if (params === null) continue;
        if (error && layer.handler.length !== 4) continue;
        if (!error && layer.handler.length === 4) continue;

        if (layer.type === 'route') request.params = params;
        invoke(layer.handler, error, request, response, next);
        return;
      }

      finish(error, response);
    }

    next();
  }

  app.use = (handler) => {
    if (typeof handler !== 'function') throw new TypeError('Middleware must be a function');
    layers.push({ type: 'middleware', handler });
    return app;
  };

  for (const method of ROUTE_METHODS) {
    app[method] = (path, handler) => {
      if (typeof handler !== 'function') throw new TypeError('Route handler must be a function');
      layers.push({
        type: 'route',
        method: method.toUpperCase(),
        path: compilePath(path),
        handler,
      });
      return app;
    };
  }

  app.handle = app;
  app.listen = (...arguments_) => http.createServer(app).listen(...arguments_);

  return app;
}

function routeParams(layer, request) {
  const methodMatches = request.method === layer.method
    || (request.method === 'HEAD' && layer.method === 'GET');
  if (!methodMatches) return null;
  return matchPath(layer.path, request.path);
}

function invoke(handler, error, request, response, next) {
  let nextCalled = false;
  const guardedNext = (nextError) => {
    if (nextCalled) return;
    nextCalled = true;
    next(nextError);
  };

  try {
    const result = error
      ? handler(error, request, response, guardedNext)
      : handler(request, response, guardedNext);

    if (result && typeof result.then === 'function') {
      result.catch(guardedNext);
    }
  } catch (handlerError) {
    guardedNext(handlerError);
  }
}

function finish(error, response) {
  if (response.writableEnded) return;

  if (error) {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }

    const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
      ? error.status
      : 500;

    // http-errors marks client errors as safe to surface. Anything without an
    // opinion falls back to the same rule, so an internal message never leaks.
    const expose = error.expose === undefined ? status < 500 : error.expose === true;
    response.status(status).json({
      error: expose ? error.message : statuses[status],
    });
    return;
  }

  response.status(404).send(statuses[404]);
}

module.exports = createApplication;
