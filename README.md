# GitHub Actions 工作坊示範專案

**繁體中文** | [English](README.en.md)

> ⚠️ **免責聲明：本專案僅供工作坊教育訓練使用。** 程式碼與設定皆為示範用途，請勿直接用於正式環境。

## 目錄

- [應用程式簡介](#應用程式簡介)
- [在本機執行](#在本機執行)
- [Workflow 情境總覽](#workflow-情境總覽)
- [情境 1：PR 自動 Code Review](#情境-1pr-自動-code-review)
- [情境 2：網頁發布 Release 後自動附上產物](#情境-2網頁發布-release-後自動附上產物)
- [情境 3：Merge 後發送 Slack 通知](#情境-3merge-後發送-slack-通知)
- [情境 4：打包 Container 發佈到 GitHub Packages](#情境-4打包-container-發佈到-github-packages)
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
│   ├── notify-slack-on-merge.yml  # 情境 3
│   └── publish-container.yml  # 情境 4
├── demo/lint-issue-example.js  # 故意寫錯的範例（不納入 lint）
├── src/                     # app.js、calculator.js、server.js
├── test/                    # node:test 單元測試
├── eslint.config.js
├── Dockerfile               # 情境 4 的映像定義
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
| 2 | 網頁發布 Release 後附上產物 | `release-on-tag.yml` | `release` published | `contents: write` |
| 3 | Merge 後發送 Slack 通知 | `notify-slack-on-merge.yml` | `pull_request` closed 到 `main`（且 merged） | `contents: read` |
| 4 | 打包 Container 發佈到 GitHub Packages | `publish-container.yml` | `push` 到 `main`、`release` published、手動 | `packages: write` |

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

## 情境 2：網頁發布 Release 後自動附上產物

**檔案：** [`.github/workflows/release-on-tag.yml`](.github/workflows/release-on-tag.yml)

流程：
1. 在 GitHub 網頁的 **Releases** 頁面建立 tag（例如 `v1.0.0`）並按下 **Publish release** 時觸發（`release: published`）。
2. 執行 lint 與測試。
3. 把 tag 版本寫進 `package.json`（不 commit），用 `npm pack` 打包成 `.tgz`。
4. 用 `gh release upload` 把 `.tgz` 上傳到這個 Release。

教學重點：`release` 事件、`github.ref_name`、`$GITHUB_OUTPUT` 傳遞 step 輸出、`GITHUB_TOKEN` 搭配 `gh` CLI。

> 為什麼不用 `push: tags`？在網頁建立 Release 時，GitHub 會先建好 Release 再推出 tag。如果 workflow 監聽 tag push，又用 `gh release create` 建一次，就會出現 `a release with the same tag name already exists` 錯誤。改成監聽 `release: published`、只負責上傳檔案，就不會重複建立。

### 示範步驟

1. 到 repo 的 **Releases** 頁面，按 **Draft a new release**。
2. 在 **Choose a tag** 輸入 `v1.0.0`，選 **Create new tag: v1.0.0 on publish**，目標選 `main`。
3. 可以按 **Generate release notes** 自動產生說明，再按 **Publish release**。
4. 到 **Actions** 分頁看 **Release Assets on Publish** 執行。
5. 完成後回到這個 Release，可以看到附件 `tw-training-actions-demo-1.0.0.tgz`。
6. 重新示範時，先刪除 Release 與 tag：
   ```bash
   gh release delete v1.0.0 --cleanup-tag --yes
   git tag -d v1.0.0
   ```

> `release` 事件不支援 `tags:` 篩選，所以 workflow 先用 `check-tag` job 以正規表示式檢查 tag 是否符合 `v*.*.*`（例如 `v1.0.0`）。不符合的 tag（例如 `v1.0` 或 `release-1`）會在 Actions 顯示 notice，`release` job 則會被略過（Skipped），可以拿來示範 `needs`、job outputs 與 `if` 的效果。

> 存成 **Draft** 不會觸發，按下 **Publish release** 才會，可以拿來示範 `types` 篩選的效果。

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

## 情境 4：打包 Container 發佈到 GitHub Packages

**檔案：** [`.github/workflows/publish-container.yml`](.github/workflows/publish-container.yml)、[`Dockerfile`](Dockerfile)

流程：
1. push 到 `main`、網頁發布 Release，或手動執行（`workflow_dispatch`）時觸發。
2. 用 `GITHUB_TOKEN` 登入 GitHub Container Registry（`ghcr.io`），不需要另外設定 secret。
3. 用 `docker/metadata-action` 依事件自動產生映像標籤：
   - push 到 `main`：`main`、`sha-xxxxxxx`
   - 發布 Release `v1.0.0`：`1.0.0`、`1.0`、`latest`、`sha-xxxxxxx`
4. 用 Buildx 建置 `linux/amd64` 與 `linux/arm64` 多平台映像並推送，並用 GitHub Actions cache 加速。
5. 用 `actions/attest-build-provenance` 產生建置來源證明（build provenance attestation）。

教學重點：`packages: write` 權限、`GITHUB_TOKEN` 登入 ghcr.io、映像標籤策略、多平台建置、build cache、供應鏈安全（attestation）。

### 示範步驟

1. 把變更 merge 到 `main`，到 **Actions** 分頁看 **Publish Container** 執行。
2. 完成後，repo 首頁右側的 **Packages** 會出現 `tw-training-material-action`，點進去可以看到各個標籤。
3. 在本機拉下來執行（私有套件要先登入：`gh auth token | docker login ghcr.io -u <你的帳號> --password-stdin`）：
   ```bash
   docker run --rm -p 3000:3000 ghcr.io/ust-pace/tw-training-material-action:main
   curl http://localhost:3000/
   ```
4. 驗證來源證明：
   ```bash
   gh attestation verify oci://ghcr.io/ust-pace/tw-training-material-action:main --repo UST-PACE/tw-training-material-action
   ```
5. 再從網頁發布一個 Release（例如 `v1.1.0`），可以看到多出 `1.1.0`、`1.1`、`latest` 標籤。

> 和情境 2 一樣，發布 Release 時會先由 `check-tag` job 檢查 tag 是否符合 `v*.*.*`，不符合（例如 `release-1`）就略過建置；push 到 `main` 和手動執行不檢查。

> 組織內新建的套件預設是 private。要讓學員不登入就能拉，到套件頁面的 **Package settings → Change visibility** 改成 public。

## 新增情境的方式

1. 在 `.github/workflows/` 新增 `<情境名稱>.yml`，開頭用註解寫清楚觸發條件與步驟。
2. 在上方[情境總覽](#workflow-情境總覽)表格加一列。
3. 新增一個「情境 N」章節：檔案、流程、教學重點、示範步驟。
4. 同步更新 [README.en.md](README.en.md)。

## 需要在 GitHub 上設定的項目

- **Settings → Actions → General**：允許 Actions 執行；Workflow permissions 維持預設即可（workflow 內已明確宣告 `permissions`）。
- 若組織限制只能用特定 actions，需允許 `actions/checkout`、`actions/setup-node`、`actions/github-script`；情境 4 另需 `docker/*` 與 `actions/attest-build-provenance`。
- 情境 3：新增 repo secret `SLACK_WEBHOOK_URL`（見情境 3 設定步驟）。
- （選用）用 branch ruleset 把 **PR Code Review** 設為 required status check。
- （選用）Copilot 自動 code review，見上方說明。

---

> ⚠️ 僅供工作坊教育訓練使用。
