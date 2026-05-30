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
