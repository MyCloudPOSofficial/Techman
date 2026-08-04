const { AsyncLocalStorage } = require('node:async_hooks');

const als = new AsyncLocalStorage();

function runWithContext(context, fn) {
  return als.run(context, fn);
}

function getRequestContext() {
  return als.getStore() || null;
}

module.exports = { runWithContext, getRequestContext };
