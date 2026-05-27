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
