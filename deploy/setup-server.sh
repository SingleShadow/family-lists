#!/usr/bin/env bash
# 家庭清单 · 服务器端部署脚本
# 用法：把项目上传到 /opt/family-lists 后，在项目根目录执行 bash deploy/setup-server.sh
# 前提：服务器已装 Node.js 22+（node:sqlite 需要）
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/family-lists}"
PORT="${PORT:-8791}"
SERVICE="family-lists"

echo "==> 1/5 检查 Node 版本"
node -v
NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "需要 Node 22+（node:sqlite 依赖）。请先升级 Node。" >&2
  exit 1
fi

echo "==> 2/5 准备目录（保留 gateway/ 结构，数据落 $APP_DIR/data）"
mkdir -p "$APP_DIR/data"
cp -rf "$PWD/gateway" "$APP_DIR/"
cp -f "$PWD/package.json" "$APP_DIR/"
[ -f "$PWD/.env" ] && cp -f "$PWD/.env" "$APP_DIR/" || true

echo "==> 3/5 创建 systemd 服务"
cat > /etc/systemd/system/${SERVICE}.service <<EOF
[Unit]
Description=Family Lists API
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
Environment=CORS=*
ExecStart=/usr/bin/node ${APP_DIR}/gateway/server.cjs
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF

echo "==> 4/5 启动服务"
systemctl daemon-reload
systemctl enable ${SERVICE}
systemctl restart ${SERVICE}
sleep 2
systemctl status ${SERVICE} --no-pager | head -20

echo "==> 5/5 健康检查"
curl -fsS http://127.0.0.1:${PORT}/api/health && echo
echo "完成。API 地址：http://43.138.34.79:${PORT}"
echo "记得在腾讯云安全组放行 TCP ${PORT}（以及 SSH 的 22）。"
