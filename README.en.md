# GitHub Actions Workshop Demo

[繁體中文](README.md) | **English**

> ⚠️ **Disclaimer: for workshop training use only.** The code and configuration are for demonstration and are not meant for production.

## Contents

- [App overview](#app-overview)
- [Run locally](#run-locally)
- [Workflow scenarios](#workflow-scenarios)
- [Scenario 1: automated PR code review](#scenario-1-automated-pr-code-review)
- [Scenario 2: attach build output when a release is published](#scenario-2-attach-build-output-when-a-release-is-published)
- [Scenario 3: Slack notification on merge](#scenario-3-slack-notification-on-merge)
- [Scenario 4: publish a container to GitHub Packages](#scenario-4-publish-a-container-to-github-packages)
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
│   ├── notify-slack-on-merge.yml  # Scenario 3
│   └── publish-container.yml  # Scenario 4
├── demo/lint-issue-example.js  # intentionally bad code (ignored by lint)
├── src/                     # app.js, calculator.js, server.js
├── test/                    # node:test unit tests
├── eslint.config.js
├── Dockerfile               # image for Scenario 4
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
| 2 | Attach build output on release publish | `release-on-tag.yml` | `release` published | `contents: write` |
| 3 | Slack notification on merge | `notify-slack-on-merge.yml` | `pull_request` closed to `main` (merged only) | `contents: read` |
| 4 | Publish a container to GitHub Packages | `publish-container.yml` | `push` to `main`, `release` published, manual | `packages: write` |

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

## Scenario 2: attach build output when a release is published

**File:** [`.github/workflows/release-on-tag.yml`](.github/workflows/release-on-tag.yml)

1. Runs when you create a tag (e.g. `v1.0.0`) on the **Releases** page and click **Publish release** (`release: published`).
2. Runs lint and tests.
3. Sets the tag version in `package.json` (not committed) and builds a `.tgz` with `npm pack`.
4. Uploads the `.tgz` to that release with `gh release upload`.

Teaching points: the `release` event, `github.ref_name`, step outputs via `$GITHUB_OUTPUT`, `GITHUB_TOKEN` with the `gh` CLI.

> Why not `push: tags`? When you create a release in the web UI, GitHub creates the release first and then pushes the tag. A workflow listening for tag pushes that also runs `gh release create` fails with `a release with the same tag name already exists`. Listening for `release: published` and only uploading files avoids the duplicate.

### Demo steps

1. Open the repo's **Releases** page and click **Draft a new release**.
2. In **Choose a tag**, type `v1.0.0`, pick **Create new tag: v1.0.0 on publish**, and target `main`.
3. Optionally click **Generate release notes**, then **Publish release**.
4. Watch **Release Assets on Publish** in the **Actions** tab.
5. When it finishes, the release shows the attachment `tw-training-actions-demo-1.0.0.tgz`.
6. To repeat the demo, delete the release and tag:
   ```bash
   gh release delete v1.0.0 --cleanup-tag --yes
   git tag -d v1.0.0
   ```

> The `release` event doesn't support a `tags:` filter, so a `check-tag` job first checks the tag against `v*.*.*` (e.g. `v1.0.0`) with a regex. Other tags (e.g. `v1.0` or `release-1`) get a notice and the `release` job is skipped, which shows off `needs`, job outputs, and `if`.

> Saving as a **Draft** doesn't trigger it; only **Publish release** does, which is a good way to show `types` filtering.

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

## Scenario 4: publish a container to GitHub Packages

**Files:** [`.github/workflows/publish-container.yml`](.github/workflows/publish-container.yml), [`Dockerfile`](Dockerfile)

1. Runs on a push to `main`, a published release, or manually (`workflow_dispatch`).
2. Logs in to GitHub Container Registry (`ghcr.io`) with `GITHUB_TOKEN`; no extra secret needed.
3. `docker/metadata-action` generates image tags per event:
   - Push to `main`: `main`, `sha-xxxxxxx`
   - Release `v1.0.0`: `1.0.0`, `1.0`, `latest`, `sha-xxxxxxx`
4. Builds and pushes a `linux/amd64` + `linux/arm64` image with Buildx, using the GitHub Actions cache.
5. Generates a build provenance attestation with `actions/attest-build-provenance`.

Teaching points: the `packages: write` permission, logging in to ghcr.io with `GITHUB_TOKEN`, tagging strategy, multi-platform builds, build cache, supply-chain security (attestations).

### Demo steps

1. Merge to `main` and watch **Publish Container** in the **Actions** tab.
2. When it finishes, **Packages** on the repo home page lists `tw-training-material-action` with its tags.
3. Pull and run it locally (log in first for a private package: `gh auth token | docker login ghcr.io -u <your-username> --password-stdin`):
   ```bash
   docker run --rm -p 3000:3000 ghcr.io/ust-pace/tw-training-material-action:main
   curl http://localhost:3000/
   ```
4. Verify the attestation:
   ```bash
   gh attestation verify oci://ghcr.io/ust-pace/tw-training-material-action:main --repo UST-PACE/tw-training-material-action
   ```
5. Publish another release in the web UI (e.g. `v1.1.0`) to see the `1.1.0`, `1.1`, and `latest` tags appear.

> As in Scenario 2, a published release first goes through a `check-tag` job: tags not matching `v*.*.*` (e.g. `release-1`) skip the build. Pushes to `main` and manual runs aren't checked.

> New packages in an organization are private by default. To let attendees pull without logging in, use **Package settings → Change visibility** on the package page.

## Adding scenarios

1. Add `<scenario>.yml` under `.github/workflows/`, with header comments for trigger and steps.
2. Add a row to the [scenario table](#workflow-scenarios).
3. Add a "Scenario N" section: file, flow, teaching points, demo steps.
4. Update [README.md](README.md) too.

## GitHub settings to check

- **Settings → Actions → General**: Actions allowed; default workflow permissions are fine (each workflow declares `permissions`).
- If the org restricts actions, allow `actions/checkout`, `actions/setup-node`, `actions/github-script`; Scenario 4 also needs `docker/*` and `actions/attest-build-provenance`.
- Scenario 3: add repo secret `SLACK_WEBHOOK_URL` (see Scenario 3 setup).
- (Optional) Make **PR Code Review** a required status check via a branch ruleset.
- (Optional) Copilot automatic code review, above.

---

> ⚠️ For workshop training use only.
