---
name: sync-upstream
description: Merge upstream AltanS/collie into the fork's main, resolve conflicts, get exactly one astra review, apply agreed fixes, then commit, deploy and push. Use when asked to sync, update from, or merge upstream.
disable-model-invocation: true
---

# Sync the fork with upstream

The fork (`origin` = schugazi/collie) takes upstream (`upstream` = AltanS/collie) by **merge, never rebase**: `origin/main` is published and deployed, so its history is never rewritten. One merge commit per sync, titled `Merge upstream AltanS/collie through <version>`. Run everything from the repo root. You decide conflicts yourself; only stop for the hard stops listed at the end. Nothing is published until the last step: the merge stays local until it has been reviewed, fixed and deployed on this host.

## 1. Prepare

```bash
git switch main && git status --porcelain      # must be empty; stop if not
git pull --ff-only origin main
git fetch upstream                             # branches only — never mirror upstream's tags
git merge-base --is-ancestor upstream/main HEAD && echo UP-TO-DATE
```

If that prints `UP-TO-DATE`, report that and stop. Otherwise note `git describe --tags upstream/main` for the commit title, and skim `git log --oneline HEAD..upstream/main` plus upstream's `CHANGELOG.md` to see what's coming.

## 2. Merge and resolve

```bash
git merge --no-ff --no-commit upstream/main
```

Resolve every conflict (`git diff --name-only --diff-filter=U`) by reading both sides and their intent (`git log --oneline HEAD...upstream/main -- <file>`), not by picking one side mechanically:

- **Both sides built the same thing:** keep upstream's version and drop the fork's duplicate. That includes tests and e2e specs.
- **Fork behaviour upstream doesn't have:** keep it, re-applied on top of upstream's new code. That covers Claude/Codex dialog parsing, UI tweaks and the **mycroftxxx remote** branding, logo and icons. Also brand any new user-facing "Collie" strings upstream added where the fork already brands their neighbours.
- **Version files** (`package.json`, `web/package.json`, the manifest, `flake.nix`/`flake.lock`): take upstream's. The fork follows upstream's version numbers.
- **`CHANGELOG.md`:** take upstream's released sections as they are. The fork never cuts releases, so its own bullets stay under `## [Unreleased]`. Keep only the ones upstream doesn't already cover, placed under upstream's group headings.
- **`CLAUDE.md`:** take upstream's text and keep the fork-only paragraphs (fork identity, `COLLIE_UPDATE_REPO`, the Bun floor note, this skill's pointer).

Also check the merged result where git reported **no** conflict. A clean textual merge can still break things when one side renamed or moved something the other side uses.

## 3. Verify

Repeat until everything is green (memory-heavy, so wrap in `dev-run`):

```bash
bun install && (cd web && bun install)
bun run typecheck && (cd web && bun run typecheck)     # both — root doesn't cover web tests
bun run lint
dev-run -- bun run test
dev-run -- bash -c 'cd web && bun run test'
```

Also check that `~/.bun/bin/bun --version` is still at or above `MIN_BUN` in `cli/update-check.ts`. A failing test that the fork's own code (`git diff upstream/main -- <file>`) caused is yours to fix. If it fails the same way on plain `upstream/main`, note it and don't fix it.

Then record the merge as a **local, unpublished** commit. `--remerge-diff` needs a commit to show the resolutions, and the commit is amended in step 5:

```bash
git add -A && git commit    # title + body in the style of 7d7e8eff
```

Write the body in the style of `git log -1 7d7e8eff`. Say what upstream brought in. List where upstream's version replaced the fork's. List which fork behaviour was kept on top.

This checkout has no git hooks installed (`core.hooksPath` is unset); don't install them. If they are ever active, the merge commit is the one legitimate `SKIP_VERSION_CHECK=1` case. The pre-commit rule that `## [Unreleased]` must be empty when the version moves is meant for upstream's release commits, not for a fork merge.

## 4. One astra review — exactly once

Make **one** Agent tool call with `subagent_type: "code-reviewer"`, `model: "astra"`. Never call it a second time, even after fixes, retries, or a new failure. Anything that comes up after this point is yours to judge alone. Put this in the prompt: the repo path, the merge commit hash, the commit message, the list of files that conflicted, and this ask:

> Review how the upstream merge `<hash>` in /home/schu/collie resolved its conflicts. It is local and unpublished. Start with `git show --remerge-diff <hash>`, which shows exactly how each conflict was resolved. For context, `git diff upstream/main <hash>` shows the fork's remaining delta on top of upstream. Look for: fork behaviour lost or half re-applied, upstream fixes dropped or clobbered, duplicate implementations of one feature, semantic breaks in files that merged cleanly, and branding that was missed. Report findings only; don't edit.

## 5. Apply what you agree with

For each finding, decide: apply it, or reject it with a one-line reason. Re-run all of step 3's checks. Then fold the accepted fixes into the merge commit so each sync stays one commit:

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

Finish with a short report: the version merged, the conflicts and how each was resolved, astra's findings (applied or rejected, with reasons), and the deploy status.

## Hard stops (report, don't force)

- The working tree is dirty at the start, or `pull --ff-only` fails.
- The host Bun is below upstream's new `MIN_BUN`.
- Checks are still red after an honest fix attempt.
- Deploy fails (roll back as in step 6).
- The push is rejected.

Never use `--force` or `--no-verify`, never push tags, and never rebase `main`. The only `SKIP_*` hatch allowed is the one in step 3.
