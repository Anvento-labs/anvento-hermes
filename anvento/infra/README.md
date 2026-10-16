# Hermes on AWS (EC2 + CDK)

One `t4g.small` Ubuntu box in us-east-1 runs the Hermes Slack gateway (Socket Mode, outbound only,
no inbound ports). Shell commands from Slack run in a Docker sandbox that can't see `.env` or the
instance role. Bedrock is reached through the instance role.

| File | What it is |
|---|---|
| `app.ts` | The whole stack: VPC (public subnet, no NAT), security group (no ingress), secret, IAM, instance |
| `boot.sh` | User data, run on **every boot**: pull `main`, install, write config + `.env`, start the gateway |
| `hermes-config.yaml` | The box's `config.yaml` (behaviour only, no secrets) |
| `../SOUL.md` | The bot's persona (Anvento Bot), kept in `anvento/` because it isn't AWS-specific. Copied to `$HERMES_HOME/SOUL.md` on every boot; it applies to new sessions (`!new`) |

## Deploy (first time, or after changing `app.ts` / `boot.sh`)

```bash
cd anvento/infra && npm install
npx cdk deploy --profile discoverITlabs
```

The box clones this repo from GitHub, so push `anvento/infra/` to `main` first. Changing `boot.sh`
or `app.ts` stops and starts the box, and `boot.sh` reruns. Only a new AMI ID or VPC/subnet change
**replaces** it. The root volume is kept on termination, so state survives, but a replacement starts
a fresh disk.

## Slack tokens

Use a **separate Slack app** from the Mac dev bot: two gateways on one app split events between them.

1. Create the app from a manifest (`anvento/launch-hermes.sh slack manifest --agent-view`), then
   install it and create an app-level token with `connections:write`.
2. In AWS console → Secrets Manager → `anvento-hermes/env` → Retrieve secret value → Edit, fill in
   `SLACK_BOT_TOKEN` (`xoxb-…`) and `SLACK_APP_TOKEN` (`xapp-…`). Every key in the secret lands in
   the box's `.env`. `SLACK_ALLOW_ALL_USERS=true` lets every workspace member chat. There is no global
   `allow_all_users` in `hermes-config.yaml`, because it would also open email to any sender.
3. Reboot the box.

**Changing the key list in `app.ts` resets every value on the next deploy, tokens included.** Add
optional keys in the console instead, and paste the tokens again after any such deploy.

## Email

The upstream email adapter (`website/docs/user-guide/messaging/email.md`) checks a dedicated
Google Workspace mailbox over IMAP and replies over SMTP, in the same gateway as Slack.

1. Create a dedicated mailbox, turn on 2-Step Verification for it, then create an
   [app password](https://myaccount.google.com/apppasswords).
2. Fill in the pre-created keys in the secret `anvento-hermes/env`. The IMAP and SMTP hosts are
   already set to Gmail's.

   | Key | Value |
   |---|---|
   | `EMAIL_ADDRESS` | the mailbox address |
   | `EMAIL_PASSWORD` | the app password |
   | `EMAIL_ALLOWED_USERS` | comma-separated sender addresses (**required**: whole addresses, no domain wildcards) |

3. Reboot the box.

Email is off while `EMAIL_ADDRESS` is empty; to pause it, clear that value and reboot. Hermes answers
only mail that arrives after it starts, and marks new mail as read, including mail from senders
it ignores. It drops any message whose `From:` Google didn't authenticate (`authserv_id` in
`hermes-config.yaml`). It ignores mail from its own address. Any sender on the list can make the
bot run shell commands in the sandbox, the same as on Slack.

## Redeploy (code or `hermes-config.yaml`)

Push to `main`, then reboot:

```bash
aws ec2 reboot-instances --profile discoverITlabs --region us-east-1 --instance-ids <InstanceId output>
```

The first boot takes about 10–15 minutes; later boots take a few. To check progress, use EC2 console →
instance → Actions → Monitor and troubleshoot → Get system log, or:

```bash
aws ec2 get-console-output --latest --output text --profile discoverITlabs --region us-east-1 --instance-id <id> | grep hermes-boot
```

`hermes-boot: OK <sha>` means the gateway started on that commit; `hermes-boot: FAILED at line N`
points into `boot.sh`.

## Shell and logs (Session Manager, no SSH)

```bash
aws ssm start-session --target <InstanceId> --profile discoverITlabs --region us-east-1
sudo -iu hermes
journalctl -u 'hermes-gateway*' -n 200      # service log
tail -n 100 ~/.hermes/logs/errors.log       # also gateway.log, agent.log
cat ~/.hermes/gateway_state.json            # platforms.slack.state should be "connected"
```

Redeploy without a reboot: `sudo bash /var/lib/cloud/instance/scripts/part-002` reruns `boot.sh`.

## Not set up (yet)

- CI auto-deploy and a CloudWatch agent.

Cost is about $19/month (instance, public IPv4, 30 GB disk, the secret), plus Bedrock usage.
