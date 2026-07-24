# Releasing itinly

How a new version of itinly ships, and why the process looks the way it does.

---

## TL;DR

1. Open a `preview → main` PR.
2. Title it `feat: release vX.Y.Z`.
3. Inside that PR, bump `package.json` + `apps/web/package.json` to `X.Y.Z`.
4. Add the release notes (markdown + in-app page).
5. **Squash-merge.**
6. CI tags the commit `vX.Y.Z` and Vercel deploys it with the right version baked in.

Direct-to-main fixes between releases do **not** bump the version. They land at whatever the current version is, get deployed normally, and roll up into the next release.

---

## Why this shape

The auto-bump workflow we had before created a separate `chore: bump version X.Y.Z [skip ci] [skip-deploy]` commit AFTER each merge to main. Vercel's `ignoreCommand` skipped that commit, so the build that actually went to production carried the **previous** version in `NEXT_PUBLIC_APP_VERSION` (read from `package.json` at build time). Result: the UserMenu showed v1.2.0 while `/release-notes` said v1.3.0.

The fix is to put the version bump in the same squash commit as the release content, so Vercel's normal build picks it up:

- One commit on `main` that contains code + release notes + bumped `package.json`.
- Vercel deploys it. `NEXT_PUBLIC_APP_VERSION` reflects the released version.
- The Release Tag workflow (`.github/workflows/version-bump.yml`) sees the `feat: release vX.Y.Z` subject and pushes a `vX.Y.Z` tag. That's its only job — no more bump commits.

---

## Picking the next version

Semver, by hand:

- **Major (X.0.0)** — breaking schema migration that can't be reverted, removed user-facing feature, or a breaking API change.
- **Minor (X.Y.0)** — new feature, new endpoint, new migration that's backward-compatible.
- **Patch (X.Y.Z)** — fixes, polish, internal cleanup. Rare as a standalone release; usually rolled into the next minor.

Most releases are minor — they accumulate several `feat:` PRs from `preview`.

---

## Step-by-step

### 1. Decide what's in the release

Run `git log --oneline origin/main..origin/preview` to list everything that'll ship. Skim the titles — anything user-facing needs to show up in the release notes.

### 2. Open the release PR

```bash
gh pr create --base main --head preview --title "feat: release vX.Y.Z"
```

The title MUST start with `feat: release v` followed by the semver version. The Release Tag workflow keys off this pattern.

### 3. Bump `package.json` in the PR

Inside the release PR (push a commit to `preview` or to a branch you'll merge into `preview` first):

```bash
node -p "require('./package.json').version"           # confirm current
# Edit both files manually OR:
npm version X.Y.Z --no-git-tag-version --workspaces false
(cd apps/web && npm version X.Y.Z --no-git-tag-version --allow-same-version)
git add package.json apps/web/package.json
git commit -m "chore: bump version to X.Y.Z"
```

Both files have to match — `apps/web/package.json` is what the build embeds into `NEXT_PUBLIC_APP_VERSION` for the UserMenu, and the root is what the Release Tag workflow's sanity check reads.

### 4. Write the release notes

Two surfaces, both required:

- `release-notes.md` — canonical markdown. Add a `# itinly vX.Y.Z` section at the top.
- `apps/web/src/app/release-notes/page.tsx` — in-app page. Add a `<section>` at the top of the article. Keep the same structure as the prior release.

Both should hit the same topics in the same order so they're easy to diff.

Update the README's "future ideas" list if anything moved to shipped.

### 5. Confirm CI is green, then squash-merge

**Squash-merge, not merge commit.** The Release Tag workflow checks the head commit subject; a merge commit subject is `Merge pull request #N from ...` which won't match.

After merge:
- Vercel deploys the squash commit. UserMenu shows the new version.
- Release Tag workflow extracts `vX.Y.Z` from the commit subject, verifies `package.json` matches, pushes a git tag.
- GitHub UI's Releases page picks up the tag.

### 6. Verify

- Open https://itinly.app — UserMenu version should show `vX.Y.Z`.
- Open https://itinly.app/release-notes — top section should be `vX.Y.Z`.
- `git tag` on `main` should include `vX.Y.Z`.

If the Release Tag workflow failed (mismatch between `package.json` and the commit subject), check the workflow run log, fix the inconsistency on a follow-up commit, and the next push to `main` will re-fire it.

---

## Direct-to-main hotfixes

Sometimes a fix needs to ship without waiting for the next release. Open the PR directly against `main`, **do not** bump the version, and squash-merge.

- Vercel deploys it. Production gets the fix.
- The version stays the same. The fix shows up in the next release's notes alongside everything else.

This means main can sit at, say, v1.3.0 for a while as fixes accumulate, then jump straight to v1.4.0 when the next preview→main release lands. That's fine — the version reflects shipped features, not patch number.

---

## Why not auto-bump anymore?

Two reasons:

1. **The bump commit didn't deploy.** Vercel's `ignoreCommand` skipped `chore: bump version` commits, so the version embedded in the production build was always one behind the tag.
2. **Direct-to-main bumps were misleading.** Each direct fix would auto-bump the version (e.g. 1.2.0 → 1.2.1) without any release notes for that version. We ended up with phantom v1.3.0 and v1.4.0 versions on main that were never real releases — confusing on its own, and it broke the v1.3.0 release PR's bump arithmetic.

Both problems go away if releases are explicit (one squash commit, one tag) and direct fixes don't touch the version.

---

## The Release Tag workflow

`.github/workflows/version-bump.yml` (kept under the old filename for git-history continuity) runs only on commits whose subject starts with `feat: release v`. It:

1. Extracts `vX.Y.Z` from the commit subject.
2. Verifies `package.json` says the same `X.Y.Z` (fails loudly otherwise).
3. Pushes a `vX.Y.Z` git tag.

That's it. No commit is created, no file is edited, no follow-up deploy is triggered.
