# GitHub Actions Workshop Demo

[繁體中文](README.md) | **English**

> ⚠️ **Disclaimer: for workshop training use only.** The code and configuration are for demonstration and are not meant for production.

## Contents

- [App overview](#app-overview)
- [Run locally](#run-locally)
- [Workflow scenarios](#workflow-scenarios)
- [Scenario 1: automated PR code review](#scenario-1-automated-pr-code-review)
- [Scenario 2: release on tag](#scenario-2-release-on-tag)
- [Scenario 3: Slack notification on merge](#scenario-3-slack-notification-on-merge)
- [Adding scenarios](#adding-scenarios)

## App overview

A small Node.js + Express API, so learners can focus on the workflows.

| Method | Path | Description |
|---|---|---|
| GET | `/` | Returns the project name `{ "name": "tw-training-actions-demo" }` |
| GET | `/health` | Health check, returns `{ "status": "ok" }` |
| GET | `/hello?name=Kimi` | Returns a greeting |
| POST | `/add` | Body `{ "a": 1, "b": 2 }`, returns `{ "result": 3 }` |

```
.
├── .github/workflows/
│   ├── pr-code-review.yml   # Scenario 1
│   ├── release-on-tag.yml   # Scenario 2
│   └── notify-slack-on-merge.yml  # Scenario 3
├── demo/lint-issue-example.js  # intentionally bad code (ignored by lint)
├── src/                     # app.js, calculator.js, server.js
├── test/                    # node:test unit tests
├── eslint.config.js
├── .nvmrc                   # Node.js 24 (LTS)
└── package.json
```

## Run locally

Requires Node.js 24 (`nvm use` reads `.nvmrc`).

```bash
npm install
npm start          # http://localhost:3000
npm test           # unit tests (node:test)
npm run lint       # ESLint
```

```bash
curl http://localhost:3000/
curl http://localhost:3000/health
curl "http://localhost:3000/hello?name=Actions"
curl -X POST http://localhost:3000/add -H "content-type: application/json" -d '{"a":2,"b":3}'
```

## Workflow scenarios

| # | Scenario | File | Trigger | Permissions |
|---|---|---|---|---|
| 1 | Automated PR code review | `pr-code-review.yml` | `pull_request` to `main` | `contents: read`, `pull-requests: write` |
| 2 | Release on tag | `release-on-tag.yml` | `push` of tag `v*.*.*` | `contents: write` |
| 3 | Slack notification on merge | `notify-slack-on-merge.yml` | `pull_request` closed to `main` (merged only) | `contents: read` |

## Scenario 1: automated PR code review

**File:** [`.github/workflows/pr-code-review.yml`](.github/workflows/pr-code-review.yml)

1. Runs when a PR to `main` is opened, updated, or reopened.
2. Runs `npm ci`, ESLint, and the unit tests.
3. Uses `actions/github-script` to create a PR review:
   - ESLint findings on changed lines become inline comments.
   - Other findings and the test result go into the review summary.
4. Fails the check if lint or tests fail.

Teaching points: least-privilege `permissions`, `concurrency`, `continue-on-error` with `steps.<id>.outcome`, `if: always()`.

### Demo steps

```bash
git switch -c demo/code-review
cp demo/lint-issue-example.js src/compare.js
git add src/compare.js
git commit -m "demo: add code with lint issues"
git push -u origin demo/code-review
```

1. Open a PR to `main` on GitHub.
2. Watch **PR Code Review** in the **Actions** tab.
3. In **Files changed**, see four inline comments (`no-var`, `no-unused-vars`, `prefer-const`, `eqeqeq`); the check fails.
4. Fix with `npx eslint src/compare.js --fix`, remove the unused variable, push, and the check turns green.
5. Close the PR and delete the branch afterwards; do not merge.

> `demo/` is ignored in `eslint.config.js`, so lint on `main` stays green.

> PRs from forks get a read-only `GITHUB_TOKEN`, so the comment step fails. Use a branch in the same repo for the workshop.

### Extra: Copilot automatic code review (AI alternative)

Copilot code review is a setting, not a workflow:

1. Repo **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.
2. Target `main` (Include default branch).
3. Check **Automatically request Copilot code review**; optionally **Review new pushes**.
4. Set enforcement to **Active** and save.

Every PR to `main` then requests a Copilot review. Requires a Copilot plan (Pro, Pro+, Business, or Enterprise) and consumes premium requests. See the [docs](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/configure-automatic-review).

They work well together: the ESLint workflow for deterministic rules, Copilot for semantic suggestions.

## Scenario 2: release on tag

**File:** [`.github/workflows/release-on-tag.yml`](.github/workflows/release-on-tag.yml)

1. Runs when a tag matching `v*.*.*` is pushed, e.g. `v1.0.0`.
2. Runs lint and tests.
3. Sets the tag version in `package.json` (not committed) and builds a `.tgz` with `npm pack`.
4. Creates a Release with `gh release create --generate-notes` and attaches the `.tgz`.

Teaching points: tag filters, `github.ref_name`, step outputs via `$GITHUB_OUTPUT`, `GITHUB_TOKEN` with the `gh` CLI.

### Demo steps

```bash
git switch main
git pull
git tag v1.0.0
git push origin v1.0.0
```

1. Watch **Release on Tag** in the **Actions** tab.
2. Open **Releases** to see `v1.0.0`, the generated notes, and `tw-training-actions-demo-1.0.0.tgz`.
3. To repeat the demo, delete the release and tag:
   ```bash
   gh release delete v1.0.0 --cleanup-tag --yes
   git tag -d v1.0.0
   ```

> Tags in another format (e.g. `v1.0` or `release-1`) don't trigger it, which is a good way to show filters.

## Scenario 3: Slack notification on merge

**File:** [`.github/workflows/notify-slack-on-merge.yml`](.github/workflows/notify-slack-on-merge.yml)
**Target channel:** `#github-notification` (chosen when the Incoming Webhook is created)

1. Runs when a PR to `main` is closed.
2. `if: github.event.pull_request.merged == true` skips PRs closed without merging.
3. Builds a Slack Block Kit message with `jq`: repo, PR number and title (linked), author, merged by, `main ← branch`, short commit SHA, and a workflow run link.
4. POSTs it with `curl` to `secrets.SLACK_WEBHOOK_URL`. If the secret is missing, it logs a warning and skips without failing.

Teaching points:
- **Secrets**: a webhook URL is a credential. Keep it only in a repo secret (masked in logs), never in code or YAML.
- **Merged condition**: `closed` also fires for PRs closed without merging. The alternative `on: push: branches: [main]` has no PR info and also fires on direct pushes.
- **Script injection safety**: the PR title is user-controlled. Never put `${{ github.event.pull_request.title }}` directly in `run:`; pass it via `env` and build JSON with `jq --arg`.
- An Incoming Webhook is bound to the channel chosen at creation; the payload can't redirect it. Use another webhook for another channel.

### Setup

1. Go to [Slack API: Your Apps](https://api.slack.com/apps) → **Create New App → From scratch**, pick your workspace.
2. **Incoming Webhooks** → turn on **Activate Incoming Webhooks**.
3. **Add New Webhook to Workspace** → choose `#github-notification` → **Allow**, then copy the URL.
4. Save it as a repo secret (paste when prompted, so it stays out of shell history):
   ```bash
   gh secret set SLACK_WEBHOOK_URL --repo UST-PACE/tw-training-material-action
   ```
   Or use **Settings → Secrets and variables → Actions → New repository secret**.

### Demo steps

```bash
git switch main && git pull
git switch -c demo/slack-notify
echo "<!-- slack demo -->" >> README.md
git commit -am "docs: trigger slack notification demo"
git push -u origin demo/slack-notify
```

1. Open a PR to `main` and merge it.
2. Watch **Notify Slack on Merge** in **Actions**; `#github-notification` gets the message.
3. Contrast: open another PR and **Close** it without merging; the job is skipped and nothing is sent.

## Adding scenarios

1. Add `<scenario>.yml` under `.github/workflows/`, with header comments for trigger and steps.
2. Add a row to the [scenario table](#workflow-scenarios).
3. Add a "Scenario N" section: file, flow, teaching points, demo steps.
4. Update [README.md](README.md) too.

## GitHub settings to check

- **Settings → Actions → General**: Actions allowed; default workflow permissions are fine (each workflow declares `permissions`).
- If the org restricts actions, allow `actions/checkout`, `actions/setup-node`, `actions/github-script`.
- Scenario 3: add repo secret `SLACK_WEBHOOK_URL` (see Scenario 3 setup).
- (Optional) Make **PR Code Review** a required status check via a branch ruleset.
- (Optional) Copilot automatic code review, above.

---

> ⚠️ For workshop training use only.
