# Hermes on AWS (EC2 + CDK)

One `t4g.small` Ubuntu box in us-east-1 runs the Hermes Slack gateway (Socket Mode, outbound only,
no inbound ports). Shell commands from Slack run in a Docker sandbox that can't see `.env` or the
instance role. Bedrock is reached through the instance role.

| File | What it is |
|---|---|
| `app.ts` | The whole stack: VPC (public subnet, no NAT), security group (no ingress), secret, IAM, instance |
| `boot.sh` | User data, run on **every boot**: pull `main`, install, write config + `.env`, start the gateway |
| `hermes-config.yaml` | The box's `config.yaml` (behaviour only, no secrets) |

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
2. In AWS console → Secrets Manager → `anvento-hermes/env` → Retrieve secret value → Edit, set
   `SLACK_BOT_TOKEN` (`xoxb-…`) and `SLACK_APP_TOKEN` (`xapp-…`). Any other key added there also
   lands in the box's `.env`.
3. Reboot the box.

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

## Not set up (yet)

- **Shell or logs on the box.** The `anvento-devs` IAM group has no SSM permissions. Once it does,
  add `AmazonSSMManagedInstanceCore` to the instance role and use
  `aws ssm start-session --target <id>`. Logs are in `journalctl -u 'hermes-gateway*'` and
  `/home/hermes/.hermes/logs/`.
- **CI auto-deploy and a CloudWatch agent.**

Cost is about $19/month (instance, public IPv4, 30 GB disk, the secret), plus Bedrock usage.
