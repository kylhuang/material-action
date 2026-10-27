'use strict';

const express = require('express');
const { add, isValidNumber } = require('./calculator');
const { name: projectName } = require('../package.json');

function createApp() {
  const app = express();
  app.use(express.json());

  // 根目錄：回傳專案名稱 / Root: returns the project name
  app.get('/', (req, res) => {
    res.json({ name: projectName });
  });

  // 健康檢查 / Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: process.env.APP_VERSION || 'dev' });
  });

  // 打招呼 / Greeting: GET /hello?name=Kimi
  app.get('/hello', (req, res) => {
    const name = (req.query.name || 'World').toString().slice(0, 50);
    res.json({ message: `Hello, ${name}!` });
  });

  // 加法 / Addition: POST /add { "a": 1, "b": 2 }
  app.post('/add', (req, res) => {
    const { a, b } = req.body || {};
    if (!isValidNumber(a) || !isValidNumber(b)) {
      return res.status(400).json({ error: 'a and b must be numbers' });
    }
    return res.json({ result: add(a, b) });
  });

  return app;
}

module.exports = { createApp };
