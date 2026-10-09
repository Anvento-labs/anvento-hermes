# Local Setup Summary

Fork of [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent), kept at `origin` = `Anvento-labs/anvento-hermes`; `upstream` = the Nous repo.

## Isolation from the existing Hermes install

This Mac already has another Hermes install (`~/.hermes`, with `~/.local/bin/hermes` pointing at another project's venv). This checkout is kept fully separate:

| | Existing install | This checkout |
|---|---|---|
| State (`HERMES_HOME`) | `~/.hermes` | `~/.hermes-dev` |
| Runtime tools (`HERMES_RUNTIME_DIR`) | n/a | `~/.hermes-dev-runtime` (Python 3.14.7, node, uv, ffmpeg) |
| `hermes` command | `~/.local/bin/hermes` | shell function, only while activated |

`setup-hermes.sh` was deliberately **not** used directly: it publishes a launcher to `~/.local/bin` and edits shell rc files, which would overwrite the existing `hermes` command. `source ./activate` runs setup with `--runtime-only`, which skips both.

## Activate (bash only; the script does not run under zsh)

```bash
cd <repo> && export HERMES_HOME=$HOME/.hermes-dev HERMES_RUNTIME_DIR=$HOME/.hermes-dev-runtime && source ./activate
```

`hermes` then runs this checkout and refuses to run outside the repo. `deactivate` restores the previous shell state.

## Verified

- `hermes --version` from this checkout: Python 3.14.7, up to date.
- `~/.hermes` and `~/.local/bin/hermes` unchanged.

## Not done

- Test suite / `python scripts/check` not run (tests need the separate test environment in `CONTRIBUTING.md`).
- Always use `scripts/run_tests.sh`, never bare `pytest`.

## LLM provider: AWS Bedrock

Configured in `~/.hermes-dev/config.yaml` (this setup only; no secrets in it):

```yaml
model:
  provider: "bedrock"
  default: "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
bedrock:
  region: "us-east-1"
  profile: "discoverITlabs"
```

- AWS profile `discoverITlabs` (account `411807801668`) lives in `~/.aws/credentials` / `~/.aws/config`; Hermes reads it via the standard AWS credential chain. The `default` profile (other account) is not used by this project.
- Launch: `anvento/launch-hermes.sh` (e.g. `chat -q "hi"`, `--tui`).
- Verified: one-line chat returned a reply through Bedrock.
