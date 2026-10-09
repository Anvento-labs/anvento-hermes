#!/usr/bin/env bash
# Launch this checkout's Hermes with its own isolated state (leaves ~/.hermes and ~/.local/bin/hermes alone).
# Usage: anvento/launch-hermes.sh [hermes args...]   e.g. setup | --tui | gateway | doctor
set -e
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export HERMES_HOME="${HERMES_HOME:-$HOME/.hermes-dev}"
export HERMES_RUNTIME_DIR="${HERMES_RUNTIME_DIR:-$HOME/.hermes-dev-runtime}"
cd "$REPO"
source ./activate >&2
hermes "$@"
