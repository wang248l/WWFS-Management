#!/usr/bin/env bash
# WWFS办公室（management）一键部署：跟 WWFS-Marketing/scripts/deploy-clean.sh 同一个套路。
# 2026-11-03 Wallace：「都要自动部署」——push 到 main 由 .github/workflows/deploy.yml 调这个脚本，人手动也是跑它。
#
#   bash scripts/deploy-clean.sh        部署当前 HEAD（工作区要干净，-f 跳过检查）
#
# 服务器：droplet 上 docker compose，容器名 management，端口 127.0.0.1:3004，数据库在卷里 /data/management.db。
# 步骤：打包 HEAD → 上传 → 备份源码和数据库 → 整目录替换（保留 .env）→ docker compose up -d --build → 健康检查。
set -euo pipefail

HOST="${DEPLOY_HOST:-159.203.13.193}"
USER_NAME="${DEPLOY_USER:-root}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-}"
FORCE=0
[ "${1:-}" = "-f" ] && FORCE=1

cd "$(git rev-parse --show-toplevel)"
if [ "$FORCE" -eq 0 ] && [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean. Commit first, or pass -f." >&2
  exit 1
fi

COMMIT="$(git rev-parse --short HEAD)"
ARCHIVE="$(mktemp -t wwfs-management-XXXXXX).tar"
echo "Packaging HEAD $COMMIT..."
git archive --format=tar -o "$ARCHIVE" HEAD
scp -o StrictHostKeyChecking=no -q "$ARCHIVE" "$USER_NAME@$HOST:/root/wwfs-management-clean-deploy.tar"
rm -f "$ARCHIVE"

ssh -o StrictHostKeyChecking=no "$USER_NAME@$HOST" bash -s -- "$REMOTE_DIR" "$COMMIT" <<'REMOTE'
set -e
REMOTE_DIR="$1"; COMMIT="$2"
# 没指定目录就问正在跑的容器：compose 把工作目录记在 label 里
if [ -z "$REMOTE_DIR" ]; then
  REMOTE_DIR=$(docker inspect management --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' 2>/dev/null || true)
fi
REMOTE_DIR="${REMOTE_DIR:-/root/WWFS-Management}"
echo "Deploying $COMMIT to $REMOTE_DIR"
STAMP=$(date +%Y%m%d%H%M%S)
BACKUP_DIR=/root/WWFS-Management.backups
mkdir -p "$BACKUP_DIR"

# 1) 先备份源码和线上数据库
if [ -d "$REMOTE_DIR" ]; then
  tar --exclude="node_modules" --exclude=".next" -czf "$BACKUP_DIR/source-$STAMP.tar.gz" -C "$(dirname "$REMOTE_DIR")" "$(basename "$REMOTE_DIR")"
fi
if docker ps --format '{{.Names}}' | grep -qx management; then
  docker cp management:/data/management.db "$BACKUP_DIR/management-db-$STAMP.db" || true
fi
ls -1t "$BACKUP_DIR" | tail -n +31 | while read -r f; do rm -f "$BACKUP_DIR/$f"; done

# 2) 整目录替换，保留 .env
TMP=$(mktemp -d /root/WWFS-Management.clean.XXXXXX)
tar -xf /root/wwfs-management-clean-deploy.tar -C "$TMP"
mkdir -p "$REMOTE_DIR"
[ -f "$REMOTE_DIR/.env" ] && cp "$REMOTE_DIR/.env" "$TMP/.env"
find "$REMOTE_DIR" -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +
cp -a "$TMP"/. "$REMOTE_DIR"/
rm -rf "$TMP" /root/wwfs-management-clean-deploy.tar
printf '%s\n' "$COMMIT" > "$REMOTE_DIR/.deployed-commit"

# 3) 重建容器（启动时 prisma db push + seed，见 Dockerfile）
cd "$REMOTE_DIR"
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true

# 4) 健康检查：/login 要在 90 秒内回 200
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3004/login || true)
  [ "$CODE" = 200 ] && { echo "Healthy ($COMMIT)"; exit 0; }
  sleep 3
done
echo "Health check failed (last HTTP $CODE)" >&2
docker logs --tail 50 management >&2 || true
exit 1
REMOTE
