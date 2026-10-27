'use strict';

function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function add(a, b) {
  return a + b;
}

module.exports = { add, isValidNumber };
