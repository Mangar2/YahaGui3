#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_DIR="$(cd "${SCRIPT_DIR}/../deployment" && pwd)"
DEFAULT_TARGET="~/yahagui"

HOST=""
TARGET_PATH="${DEFAULT_TARGET}"
PACKAGE_PATH="${DEPLOYMENT_DIR}/yaha-gui-package.zip"
INSTALLER_PATH="${DEPLOYMENT_DIR}/installgui.sh"
RUN_INSTALL=1

print_usage() {
  cat << 'EOF'
Usage:
  deploygui.sh --host <user@host> [--target <remote-path>] [--package <zip-path>] [--installer <script-path>]

Required:
  --host <user@host>   SSH target host (example: pi@yaha2)

Optional:
  --target <path>      Remote target directory (default: ~/yahagui)
  --package <path>     Local package zip (default: deployment/yaha-gui-package.zip)
  --installer <path>   Local installer script (default: deployment/installgui.sh)
  --copy-only          Only copy files to target host, do not run remote installer
  --help               Show this help text
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --host"
        print_usage
        exit 1
      fi
      HOST="$2"
      shift 2
      ;;
    --target)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --target"
        print_usage
        exit 1
      fi
      TARGET_PATH="$2"
      shift 2
      ;;
    --package)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --package"
        print_usage
        exit 1
      fi
      PACKAGE_PATH="$2"
      shift 2
      ;;
    --installer)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --installer"
        print_usage
        exit 1
      fi
      INSTALLER_PATH="$2"
      shift 2
      ;;
    --copy-only)
      RUN_INSTALL=0
      shift
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      print_usage
      exit 1
      ;;
  esac
done

if [[ -z "${HOST}" ]]; then
  echo "Missing required option: --host"
  print_usage
  exit 1
fi

if [[ ! -f "${PACKAGE_PATH}" ]]; then
  echo "Package file not found: ${PACKAGE_PATH}"
  exit 1
fi

if [[ ! -f "${INSTALLER_PATH}" ]]; then
  echo "Installer script not found: ${INSTALLER_PATH}"
  exit 1
fi

echo "Preparing remote target directory on ${HOST}:${TARGET_PATH}"
ssh "${HOST}" "mkdir -p ${TARGET_PATH}"

echo "Copying deployment files"
scp "${PACKAGE_PATH}" "${INSTALLER_PATH}" "${HOST}:${TARGET_PATH}/"

echo "Making remote installer executable"
ssh "${HOST}" "chmod +x ${TARGET_PATH}/installgui.sh"

if [[ "${RUN_INSTALL}" -eq 1 ]]; then
  echo "Running remote installer"
  ssh -t "${HOST}" "sudo ${TARGET_PATH}/installgui.sh ${TARGET_PATH}/yaha-gui-package.zip"
  echo "Deploy and installation finished"
else
  echo "Deploy copy finished"
  echo "Next step on target host:"
  echo "  sudo ${TARGET_PATH}/installgui.sh ${TARGET_PATH}/yaha-gui-package.zip"
  echo "  # installer deploys files and safely wires GUI into existing nginx default site"
fi
