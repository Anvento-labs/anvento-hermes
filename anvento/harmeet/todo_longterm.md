# Slack: long-term backlog

Done now: people chat with Hermes in Slack (DM or @mention) on the dev checkout. That uses the
upstream Slack plugin (`plugins/platforms/slack/`) and needs config only, no code. The options below
are deferred. Where any code goes is decided by `anvento/AGENTS.md`.

## 1. Hermes acts on Slack (reads, searches, posts as part of tasks)

- **Exists:** posting. The built-in `send_message` tool posts to Slack channels, even without the
  gateway running.
- **Missing:** reading channel history and searching messages. The bot only sees messages sent to it.
- **Approach:** add a Slack MCP server under `mcp_servers` in `config.yaml`. No core code, no plugin.
  It needs a Slack *user* token with read scopes (`search:read`, `channels:history`,
  `groups:history`).
- **Decide first:** which MCP server to trust (Slack's official one or a community one), and whose
  user token the agent acts as.
- **Effort:** small (config plus a token).

## 2. Custom Anvento behaviour

- **Branding:** set the app name, description and icon. Use
  `anvento/launch-hermes.sh slack manifest --agent-view --long-description-file <file> --write`,
  then paste the result into the app's manifest page. Config only.
- **Per-channel behaviour (config only):**
  - `channel_prompts`: an extra prompt for each channel.
  - `channel_skill_bindings`: skills loaded for each channel.
  - `platforms.slack.channel_overrides`: model and system prompt for each channel.
  - `SLACK_ALLOWED_CHANNELS` / `SLACK_FREE_RESPONSE_CHANNELS`: where the bot listens, and where it
    replies without an @mention.
- **New behaviour,** such as a custom slash command, routing, or calls into internal tools: build it
  as a plugin in `anvento/plugins/<name>/` (`AGENTS.md` rung 3).
- **Known caveat:** `ctx.register_platform_handler("slack", ...)` hands a plugin the Bolt app, but
  plugin `app.event(...)` listeners never fire. Core registers a catch-all event listener first
  (`plugins/platforms/slack/adapter.py:1631-1663`). `action`, `command`, `view` and `shortcut` IDs do
  work. For message-level logic, use the `pre_gateway_dispatch` / `post_gateway_admission` hooks
  instead.
- **Effort:** depends on the feature. Config items take minutes; a plugin takes days.

## 3. Always-on deployment

- **Today:** the bot is online only while `anvento/launch-hermes.sh gateway` runs in a terminal.
- **Approach:** run this checkout on a host (a VM or a Mac mini) and register it as a service with
  `hermes gateway install`. Socket Mode makes outbound connections only, so no public URL or
  firewall change is needed.
- **Decide first:** which host, where its `.env` secrets live, and how it pulls new commits.
- **Effort:** about half a day.
- **Target:** AWS (decided). Use a **separate Slack app** for AWS. Two gateways sharing one app's
  Socket Mode connection split events and double-post cron messages; CRWD learned this the hard way.
- **Harden before going live:** the dev setup uses `SLACK_ALLOW_ALL_USERS=true` with full tools, so any
  workspace member can run shell commands and click Approve. On AWS:
  - set `terminal.backend: docker` so commands run in a container, not on the host;
  - keep `allow_admin_from` / `group_allow_admin_from`;
  - consider limiting `platform_toolsets.slack`;
  - work through the checklist at `website/docs/user-guide/security.md` § Gateway Deployment Checklist.

## 4. Merge Slack into the existing `~/.hermes` install

- **What:** one gateway serving Discord, Chatwoot and Slack.
- **Trade-off:** that install runs upstream Hermes, not this fork, so Anvento plugins wouldn't
  apply there. Only worth doing if the fork never carries custom code.
- **Effort:** minutes (`hermes gateway setup` → Slack on that install).
