# GitHub Actions 工作坊示範專案

**繁體中文** | [English](README.en.md)

> ⚠️ **免責聲明：本專案僅供工作坊教育訓練使用。** 程式碼與設定皆為示範用途，請勿直接用於正式環境。

## 目錄

- [應用程式簡介](#應用程式簡介)
- [在本機執行](#在本機執行)
- [Workflow 情境總覽](#workflow-情境總覽)
- [情境 1：PR 自動 Code Review](#情境-1pr-自動-code-review)
- [情境 2：推送 Tag 自動發布 Release](#情境-2推送-tag-自動發布-release)
- [情境 3：Merge 後發送 Slack 通知](#情境-3merge-後發送-slack-通知)
- [新增情境的方式](#新增情境的方式)

## 應用程式簡介

一個用 Node.js + Express 寫的小型 API，讓學員專注在 workflow 本身。

| Method | 路徑 | 說明 |
|---|---|---|
| GET | `/` | 回傳專案名稱 `{ "name": "tw-training-actions-demo" }` |
| GET | `/health` | 健康檢查，回傳 `{ "status": "ok" }` |
| GET | `/hello?name=Kimi` | 回傳打招呼訊息 |
| POST | `/add` | Body `{ "a": 1, "b": 2 }`，回傳 `{ "result": 3 }` |

```
.
├── .github/workflows/
│   ├── pr-code-review.yml   # 情境 1
│   ├── release-on-tag.yml   # 情境 2
│   └── notify-slack-on-merge.yml  # 情境 3
├── demo/lint-issue-example.js  # 故意寫錯的範例（不納入 lint）
├── src/                     # app.js、calculator.js、server.js
├── test/                    # node:test 單元測試
├── eslint.config.js
├── .nvmrc                   # Node.js 24 (LTS)
└── package.json
```

## 在本機執行

需要 Node.js 24（可用 `nvm use` 讀取 `.nvmrc`）。

```bash
npm install
npm start          # http://localhost:3000
npm test           # 單元測試（node:test）
npm run lint       # ESLint
```

```bash
curl http://localhost:3000/
curl http://localhost:3000/health
curl "http://localhost:3000/hello?name=Actions"
curl -X POST http://localhost:3000/add -H "content-type: application/json" -d '{"a":2,"b":3}'
```

## Workflow 情境總覽

| # | 情境 | 檔案 | 觸發條件（trigger） | 權限（permissions） |
|---|---|---|---|---|
| 1 | PR 自動 Code Review | `pr-code-review.yml` | `pull_request` 到 `main` | `contents: read`、`pull-requests: write` |
| 2 | 推送 Tag 發布 Release | `release-on-tag.yml` | `push` tag `v*.*.*` | `contents: write` |
| 3 | Merge 後發送 Slack 通知 | `notify-slack-on-merge.yml` | `pull_request` closed 到 `main`（且 merged） | `contents: read` |

## 情境 1：PR 自動 Code Review

**檔案：** [`.github/workflows/pr-code-review.yml`](.github/workflows/pr-code-review.yml)

流程：
1. 對 `main` 開 PR、推新 commit 或重新開啟 PR 時觸發。
2. 執行 `npm ci`、ESLint 與單元測試。
3. 用 `actions/github-script` 呼叫 REST API 建立一則 PR review：
   - 落在本次變更行上的 ESLint 問題，會成為該行的 inline comment。
   - 其他問題與測試結果，整理在 review 的摘要裡。
4. Lint 或測試沒過時，check 會失敗。

教學重點：`permissions` 最小權限、`concurrency` 取消舊執行、`continue-on-error` 搭配 `steps.<id>.outcome`、`if: always()`。

### 示範步驟

```bash
git switch -c demo/code-review
cp demo/lint-issue-example.js src/compare.js
git add src/compare.js
git commit -m "demo: add code with lint issues"
git push -u origin demo/code-review
```

1. 在 GitHub 上對 `main` 開 PR。
2. 到 **Actions** 分頁看 **PR Code Review** 執行。
3. 回到 PR 的 **Files changed**，可以看到 `no-var`、`no-unused-vars`、`prefer-const`、`eqeqeq` 四則 inline 留言；check 會顯示失敗。
4. 修正：執行 `npx eslint src/compare.js --fix`，再手動刪掉未使用的變數，push 後 check 變綠。
5. 示範結束後關閉 PR、刪除分支，不要 merge。

> `demo/` 資料夾被 `eslint.config.js` 排除，所以 main 的 lint 永遠是綠的。

> 從 fork 開的 PR，`GITHUB_TOKEN` 只有唯讀權限，留言步驟會失敗。工作坊請在同一個 repo 內開分支示範。

### 延伸：Copilot 自動 Code Review（AI 替代方案）

Copilot code review 是設定，不是 workflow：

1. Repo **Settings → Rules → Rulesets → New ruleset → New branch ruleset**。
2. Target branches 選 `main`（Include default branch）。
3. 勾選 **Automatically request Copilot code review**；可再勾 **Review new pushes**。
4. 狀態設為 **Active** 並儲存。

之後每個對 `main` 的 PR 都會自動請 Copilot 審查。需要有 Copilot 授權（Pro、Pro+、Business 或 Enterprise），並會消耗 premium requests。詳見[官方文件](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/configure-automatic-review)。

可以同時使用：ESLint workflow 負責確定性的規則檢查，Copilot 負責語意層面的建議。

## 情境 2：推送 Tag 自動發布 Release

**檔案：** [`.github/workflows/release-on-tag.yml`](.github/workflows/release-on-tag.yml)

流程：
1. 推送符合 `v*.*.*` 的 tag 時觸發，例如 `v1.0.0`。
2. 執行 lint 與測試。
3. 把 tag 版本寫進 `package.json`（不 commit），用 `npm pack` 打包成 `.tgz`。
4. 用 `gh release create --generate-notes` 建立 Release，自動產生 release notes 並附上 `.tgz`。

教學重點：tag filter、`github.ref_name`、`$GITHUB_OUTPUT` 傳遞 step 輸出、`GITHUB_TOKEN` 搭配 `gh` CLI。

### 示範步驟

```bash
git switch main
git pull
git tag v1.0.0
git push origin v1.0.0
```

1. 到 **Actions** 分頁看 **Release on Tag** 執行。
2. 完成後到 **Releases**，可以看到 `v1.0.0`、自動產生的 release notes，以及附件 `tw-training-actions-demo-1.0.0.tgz`。
3. 重新示範時，先刪除 Release 與 tag：
   ```bash
   gh release delete v1.0.0 --cleanup-tag --yes
   git tag -d v1.0.0
   ```

> 打錯格式的 tag（例如 `v1.0` 或 `release-1`）不會觸發，可以拿來示範 filter 的效果。

## 情境 3：Merge 後發送 Slack 通知

**檔案：** [`.github/workflows/notify-slack-on-merge.yml`](.github/workflows/notify-slack-on-merge.yml)
**目標頻道：** `#github-notification`（在建立 Incoming Webhook 時選定）

流程：
1. PR 被關閉（`closed`）且目標分支是 `main` 時觸發。
2. `if: github.event.pull_request.merged == true` 過濾掉「關閉但沒 merge」的 PR。
3. 用 `jq` 組出 Slack Block Kit 訊息：repo、PR 編號與標題（含連結）、作者、merge 的人、`main ← 分支`、短 commit SHA、workflow run 連結。
4. 用 `curl` POST 到 `secrets.SLACK_WEBHOOK_URL`。沒設定 secret 時只顯示 warning 並略過，不會讓 workflow 失敗。

教學重點：
- **Secrets**：Webhook URL 等同密碼，只放在 repo secret，log 中會自動遮蔽，絕對不要寫進程式碼或 YAML。
- **merged 條件**：`closed` 也包含沒 merge 就關掉的 PR，所以一定要判斷 `merged`。替代方案是 `on: push: branches: [main]`，但拿不到 PR 資訊，直接 push 到 main 也會觸發。
- **Script injection 防護**：PR 標題是任何人都能控制的內容。不要在 `run:` 裡直接寫 `${{ github.event.pull_request.title }}`，要先放進 `env`，再用 `jq --arg` 組 JSON，避免指令注入或 JSON 被破壞。
- Incoming Webhook 綁定建立時選的頻道，payload 無法改送到其他頻道。要送到不同頻道，就要另外建立 webhook。

### 設定步驟

1. 到 [Slack API: Your Apps](https://api.slack.com/apps) → **Create New App → From scratch**，選擇你的 workspace。
2. 左側 **Incoming Webhooks** → 打開 **Activate Incoming Webhooks**。
3. **Add New Webhook to Workspace** → 選擇頻道 `#github-notification` → **Allow**，複製產生的 Webhook URL。
4. 把 URL 存成 repo secret（執行後依提示貼上，URL 不會留在 shell history）：
   ```bash
   gh secret set SLACK_WEBHOOK_URL --repo UST-PACE/tw-training-material-action
   ```
   也可以在 **Settings → Secrets and variables → Actions → New repository secret** 新增。

### 示範步驟

```bash
git switch main && git pull
git switch -c demo/slack-notify
echo "<!-- slack demo -->" >> README.md
git commit -am "docs: trigger slack notification demo"
git push -u origin demo/slack-notify
```

1. 對 `main` 開 PR 並 merge。
2. 到 **Actions** 看 **Notify Slack on Merge** 執行，`#github-notification` 會收到訊息。
3. 對照：再開一個 PR 但直接 **Close**（不 merge），workflow 會顯示 skipped，不會發訊息。

## 新增情境的方式

1. 在 `.github/workflows/` 新增 `<情境名稱>.yml`，開頭用註解寫清楚觸發條件與步驟。
2. 在上方[情境總覽](#workflow-情境總覽)表格加一列。
3. 新增一個「情境 N」章節：檔案、流程、教學重點、示範步驟。
4. 同步更新 [README.en.md](README.en.md)。

## 需要在 GitHub 上設定的項目

- **Settings → Actions → General**：允許 Actions 執行；Workflow permissions 維持預設即可（workflow 內已明確宣告 `permissions`）。
- 若組織限制只能用特定 actions，需允許 `actions/checkout`、`actions/setup-node`、`actions/github-script`。
- 情境 3：新增 repo secret `SLACK_WEBHOOK_URL`（見情境 3 設定步驟）。
- （選用）用 branch ruleset 把 **PR Code Review** 設為 required status check。
- （選用）Copilot 自動 code review，見上方說明。

---

> ⚠️ 僅供工作坊教育訓練使用。
