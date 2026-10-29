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
# If Docker can't start, the DB steps are skipped with a warning and GraphQL-only codegen runs,
# so the rest of the session still works.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

log() { echo "[session-start] $*" >&2; }

persist_env() {
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export $1=\"$2\"" >> "$CLAUDE_ENV_FILE"
  fi
  export "$1=$2"
}

# --- 1. Node ----------------------------------------------------------------------------------
NODE_VERSION="$(tr -d '[:space:]' < .node-version)"
if [ "$(node --version 2> /dev/null || true)" != "v$NODE_VERSION" ]; then
  NODE_DIR="$HOME/.cache/accounter-node/node-v$NODE_VERSION-linux-x64"
  if [ ! -x "$NODE_DIR/bin/node" ]; then
    log "installing Node v$NODE_VERSION"
    mkdir -p "$(dirname "$NODE_DIR")"
    curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
      | tar -xJ -C "$(dirname "$NODE_DIR")"
  fi
  persist_env PATH "$NODE_DIR/bin:$PATH"
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
    (nohup dockerd > /tmp/dockerd.log 2>&1 &)
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
  yarn workspace @accounter-helper/migrations migration:run
  log "codegen (GraphQL + SQL)"
  yarn generate
else
  log "WARNING: Postgres is not available; skipping migrations and SQL codegen." \
    "DB-backed tests and the server typecheck will not work in this session."
  yarn generate:graphql
fi

log "building workspace tools"
yarn build:tools

log "done"
