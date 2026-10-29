#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: brings the container up to what the repo
# expects (README "Getting started"), so lint, typecheck, codegen and DB-backed tests all run.
#
#   1. Node from .node-version (the image ships an older one)
#   2. yarn install (Yarn itself comes from .yarnrc.yml's yarnPath, so no corepack needed)
#   3. Postgres 18 via the repo's docker/docker-compose.dev.yml (the image's apt Postgres is 16,
#      too old for the migrations, which need uuidv7())
#   4. migrations, codegen (GraphQL + SQL) and build:tools (needed by the server typecheck)
#
# DB settings go to $CLAUDE_ENV_FILE instead of a .env file (the repo's .env.template defaults).
# If Docker can't start or the migrations fail, the DB steps are skipped with a warning and
# GraphQL-only codegen runs, so the rest of the session still works.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# A SessionStart hook's stdout is added to Claude's context, so the commands' output (tens of KB
# of yarn and build logs) goes to a log file instead. Only a short summary reaches stdout (fd 3);
# on failure, the log's tail goes to stderr (fd 4), which is what a failed hook shows.
LOG_FILE="${TMPDIR:-/tmp}/accounter-session-start.log"
exec 3>&1 4>&2 > "$LOG_FILE" 2>&1
trap 'status=$?; if [ "$status" -ne 0 ]; then
  echo "[session-start] failed (exit $status); last lines of $LOG_FILE:" >&4
  tail -n 40 "$LOG_FILE" >&4
fi' EXIT

WARNINGS=()
log() { echo "[session-start] $*"; }
warn() {
  log "WARNING: $*"
  WARNINGS+=("$*")
}

persist_env() {
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export $1=\"$2\"" >> "$CLAUDE_ENV_FILE"
  fi
  export "$1=$2"
}

# --- 1. Node ----------------------------------------------------------------------------------
NODE_VERSION="$(tr -d '[:space:]' < .node-version)"
case "$(uname -m)" in
  x86_64) NODE_ARCH=x64 ;;
  aarch64 | arm64) NODE_ARCH=arm64 ;;
  *) NODE_ARCH="" ;;
esac
if [ "$(node --version 2> /dev/null || true)" != "v$NODE_VERSION" ]; then
  if [ -z "$NODE_ARCH" ]; then
    warn "no Node build for $(uname -m); keeping $(node --version 2> /dev/null || echo 'no node')"
  else
    NODE_DIR="$HOME/.cache/accounter-node/node-v$NODE_VERSION-linux-$NODE_ARCH"
    if [ ! -x "$NODE_DIR/bin/node" ]; then
      log "installing Node v$NODE_VERSION ($NODE_ARCH)"
      mkdir -p "$(dirname "$NODE_DIR")"
      # Extract into a temp dir and move it into place only once tar succeeded, so an interrupted
      # download never leaves a half-extracted tree that a later run would take for a good cache.
      # Temp dirs left by earlier interrupted runs are cleared first.
      find "$(dirname "$NODE_DIR")" -maxdepth 1 -name '.download.*' -exec rm -rf {} +
      NODE_TMP="$(mktemp -d "$(dirname "$NODE_DIR")/.download.XXXXXX")"
      curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/$(basename "$NODE_DIR").tar.xz" \
        | tar -xJ -C "$NODE_TMP"
      rm -rf "$NODE_DIR"
      mv "$NODE_TMP/$(basename "$NODE_DIR")" "$NODE_DIR"
      rmdir "$NODE_TMP"
    fi
    persist_env PATH "$NODE_DIR/bin:$PATH"
  fi
fi
log "node $(node --version)"

# Yarn: whichever launcher is on PATH defers to .yarnrc.yml's yarnPath. Fall back to running the
# pinned release directly if there is no launcher at all.
if ! command -v yarn > /dev/null 2>&1; then
  YARN_RELEASE="$(ls .yarn/releases/yarn-*.cjs | head -1)"
  yarn() { node "$YARN_RELEASE" "$@"; }
fi

# --- 2. Dependencies --------------------------------------------------------------------------
log "yarn install"
yarn install --immutable

# --- 3. Postgres ------------------------------------------------------------------------------
persist_env POSTGRES_USER postgres
persist_env POSTGRES_PASSWORD postgres
persist_env POSTGRES_HOST localhost
persist_env POSTGRES_PORT 5432
persist_env POSTGRES_DB accounter
persist_env POSTGRES_SSL 0

db_ready=false
if command -v docker > /dev/null 2>&1; then
  if ! docker info > /dev/null 2>&1 && command -v dockerd > /dev/null 2>&1; then
    log "starting dockerd"
    # Close fds 3/4 for the daemon, or it would hold the hook's stdout/stderr pipes open.
    (nohup dockerd > /tmp/dockerd.log 2>&1 3>&- 4>&- &)
    for _ in $(seq 1 30); do
      docker info > /dev/null 2>&1 && break
      sleep 1
    done
  fi
  if docker info > /dev/null 2>&1; then
    # The image's own Postgres 16 cluster, when running, holds the port compose maps.
    if command -v pg_lsclusters > /dev/null 2>&1 \
      && pg_lsclusters --no-header 2> /dev/null | awk '$4 == "online" && $3 == 5432' | grep -q .; then
      log "stopping the image's Postgres cluster on 5432"
      pg_lsclusters --no-header | awk '$4 == "online" && $3 == 5432 { print $1, $2 }' \
        | while read -r version cluster; do pg_ctlcluster "$version" "$cluster" stop; done
    fi
    log "starting Postgres (docker compose)"
    if docker compose -f docker/docker-compose.dev.yml up -d --wait db; then
      db_ready=true
    fi
  fi
fi

# --- 4. Migrations, codegen, tools ------------------------------------------------------------
if [ "$db_ready" = true ]; then
  log "running migrations"
  # A session opened to fix a broken migration still needs codegen, so a failure here falls back
  # like a missing database does instead of ending the hook.
  if ! yarn workspace @accounter-helper/migrations migration:run; then
    warn "migrations failed; skipping SQL codegen."
    db_ready=false
  fi
fi

if [ "$db_ready" = true ]; then
  log "codegen (GraphQL + SQL)"
  yarn generate
else
  warn "the database is not ready; skipping SQL codegen." \
    "DB-backed tests and the server typecheck will not work in this session."
  yarn generate:graphql
fi

log "building workspace tools"
yarn build:tools

log "done"
{
  db_state="ready on localhost:5432"
  [ "$db_ready" = true ] || db_state="not ready"
  echo "[session-start] cloud setup done: node $(node --version), Postgres $db_state." \
    "Full log: $LOG_FILE"
  for warning in ${WARNINGS[@]+"${WARNINGS[@]}"}; do
    echo "[session-start] WARNING: $warning"
  done
} >&3
