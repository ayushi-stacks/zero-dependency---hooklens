'use strict';

const createDemoApp = require('./app');

const port = Number(process.env.PORT || 3000);
// A platform that injects PORT is routing external traffic into this
// container, so binding loopback there would leave the server unreachable.
const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const { app } = createDemoApp();
const server = app.listen(port, host, () => {
  const address = server.address();
  console.log(`HookLens webhook inspector running at http://${host}:${address.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
