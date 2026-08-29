'use strict';

const createDemoApp = require('./app');

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const { app } = createDemoApp();
const server = app.listen(port, host, () => {
  const address = server.address();
  console.log(`HookLens webhook inspector running at http://${host}:${address.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
