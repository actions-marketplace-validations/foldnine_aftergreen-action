# Releasing the AfterGreen Action

Nothing in this file has been done yet. Every step that creates a tag, a
release or a Marketplace listing needs explicit owner approval.

## Versioning policy

- Semantic versions: `v1.0.0`, `v1.0.1`, `v1.1.0`. Breaking input/output or
  verdict changes need a new major version.
- **Exact versions are immutable.** Enable *immutable releases* in repository
  settings before the first release. A published `vX.Y.Z` tag can then never be
  moved, deleted or reused.
- **`v1` is a moving convenience tag, never a release.** It points to the
  latest `v1.x.y` commit. Immutable releases lock only tags that have a release,
  so `v1` stays movable.
- Users should pin a full commit SHA (with a `# v1.0.0` comment).
  Documentation shows SHA pinning first, `@v1` second.

## Pre-release checklist

1. `main` CI is green on all three OSes, including the `conformance-sync` job.
2. `test/conformance/SOURCE` points to a commit on `foldnine/aftergreen` `main`,
   not a PR branch.
3. README contains no claim about unimplemented features. Remove the "not
   released" banner in the same PR that prepares the release.
4. A **consumer smoke test** passes in a separate repository, using the exact
   release commit SHA. It must cover VERIFIED, FAILED and UNKNOWN; see the
   assertion step in `.github/workflows/ci.yml` for a template.
5. `action.yml`: `name` is still unique on Marketplace, `description` is short,
   and `branding` uses a Feather icon and an allowed color.

## Release steps (owner)

```bash
git switch main && git pull --ff-only
git tag -s v1.0.0 -m "v1.0.0"       # signed annotated tag
git push origin v1.0.0
```

1. On GitHub: *Releases → Draft a new release → tag `v1.0.0`*.
2. Tick **Publish this Action to the GitHub Marketplace**. This needs 2FA and an
   org owner's acceptance of the GitHub Marketplace Developer Agreement.
   Choose primary category *Deployment* (secondary: *Testing*). Resolve any
   metadata warnings shown.
3. Publish. Then move the major tag:
   ```bash
   git tag -f v1 v1.0.0^{commit} && git push -f origin v1
   ```
4. Run the consumer smoke workflow against `@v1.0.0`, `@v1` and the SHA.

## Rollback

Exact tags are immutable, so a bad `v1.0.1` is never edited or replaced.

1. Move `v1` back to the last good release:
   `git tag -f v1 v1.0.0^{commit} && git push -f origin v1`.
2. Ship the fix as `v1.0.2`.
3. Mark the bad release in its release notes and, if security-relevant, publish
   a GitHub Security Advisory.

## Marketplace requirements (checked 2026-11-15)

Sources: the docs.github.com pages *Publishing actions in GitHub Marketplace*,
*Metadata syntax*, and *Using immutable releases and tags*.

- Public repository containing a single action, with `action.yml` at the root.
- Unique `name`. It must not match an existing Marketplace action, a category,
  a GitHub user or org (other than the publisher), or a GitHub feature. A search
  for "aftergreen" found no existing listings.
- Publishing happens through a GitHub Release with the Marketplace checkbox
  ticked. There is no manual review.
- `runs.using: node24` needs runner v2.328.0+. node20 was removed from hosted
  runners on 2026-09-23.
