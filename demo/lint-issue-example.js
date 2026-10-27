'use strict';

// ⚠️ 故意寫錯的範例 / INTENTIONALLY BAD CODE FOR THE PR CODE REVIEW DEMO
// 這個檔案被 eslint.config.js 排除，所以不會讓 main 的 lint 失敗。
// 示範時把它複製到 src/ 再開 PR，就會看到自動 review 留言。
// This file is ignored by ESLint. Copy it into src/ on a branch and open a PR
// to see the automated review comments.

var unusedValue = 42;

function compare(a, b) {
  let result = a == b;
  return result;
}

module.exports = { compare };
