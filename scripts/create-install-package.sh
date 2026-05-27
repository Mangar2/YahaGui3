#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOY_DIR="${REPO_ROOT}/deployment"
WORK_DIR="${DEPLOY_DIR}/package-root"
OUTPUT_ZIP="${DEPLOY_DIR}/yaha-gui-package.zip"

mkdir -p "${DEPLOY_DIR}"
rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}"

echo "[1/4] Building production bundle"
cd "${REPO_ROOT}"
pnpm build:prod

echo "[2/4] Preparing package content"
cp -R "${REPO_ROOT}/dist" "${WORK_DIR}/dist"
cp "${REPO_ROOT}/deployment/installgui.sh" "${WORK_DIR}/installgui.sh"
chmod +x "${WORK_DIR}/installgui.sh"

cat > "${WORK_DIR}/README-INSTALL.txt" << 'EOF'
YAHA GUI Install Package

Content:
- dist/                 static production build for nginx
- installgui.sh         installer script for Raspberry Pi / Debian

Quick install on target host:
1) copy yaha-gui-package.zip and installgui.sh to target host
2) run: chmod +x installgui.sh
3) run: sudo ./installgui.sh ./yaha-gui-package.zip

Optional backend target for /store and /publish reverse proxy:
  sudo BACKEND_HOST=127.0.0.1 BACKEND_PORT=8080 ./installgui.sh ./yaha-gui-package.zip
EOF

echo "[3/4] Creating zip package"
rm -f "${OUTPUT_ZIP}"
cd "${WORK_DIR}"
zip -rq "${OUTPUT_ZIP}" .

echo "[4/4] Package ready: ${OUTPUT_ZIP}"
