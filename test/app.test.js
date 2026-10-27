'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('GET / returns the project name', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { name: require('../package.json').name });
});

test('GET /health returns ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('GET /hello greets by name', async () => {
  const res = await fetch(`${baseUrl}/hello?name=Actions`);
  assert.deepEqual(await res.json(), { message: 'Hello, Actions!' });
});

test('POST /add returns the sum', async () => {
  const res = await fetch(`${baseUrl}/add`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ a: 2, b: 3 }),
  });
  assert.deepEqual(await res.json(), { result: 5 });
});

test('POST /add rejects invalid input', async () => {
  const res = await fetch(`${baseUrl}/add`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ a: '2', b: 3 }),
  });
  assert.equal(res.status, 400);
});
