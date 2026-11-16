<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/aftergreen-on-dark.svg">
    <img src="brand/aftergreen-light.svg" alt="AfterGreen" width="340">
  </picture>
  <br>Action
</h1>

**Green isn't proof. Verify what actually happened.**

A GitHub Action that checks, after your deploy job reports success, that the
deployed endpoint actually responds as expected. It is part of
[AfterGreen](https://github.com/foldnine/aftergreen), built by
[FoldNine](https://foldnine.dev).

> **Status: preview, not released.** There is no release, no `v1` tag and no
> Marketplace listing yet. Until there is, you can only use it pinned to a full
> commit SHA of this repository, at your own risk.

## What it does

One `GET` request to a URL you control, then a verdict:

| Verdict | Meaning | Step result |
| --- | --- | --- |
| `VERIFIED` | Status matched and, if set, the body contained `contains` | success |
| `FAILED` | A response was received but an assertion is false | **fails** |
| `UNKNOWN` | No trustworthy observation: connection error, timeout, truncated body, body over 1 MiB | **fails** |
| *(no verdict)* | Inputs are invalid; nothing was checked | **fails** |

`FAILED` and `UNKNOWN` both fail the job. AfterGreen never turns an unobservable
outcome into a pass.

## Usage

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      # ... your deploy ...
      - name: Verify the deployed build is live
        id: aftergreen
        uses: foldnine/aftergreen-action@<full-commit-sha>  # no released version exists yet
        with:
          url: https://app.example.com/version
          expected-status: '200'
          contains: ${{ github.sha }}   # your app must expose its build ID
          timeout-seconds: '10'
```

**HTTP 200 alone does not prove the right version is deployed.** A stale build
or a maintenance page can also return 200. Expose a unique build or version ID
(e.g. the commit SHA) on an endpoint and assert it with `contains`.

### Inputs

| Input | Default | Rules |
| --- | --- | --- |
| `url` | required | Absolute `http://` or `https://` URL. No `user:pass@`, no `#fragment`. |
| `expected-status` | `200` | Whole number, 100–599. |
| `contains` | empty | Literal, case-sensitive, byte-exact UTF-8 text. Not trimmed. |
| `timeout-seconds` | `10` | Whole number, 1–60. Covers the request *and* body read. |

`url`, `expected-status` and `timeout-seconds` are trimmed of surrounding whitespace.

### Outputs

| Output | Value |
| --- | --- |
| `verdict` | `VERIFIED`, `FAILED` or `UNKNOWN`; unset on invalid inputs |
| `observed-status` | e.g. `200`; empty if no response was received |

To react to the verdict in later steps, give the step an `id`, set
`continue-on-error: true` and read `steps.<id>.outputs.verdict`.

## Behaviour details

- **Redirects are not followed.** A `302` is reported as `302`. To accept a
  redirect, set `expected-status` to it. Check the final URL directly instead.
- **Body:** read only when `contains` is set, limited to 1 MiB after
  decompression. Larger bodies give `UNKNOWN`, unless the status already failed.
- **A wrong status always means `FAILED`**, even if the body can't be read.
- **No retries.** Add your own wait or retry loop for slow rollouts.
- **No auth headers yet.** Credentials in the URL are rejected.
- **Proxies:** `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` are honoured on Node
  24.14+ runners.
- **Blocked ports:** Node's `fetch` refuses the WHATWG "bad ports" list (e.g.
  22, 25, 6000, 6665–6669). Requests to them return `UNKNOWN`.
- Runs on Linux, macOS and Windows runners (`node24`; self-hosted runner ≥ v2.328.0).
  No dependencies, no network calls other than the URL you give, no telemetry,
  no AfterGreen account or server.

## Security

- **Only use URLs controlled by repository maintainers.** This Action makes a
  network request from your runner. It is **not** an SSRF defence. Never build
  `url` from pull-request titles, branch names, issue text or other
  attacker-controlled input, especially in `pull_request_target` workflows.
- It does not block private or internal addresses. On self-hosted runners it can
  reach anything the runner can.
- This Action's logs, annotations and job summary never print the URL, the
  response body or the `contains` value. **GitHub itself prints every `with:`
  value in the step header**, though. If the URL or expected text contains a
  token, pass it from `secrets.*` so the runner masks it:
  `url: ${{ secrets.VERSION_ENDPOINT_URL }}`.
- The Action needs no token and no permissions. Grant your job the least it
  needs (`permissions: contents: read`).
- Report vulnerabilities via GitHub's private vulnerability reporting on
  [foldnine/aftergreen](https://github.com/foldnine/aftergreen/security).

## Relationship to the AfterGreen CLI

This Action is a standalone Node 24 implementation of the CLI's
`aftergreen http` check. Its behaviour is pinned to the Go engine by the shared
conformance cases in [`test/conformance/`](test/conformance/). CI fails if the
vendored copy drifts from the core repository. Known differences: the Action
takes whole-second timeouts and enforces fetch's blocked-port list. The CLI
exits `3` for `UNKNOWN`; the Action fails the step.

## Development

```bash
node --test test/*.test.mjs   # unit, entrypoint and conformance tests; local fixtures only
```

Requires Node 24. No `npm install`. See [RELEASING.md](RELEASING.md) for the
release process.

`main` is protected by a ruleset: pull requests only, no force pushes or deletion, and the
`test (ubuntu-latest)`, `test (macos-latest)`, `test (windows-latest)` and
`conformance-sync` checks must pass. If you rename a CI job, update the ruleset too.

## License

Apache-2.0. See [LICENSE](LICENSE).
