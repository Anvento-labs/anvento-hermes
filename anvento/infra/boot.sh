#!/bin/bash
# Runs as root on EVERY boot (see app.ts). A reboot = a redeploy: pull main, sync deps, refresh
# config and secrets, restart the gateway. Output lands in the EC2 system log; the last line is
# "hermes-boot: OK <sha>" or "hermes-boot: FAILED ...".
set -euo pipefail
trap 'echo "hermes-boot: FAILED at line $LINENO"' ERR

REPO_URL=https://github.com/Anvento-labs/anvento-hermes.git
HH=/home/hermes/.hermes
REPO=$HH/hermes-agent

if ! id hermes >/dev/null 2>&1; then
  # 2 GB of RAM: swap absorbs the one-time app build and memory spikes.
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  apt-get -o DPkg::Lock::Timeout=300 update
  apt-get -o DPkg::Lock::Timeout=300 install -y docker.io git curl libatomic1
  snap wait system seed.loaded
  snap install aws-cli --classic
  useradd -m -s /bin/bash -G docker hermes
  sudo -u hermes mkdir -p "$HH"
  sudo -u hermes git clone "$REPO_URL" "$REPO"
fi

# The upstream installer is idempotent: fetch + fast-forward main, then deps and products.
sudo -iu hermes HERMES_REPO_URL="$REPO_URL" bash "$REPO/scripts/install.sh" --non-interactive --skip-browser --skip-computer-use

# Behaviour from the repo, secrets from Secrets Manager. Edits made on the box are overwritten.
install -o hermes -g hermes -m 600 "$REPO/anvento/infra/hermes-config.yaml" "$HH/config.yaml"
(umask 077
 aws secretsmanager get-secret-value --region us-east-1 --secret-id anvento-hermes/env --query SecretString --output text \
   | python3 -c 'import json, sys; print("".join(f"{k}={v}\n" for k, v in json.load(sys.stdin).items()), end="")' > "$HH/.env")
chown hermes:hermes "$HH/.env"

# Pre-pull so the first command from Slack doesn't wait on a multi-GB download.
docker pull nousresearch/hermes-sandbox:desktop

# Installed once, never enabled: only this script starts it, after the update above.
unit() { systemctl list-unit-files --no-legend 'hermes-gateway*.service' | awk '{print $1; exit}'; }
if [ -z "$(unit)" ]; then
  HERMES_HOME=$HH /home/hermes/.local/bin/hermes gateway install --system --run-as-user hermes --no-start-now --no-start-on-login
  chown -R hermes:hermes "$HH"
fi
systemctl restart "$(unit)"

echo "hermes-boot: OK $(sudo -u hermes git -C "$REPO" rev-parse --short HEAD) unit=$(unit)"
