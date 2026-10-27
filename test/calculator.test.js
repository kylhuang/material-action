'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { add, isValidNumber } = require('../src/calculator');

test('add() sums two numbers', () => {
  assert.equal(add(1, 2), 3);
  assert.equal(add(-1, 1), 0);
});

test('isValidNumber() rejects non-numbers', () => {
  assert.equal(isValidNumber(1), true);
  assert.equal(isValidNumber('1'), false);
  assert.equal(isValidNumber(NaN), false);
  assert.equal(isValidNumber(undefined), false);
});
