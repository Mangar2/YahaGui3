#!/usr/bin/env bash

set -euo pipefail

if [[ "${1:-}" == "" ]]; then
  echo "Usage: $0 <path-to-yaha-gui-package.zip>"
  exit 1
fi

PACKAGE_ZIP="$(realpath "$1")"
if [[ ! -f "${PACKAGE_ZIP}" ]]; then
  echo "Package not found: ${PACKAGE_ZIP}"
  exit 1
fi

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
WEB_ROOT="${WEB_ROOT:-/var/www/yaha-gui}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/yaha-gui}"
RELEASE_ID="$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="${INSTALL_ROOT}/releases/${RELEASE_ID}"
NGINX_SITE="/etc/nginx/sites-available/yaha-gui"
NGINX_LINK="/etc/nginx/sites-enabled/yaha-gui"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (sudo)."
  exit 1
fi

echo "[1/7] Installing required packages"
apt-get update -y
apt-get install -y nginx unzip rsync

echo "[2/7] Creating directories"
mkdir -p "${RELEASE_DIR}"
mkdir -p "${WEB_ROOT}"

echo "[3/7] Unzipping package to release directory"
unzip -q "${PACKAGE_ZIP}" -d "${RELEASE_DIR}"

if [[ ! -d "${RELEASE_DIR}/dist" ]]; then
  echo "Invalid package: dist directory not found in ${RELEASE_DIR}"
  exit 1
fi

echo "[4/7] Deploying static files"
rsync -a --delete "${RELEASE_DIR}/dist/" "${WEB_ROOT}/"
chown -R www-data:www-data "${WEB_ROOT}"

echo "[5/7] Writing nginx site configuration"
cat > "${NGINX_SITE}" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;
    root ${WEB_ROOT};
    index index.html;

    location /store {
        proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /publish {
        proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

echo "[6/7] Enabling site"
rm -f /etc/nginx/sites-enabled/default
ln -sfn "${NGINX_SITE}" "${NGINX_LINK}"

echo "[7/7] Validating and reloading nginx"
nginx -t
systemctl reload nginx

echo "Install completed."
echo "Open in browser: http://$(hostname -I | awk '{print $1}')/"
echo "Backend proxy target: http://${BACKEND_HOST}:${BACKEND_PORT}"
