---
name: sync-upstream
description: Merge upstream AltanS/collie's latest stable release (never edge or prerelease builds) into the fork's main, resolve conflicts, get exactly one sol review, apply agreed fixes, then commit, deploy and push. Use when asked to sync, update from, or merge upstream.
disable-model-invocation: true
---

# Sync the fork with upstream

The fork (`origin` = schugazi/collie) takes upstream (`upstream` = AltanS/collie) by **merge, never rebase**: `origin/main` is published and deployed, so its history is never rewritten. It takes **only upstream's latest stable release**: the GitHub release marked Latest, which is never a draft or a prerelease. Never merge `upstream/main` or an edge/beta tag, because they carry unreleased work. One merge commit per sync, titled `Merge upstream AltanS/collie through <version>`. Run everything from the repo root. You decide conflicts yourself; only stop for the hard stops listed at the end. Nothing is published until the last step: the merge stays local until it has been reviewed, fixed and deployed on this host.

## 1. Prepare

Run this as one command. It aborts at the first failure and ends by printing one verdict line:

```bash
(
set -euo pipefail
git switch main
[ -z "$(git status --porcelain)" ] || { echo "STOP: dirty tree"; exit 1; }
git pull --ff-only origin main
git fetch --no-tags upstream                   # never mirror upstream's tags
TAG=$(gh api repos/AltanS/collie/releases/latest --jq .tag_name)   # Latest: no draft, no prerelease
[[ $TAG =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "STOP: latest release '$TAG' is not vX.Y.Z"; exit 1; }
# A remote ref, not a local tag. Drop the old one first so a failed fetch can't leave a stale release behind.
git update-ref -d refs/remotes/upstream/stable
git fetch --no-tags upstream "+refs/tags/$TAG:refs/remotes/upstream/stable"
git update-ref refs/remotes/upstream/stable "$(git rev-parse 'refs/remotes/upstream/stable^{commit}')"   # peel the annotated tag
FORK=$(sed -n 's/^version = "\(.*\)"/\1/p' herdr-plugin.toml | head -1); FORK=${FORK%%-*}
[ -n "$FORK" ] || { echo "STOP: no version in herdr-plugin.toml"; exit 1; }
if git merge-base --is-ancestor upstream/stable HEAD; then echo "UP-TO-DATE $TAG"
elif [ "${TAG#v}" != "$FORK" ] && [ "$(printf '%s\n' "${TAG#v}" "$FORK" | sort -V | tail -1)" = "$FORK" ]; then
  echo "FORK-AHEAD fork $FORK > $TAG"
else echo "MERGE $TAG (fork $FORK)"; fi
)
```

- **A non-zero exit** (with or without a `STOP:` line) is a hard stop. Don't go on to step 2: `upstream/stable` may be missing.
- **`UP-TO-DATE`:** report that and stop.
- **`FORK-AHEAD`:** report that and stop. The fork's manifest already claims a newer version line than the latest stable release, so the fork is already on newer upstream code. The stable tag sits on an older release branch, and merging it would only bring back older version files and duplicate backports. Wait for a stable release at or above the fork's version.

On `MERGE`, use the tag's version without the `v` in the commit title. Skim `git log --oneline HEAD..upstream/stable` and that release's section of `git show upstream/stable:CHANGELOG.md` to see what's coming.

## 2. Merge and resolve

```bash
git merge --no-ff --no-commit upstream/stable
```

Resolve every conflict (`git diff --name-only --diff-filter=U`) by reading both sides and their intent (`git log --oneline HEAD...upstream/stable -- <file>`), not by picking one side mechanically:

- **Both sides built the same thing:** keep upstream's version and drop the fork's duplicate. That includes tests and e2e specs.
- **Fork behaviour upstream doesn't have:** keep it, re-applied on top of upstream's new code. That covers Claude/Codex dialog parsing, UI tweaks and the **mycroftxxx remote** branding, logo and icons. Also brand any new user-facing "Collie" strings upstream added where the fork already brands their neighbours.
- **New terminals:** the fork has no agent offer of its own any more; upstream's New tab sheet and `/new` page pick the agent. Don't bring the old belt offer (`pickAgent`) back.
- **Version files** (`package.json`, `web/package.json`, the manifest, `flake.nix`/`flake.lock`): take upstream's. The fork follows upstream's version numbers.
- **`CHANGELOG.md`:** take upstream's released sections as they are. The fork never cuts releases, so its own bullets stay under `## [Unreleased]`. Keep only the ones upstream doesn't already cover, placed under upstream's group headings.
- **`CLAUDE.md`:** take upstream's text and keep the fork-only paragraphs (fork identity, `COLLIE_UPDATE_REPO`, the Bun floor note, this skill's pointer).

Also check the merged result where git reported **no** conflict. A clean textual merge can still break things when one side renamed or moved something the other side uses.

## 3. Verify

The tests are most of a sync's time: the frontend suite is about 58,000 tests and takes about 18 minutes on this 4-core host, the backend suite about 90 seconds. **Each suite runs in full exactly once per sync, here.** After that, rerun only what failed or what a fix touched; step 5 adds no second full run.

Run the checks one at a time, never two suites at once: two suites side by side push the slow tests past their timeouts. Start each test run with the Bash tool's `run_in_background: true`, its output in a scratchpad log, and wait for the completion notice; don't poll with `sleep` or `pgrep`. Wrap the test runs in `dev-run` (memory-heavy).

```bash
bun install && (cd web && bun install)
bun run typecheck && (cd web && bun run typecheck)     # both — root doesn't cover web tests
bun run lint
dev-run -- bun run test > <scratchpad>/backend.log 2>&1
dev-run -- bash -c 'cd web && bunx vitest run --testTimeout=60000 --hookTimeout=60000' > <scratchpad>/web.log 2>&1
```

`--testTimeout`/`--hookTimeout` lift the 5-second default for tests that set no limit of their own. Keep vitest's default worker count: two workers instead of three ran the suite slower and failed no fewer tests.

Also check that `~/.bun/bin/bun --version` is still at or above `MIN_BUN` in `cli/update-check.ts`.

**A red test on this host is often load, not a bug.** A full run here ends with a few red tests even on a clean tree. Tests that set their own limit (the playground's 30-second cases, `unread-dialog`'s fixture sweep, `fold.plain`) fail at that limit whenever the host is busy. A few timing-sensitive UI tests (`wide-layout`, the update banner) fail fast under the same load. A backend failure at about 5000 ms (Bun's default limit) is the same thing. Rerun all the failed files together in one command, on one worker:

```bash
dev-run -- bash -c 'cd web && bunx vitest run --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000 <failed files>'
dev-run -- bun test <failed backend files>     # add --timeout 20000 only for a failure at ~5000 ms
```

Waive a failure as load only when both hold: it passes alone, and the original failure is a load signature, a timeout at a limit or one of the timing-sensitive tests named above, in a file the fork's delta (`git diff upstream/stable --stat`) doesn't touch. Name each waived file in the commit body. Read every other failure even if it passes alone: an assertion failure can be order-dependent state or a timing regression. Upstream publishes a release only from a commit whose CI passed, so a failure that stands is either the fork's code (`git diff upstream/stable -- <file>`), which is yours to fix, or, when the fork's diff doesn't explain it, checked on plain `upstream/stable`: run just that file in a throwaway worktree of `upstream/stable` (with its own `bun install`). If it fails the same way there, note it and don't fix it.

**The backend `test` script chains its commands with `&&`** (`package.json`), so one red `bun test` folder or script stops every command after it. Once the failure is settled, run the remaining commands of that chain, from the one after the failed one, so none goes unrun. A failed shell script reruns with its own `bash scripts/….sh`, not `bun test`.

After a fix, rerun the failed files plus the tests related to what you changed, not the full suite:

```bash
dev-run -- bash -c 'cd web && bunx vitest related --run --testTimeout=60000 --hookTimeout=60000 <changed web/ files, relative to web/>'
```

`related` follows imports, so a fix in a module many screens import selects a large part of the suite (`src/lib/nav.ts` selects 132 files, about 8 minutes, and the i18n messages nearly all of it): that is the run then. It does not see files tests read from disk (fixtures, pane captures, JSON allowlists such as `fold.plain.allow.json`), and it passes when it selects nothing. For a changed file outside the import graph, find its readers (`grep -rl <basename> web/src web/e2e`) and add those test files; check the run's `Test Files` count is not zero.

Then record the merge as a **local, unpublished** commit. `--remerge-diff` needs a commit to show the resolutions, and the commit is amended in step 5:

```bash
git add -A && git commit    # title + body in the style of 7d7e8eff
```

Write the body in the style of `git log -1 7d7e8eff`. Say what upstream brought in. List where upstream's version replaced the fork's. List which fork behaviour was kept on top.

This checkout has no git hooks installed (`core.hooksPath` is unset); don't install them. If they are ever active, the merge commit is the one legitimate `SKIP_VERSION_CHECK=1` case. The pre-commit rule that `## [Unreleased]` must be empty when the version moves is meant for upstream's release commits, not for a fork merge.

## 4. One sol review — exactly once

Make **one** Agent tool call with `subagent_type: "code-reviewer"`, `model: "sol"`. Never call it a second time, even after fixes, retries, or a new failure. Anything that comes up after this point is yours to judge alone. Put this in the prompt: the repo path, the merge commit hash, the release tag merged, the commit message, the list of files that conflicted, and this ask:

> Review how the upstream merge `<hash>` in /home/schu/collie resolved its conflicts. It merges upstream's stable release `<tag>`, fetched as `upstream/stable`. It is local and unpublished. Start with `git show --remerge-diff <hash>`, which shows exactly how each conflict was resolved. For context, `git diff upstream/stable <hash>` shows the fork's remaining delta on top of that release. Look for: fork behaviour lost or half re-applied, upstream fixes dropped or clobbered, duplicate implementations of one feature, semantic breaks in files that merged cleanly, and branding that was missed. Report findings only; don't edit.

## 5. Apply what you agree with

For each finding, decide: apply it, or reject it with a one-line reason. After the fixes, re-run both typechecks and lint, the backend suite (it is fast) and, for the frontend, step 3's `vitest related` command over the files the fixes changed, read the same way as in step 3. No full frontend run; `bun run build` in step 6 typechecks once more. Then fold the accepted fixes into the merge commit so each sync stays one commit:

```bash
git add -A && git commit --amend
git status --porcelain      # must be empty before deploying
```

In the amended body, add one line per rejected finding with its reason.

## 6. Deploy on this host

```bash
dev-run -- bun run build && collie restart
collie status && collie doctor
```

If the build, the restart or `doctor` fails, nothing has been published yet, so roll back locally. Keep the attempt on a branch, reset `main` to `origin/main`, rebuild and restart:

```bash
git branch -f sync-failed HEAD && git reset --hard origin/main
dev-run -- bun run build && collie restart
```

Then report the failure and stop. Don't push.

## 7. Push

```bash
dev-run -- git push origin main     # main only — no tags
```

Never push tags. The fork's `release.yml` runs on `v*.*.*` tags, and Actions is enabled on the fork. The native updater reads the fork's tags, so a mirrored upstream tag would advertise an upstream build without the fork's changes.

Finish with a short report: the release merged, the conflicts and how each was resolved, sol's findings (applied or rejected, with reasons), and the deploy status.

## Hard stops (report, don't force)

- Step 1 exits non-zero: a dirty tree, a failed `pull --ff-only`, fetch or release lookup, or a latest release that isn't a plain `vX.Y.Z`.
- The host Bun is below the release's `MIN_BUN`.
- Checks are still red after an honest fix attempt.
- Deploy fails (roll back as in step 6).
- The push is rejected.

Never use `--force` or `--no-verify`, never push tags, and never rebase `main`. The only `SKIP_*` hatch allowed is the one in step 3.
