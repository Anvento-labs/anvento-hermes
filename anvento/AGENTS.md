# anvento/ — Anvento fork rules

Applies on top of the root `AGENTS.md`. This repo is Anvento's fork of NousResearch/hermes-agent
(`origin` = Anvento-labs/anvento-hermes, `upstream` = Nous). The fork must keep merging upstream
with zero conflicts, so these rules decide where Anvento work goes.

## 1. Never edit upstream-owned files

Only `anvento/` is ours. Every other path belongs to upstream: an edit there is a future merge
conflict. Upstream's own rule is the same one: plugins never touch core (`plugins/AGENTS.md`).
Check with `git status`: changes appear only under `anvento/`.

## 2. Customisation ladder (take the highest rung that works)

1. **Config** in `$HERMES_HOME/config.yaml` (dev: `~/.hermes-dev`). For Slack: the `slack:` block,
   `platforms.slack.extra.*`, `channel_prompts`, `channel_skill_bindings`,
   `platforms.slack.channel_overrides` (per-channel model / system prompt). Persona: `SOUL.md`,
   `personalities`. Reference: `website/docs/user-guide/messaging/slack.md`.
2. **Skill** in `anvento/skills/<name>/SKILL.md`, wired with
   `skills.external_dirs: [<repo>/anvento/skills]`.
3. **Plugin** in `anvento/plugins/<name>/` (`plugin.yaml` + `register(ctx)` in `__init__.py`), wired with
   `ln -s <repo>/anvento/plugins $HERMES_HOME/plugins/anvento` and
   `hermes plugins enable anvento/<name>`. Slack and gateway seams: `pre_gateway_dispatch` and
   `post_gateway_admission` hooks, `ctx.register_command`, `ctx.register_slack_action_handler`,
   `transform_llm_output`, `ctx.register_system_prompt_section`.
   Guide: `website/docs/developer-guide/plugins/index.md`.
4. **Last resort:** replace `SlackAdapter` with `ctx.register_platform(name="slack", ...)`. That
   imports upstream internals, which sit outside the plugin compat contract, so expect it to break
   on upstream refactors.

If a hook we need is missing, open an issue or PR **upstream**; don't patch core here.

## 3. Plugins use `ctx` and the documented ABCs only

Never import internal module paths. Upstream moves them without shims, so such imports break
silently on the next merge.

## 4. Syncing upstream

```bash
git fetch upstream
git merge upstream/main     # on main; merge, not rebase: main is published to origin
hermes plugins doctor anvento/plugins/<name> --ci   # each of our plugins still loads
git push origin main
```

## 5. Secrets and behaviour

Tokens go only in `$HERMES_HOME/.env`, never in the repo. Behaviour goes in `config.yaml`.

## 6. Running and testing

- Run this checkout through `anvento/launch-hermes.sh <args>` (isolated `~/.hermes-dev`; see
  `documentation/local-setup.md`).
- Run tests with `scripts/run_tests.sh`, never bare `pytest`.
