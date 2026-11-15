# AfterGreen Action

**Green isn't proof. Verify what actually happened.**

Open-source GitHub Action for post-deploy HTTP outcome verification. Built by [FoldNine](https://foldnine.dev).

> **Preview — not released:** There is no `v1` tag or Marketplace listing yet. This public Action is self-contained and uses Node 24; it does not require access to our private Go repository.

## Planned usage

```yaml
name: Verify deployment
on: workflow_dispatch
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: foldnine/aftergreen-action@v1 # Future release, not available yet
        with:
          url: https://app.example.com/version
          expected-status: '200'
          contains: 'abc123'
          timeout-seconds: '10'
```

AfterGreen returns `VERIFIED` when the destination matches your expectation, `FAILED` when it doesn't, and `UNKNOWN` if observation is unavailable. The job fails on both FAILED and UNKNOWN. Two step outputs are exposed: `verdict` and `observed-status`.

| Input | Required | Default | Purpose |
| --- | --- | --- | --- |
| `url` | Yes | — | Trusted HTTP(S) URL |
| `expected-status` | No | `200` | Expected status |
| `contains` | No | Empty | Literal required response substring |
| `timeout-seconds` | No | `10` | Timeout: 1–60 seconds |

Redirects are not followed. Bodies are read only when a substring assertion is configured and limited to 1 MiB. Credentials in URLs are rejected; response contents and URLs are not printed.

### Security and limitations

- **Trusted endpoints only.** This is not an SSRF boundary for untrusted URLs. Never use PR, issue or other attacker-supplied content as the target.
- A successful HTTP 200 does not independently prove that the right version was deployed; assert a unique build/version identifier.
- The runner needs network access to the endpoint. Do not expose sensitive internal endpoints to untrusted workflows.
- No auth headers, automatic retries, n8n integration or contracts yet.
- The Action temporarily implements the same HTTP status/body contract in Node; reuse of the Go core requires public, verifiable binaries later.

## Development

```bash
node --test test/*.test.mjs
```

No runtime dependencies are required. Releases will be published only after CI and security review.

## License

Apache-2.0. See `LICENSE`.
