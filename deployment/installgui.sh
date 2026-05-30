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
WEB_ROOT="${WEB_ROOT:-/var/www/yahagui}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/yahagui}"
RELEASE_ID="$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="${INSTALL_ROOT}/releases/${RELEASE_ID}"
NGINX_SNIPPET_PATH="/etc/nginx/snippets/yahagui-react.conf"
NGINX_DEFAULT_SITE="${NGINX_DEFAULT_SITE:-}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (sudo)."
  exit 1
fi

echo "[1/7] Checking prerequisites"
if ! command -v nginx >/dev/null 2>&1; then
  echo "Missing prerequisite: nginx is not installed."
  echo "Install nginx manually and run this script again."
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "Missing prerequisite: unzip is not installed."
  echo "Install unzip manually and run this script again."
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "Missing prerequisite: rsync is not installed."
  echo "Install rsync manually and run this script again."
  exit 1
fi

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

echo "[5/7] Preparing safe nginx integration"

if [[ -z "${NGINX_DEFAULT_SITE}" ]]; then
  mapfile -t enabledSites < <(find /etc/nginx/sites-enabled -maxdepth 1 -type l 2>/dev/null | sort)

  if [[ ${#enabledSites[@]} -eq 1 ]]; then
    NGINX_DEFAULT_SITE="${enabledSites[0]}"
  else
    mapfile -t defaultCandidates < <(grep -lE 'listen[[:space:]]+80[[:space:]]+default_server|listen[[:space:]]+\[::\]:80[[:space:]]+default_server' "${enabledSites[@]}" 2>/dev/null || true)

    if [[ ${#defaultCandidates[@]} -eq 1 ]]; then
      NGINX_DEFAULT_SITE="${defaultCandidates[0]}"
    elif [[ ${#defaultCandidates[@]} -gt 1 ]]; then
      for candidate in "${defaultCandidates[@]}"; do
        if grep -q "location /store" "${candidate}" && grep -q "location /publish" "${candidate}"; then
          NGINX_DEFAULT_SITE="${candidate}"
          break
        fi
      done

      if [[ -z "${NGINX_DEFAULT_SITE}" ]]; then
        NGINX_DEFAULT_SITE="${defaultCandidates[0]}"
      fi
    fi
  fi
fi

if [[ -z "${NGINX_DEFAULT_SITE}" ]]; then
  echo "No enabled default_server site found on port 80."
  echo "Set NGINX_DEFAULT_SITE to your active site file and rerun."
  exit 1
fi

NGINX_DEFAULT_SITE="$(readlink -f "${NGINX_DEFAULT_SITE}")"

if [[ ! -f "${NGINX_DEFAULT_SITE}" ]]; then
  echo "Resolved nginx site file does not exist: ${NGINX_DEFAULT_SITE}"
  exit 1
fi

if ! grep -Eq "location[[:space:]]*(=)?[[:space:]]*/store(/|[[:space:]]*\{)" "${NGINX_DEFAULT_SITE}"; then
  echo "Warning: location /store was not found in ${NGINX_DEFAULT_SITE}."
  echo "Ensure your interface deployment keeps /store configured."
fi

if ! grep -Eq "location[[:space:]]*(=)?[[:space:]]*/publish(/|[[:space:]]*\{)" "${NGINX_DEFAULT_SITE}"; then
  echo "Warning: location /publish was not found in ${NGINX_DEFAULT_SITE}."
  echo "Ensure your interface deployment keeps /publish configured."
fi

NGINX_BACKUP_PATH="${NGINX_DEFAULT_SITE}.bak.yaha-${RELEASE_ID}"
cp "${NGINX_DEFAULT_SITE}" "${NGINX_BACKUP_PATH}"

cat > "${NGINX_SNIPPET_PATH}" <<EOF
# YAHA GUI managed include
# React frontend under /yahagui (no hyphen)
location = /yahagui {
  return 302 /yahagui/;
}

location /yahagui/ {
  alias ${WEB_ROOT}/;
  index index.html;
  try_files \$uri \$uri/ /yahagui/index.html;
}
EOF

# Remove legacy yahagui blocks and older managed include before adding the new include.
perl -0777 -i -pe 's@\n\s*location\s*=\s*/yahagui\s*\{[^}]*\}\n@@gs' "${NGINX_DEFAULT_SITE}"
perl -0777 -i -pe 's@\n\s*location\s*/yahagui/\s*\{[^}]*\}\n@@gs' "${NGINX_DEFAULT_SITE}"
perl -0777 -i -pe 's@\n\s*location\s*=\s*/yahagui/angular/api/sensor\.php\s*\{[^}]*\}\n@@gs' "${NGINX_DEFAULT_SITE}"
perl -0777 -i -pe 's@\n\s*location\s*=\s*/yahagui/yahagui/angular/api/sensor\.php\s*\{[^}]*\}\n@@gs' "${NGINX_DEFAULT_SITE}"
perl -0777 -i -pe 's@\n\s*location\s*=\s*/yahagui/angular/api/publish\.php\s*\{[^}]*\}\n@@gs' "${NGINX_DEFAULT_SITE}"
perl -0777 -i -pe 's@\n\s*location\s*=\s*/yahagui/yahagui/angular/api/publish\.php\s*\{[^}]*\}\n@@gs' "${NGINX_DEFAULT_SITE}"
perl -0777 -i -pe 's@\n\s*include\s+/etc/nginx/snippets/yaha-gui-root\.conf;\s*#\s*yaha-gui-managed\n@@gs' "${NGINX_DEFAULT_SITE}"
perl -0777 -i -pe 's@\n\s*include\s+/etc/nginx/snippets/yahagui-react\.conf;\s*#\s*yahagui-react-managed\n@@gs' "${NGINX_DEFAULT_SITE}"
# Remove any stale yahagui include line regardless placement or comment formatting.
sed -i -E '/include[[:space:]]+\/etc\/nginx\/snippets\/yahagui-react\.conf;/d' "${NGINX_DEFAULT_SITE}"

INCLUDE_LINE="    include ${NGINX_SNIPPET_PATH}; # yahagui-react-managed"
if ! grep -q "yahagui-react-managed" "${NGINX_DEFAULT_SITE}"; then
  tmpFile="$(mktemp)"
  awk -v includeLine="${INCLUDE_LINE}" '
    function countChar(input, needle,    tmp) {
      tmp = input;
      return gsub(needle, "", tmp);
    }

    {
      lines[NR] = $0;

      lineNoComment = $0;
      sub(/#.*/, "", lineNoComment);

      preDepth = depth;
      openCount = countChar(lineNoComment, "\\{");
      closeCount = countChar(lineNoComment, "\\}");

      if (!inServer && preDepth == 0 && lineNoComment ~ /^[[:space:]]*server[[:space:]]*\{[[:space:]]*$/) {
        inServer = 1;
        serverStart = NR;
        serverHasStore = 0;
        serverHasPublish = 0;
      }

      if (inServer) {
        if ($0 ~ /location[[:space:]]*(=)?[[:space:]]*\/store(\/|[[:space:]]*\{)/) {
          serverHasStore = 1;
        }
        if ($0 ~ /location[[:space:]]*(=)?[[:space:]]*\/publish(\/|[[:space:]]*\{)/) {
          serverHasPublish = 1;
        }
      }

      depth = preDepth + openCount - closeCount;

      if (inServer && depth == 0) {
        serverCount++;
        serverCloseLine[serverCount] = NR;
        hasStore[serverCount] = serverHasStore;
        hasPublish[serverCount] = serverHasPublish;
        compactCloseLine[serverCount] = (openCount == 0 && closeCount > 1) ? 1 : 0;
        inServer = 0;
      }
    }

    END {
      insertAt = 0;

      for (i = 1; i <= serverCount; i++) {
        if (hasStore[i] && hasPublish[i]) {
          insertAt = serverCloseLine[i];
          break;
        }
      }

      if (insertAt == 0 && serverCount > 0) {
        insertAt = serverCloseLine[1];
      }

      if (insertAt == 0) {
        for (i = 1; i <= NR; i++) {
          print lines[i];
        }
        exit;
      }

      for (i = 1; i < insertAt; i++) {
        print lines[i];
      }

      splitCompact = 0;
      for (i = 1; i <= serverCount; i++) {
        if (serverCloseLine[i] == insertAt && compactCloseLine[i] == 1) {
          splitCompact = 1;
          break;
        }
      }

      if (splitCompact == 1) {
        closeLine = lines[insertAt];
        closePos = match(closeLine, /}[[:space:]]*$/);
        if (closePos > 0) {
          preClose = substr(closeLine, 1, closePos - 1);
          postClose = substr(closeLine, closePos + 1);
          print preClose;
          print includeLine;
          print "}" postClose;
          for (i = insertAt + 1; i <= NR; i++) {
            print lines[i];
          }
          exit;
        }
      }

      print includeLine;
      for (i = insertAt; i <= NR; i++) {
        print lines[i];
      }
    }
  ' "${NGINX_DEFAULT_SITE}" > "${tmpFile}"
  install -m 644 "${tmpFile}" "${NGINX_DEFAULT_SITE}"
  rm -f "${tmpFile}"
fi

echo "[6/7] Validating and reloading nginx"
nginx -t
systemctl reload nginx

echo "[7/7] Install finished"
echo "Current WEB_ROOT: ${WEB_ROOT}"
echo "Active nginx default site: ${NGINX_DEFAULT_SITE}"
echo "Nginx backup: ${NGINX_BACKUP_PATH}"

echo "Install completed."
echo "Open in browser: http://$(hostname -I | awk '{print $1}')/yahagui/"
echo "Configured backend target: http://${BACKEND_HOST}:${BACKEND_PORT}"
