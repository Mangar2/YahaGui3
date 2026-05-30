#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOY_DIR="${REPO_ROOT}/deployment"
WORK_DIR="${DEPLOY_DIR}/package-root"
OUTPUT_ZIP="${DEPLOY_DIR}/yaha-gui-package.zip"
GUI_BASE_PATH="${GUI_BASE_PATH:-/yahagui/}"

mkdir -p "${DEPLOY_DIR}"
rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}"

echo "[1/4] Building production bundle"
cd "${REPO_ROOT}"
YAHA_GUI_BASE="${GUI_BASE_PATH}" pnpm build:prod

echo "[2/4] Preparing package content"
cp -R "${REPO_ROOT}/dist" "${WORK_DIR}/dist"

cat > "${WORK_DIR}/README-INSTALL.txt" << 'EOF'
YAHA GUI Install Package

Content:
- dist/                 static production build for nginx

Note:
- installgui.sh is intentionally NOT inside this zip.
- Use deployment/installgui.sh next to the zip on the target host.

Quick install on target host:
1) copy yaha-gui-package.zip and installgui.sh to target host
2) run: chmod +x installgui.sh
3) run: sudo ./installgui.sh ./yaha-gui-package.zip

Important:
- installgui.sh does NOT install nginx.
- installgui.sh deploys static files to WEB_ROOT and safely integrates GUI at /yahagui into the existing nginx default site.
- installgui.sh creates a backup of the touched nginx site file before modification.
- installgui.sh does not replace interface routes like /store and /publish.

Default runtime URL:
- http://<host>/yahagui/

Optional backend target hint for existing nginx config (/store and /publish):
  sudo BACKEND_HOST=127.0.0.1 BACKEND_PORT=8080 ./installgui.sh ./yaha-gui-package.zip
EOF

echo "[3/4] Creating zip package"
rm -f "${OUTPUT_ZIP}"
cd "${WORK_DIR}"
zip -rq "${OUTPUT_ZIP}" .

echo "[4/4] Package ready: ${OUTPUT_ZIP}"
