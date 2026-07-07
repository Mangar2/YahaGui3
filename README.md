# yaha GUI

Frontend fuer das Projekt yaha (yet another home automation).

Ziel:
- GUI fuer Heimautomatisierung
- Umsetzung als React-App
- PWA-faehig
- Funktionell weitgehend orientiert an der Altversion unter `spec/original/src`

## Projektstatus

Initiales Setup der Repository-Standards.

## Scope

- Dieses Repository enthaelt nur das Frontend.
- Das Backend ist nicht Teil dieser Implementierung.
- Das Backend kann leicht vom Backend der bestehenden Anwendung abweichen.

## Struktur

- `spec/original/src`: Referenz der bisherigen Anwendung (funktionelle Vorlage)
- `.github/copilot-instructions.md`: Projektweite KI-Arbeitsregeln

## Entwicklung

Geplante technische Basis:
- React
- PWA (Service Worker, Manifest, installierbar)

## Installation auf einem neuen Raspberry Pi

### Voraussetzungen prüfen (Zielsystem)

Vor jedem Deployment zuerst den Ist-Zustand auf dem Zielsystem prüfen:

```bash
ssh pi@<IP>

# nginx installiert und aktiv?
systemctl is-active nginx

# Ist controlapp.conf als einzige aktive Site vorhanden?
ls -la /etc/nginx/sites-enabled/

# nginx-Konfiguration gültig?
sudo /usr/sbin/nginx -t
```

**Erwarteter Zustand vor dem GUI-Deploy:**

- `nginx` ist aktiv
- `/etc/nginx/sites-enabled/controlapp` ist vorhanden (Symlink auf `sites-available/controlapp`)
- `/etc/nginx/sites-enabled/default` ist **nicht** vorhanden
- `sudo /usr/sbin/nginx -t` meldet `syntax is ok` und `test is successful`

Ist einer dieser Punkte nicht erfüllt, zuerst das Backend installieren (siehe unten).

### Schritt 1: Backend installieren (einmalig auf neuem Pi)

Das YAHA-Backend (`mqtt`-Repository) muss vor der GUI installiert sein. Es richtet alle Backend-Dienste ein und installiert die nginx-Konfiguration (`controlapp.conf`) mit den Routen `/store`, `/publish`, `/kvstore` etc.

Nach der Backend-Installation:

```bash
# Default-Site deaktivieren (controlapp ist der neue default_server)
sudo rm -f /etc/nginx/sites-enabled/default

sudo /usr/sbin/nginx -t
sudo systemctl reload nginx
```

Falls das Backend-Install-Script das nginx-Setup übersprungen hat (Meldung "Skipping nginx setup"), fehlt `nginx/controlapp.conf` im Ausführungsverzeichnis. In diesem Fall `controlapp.conf` manuell kopieren und aktivieren:

```bash
# Vom Entwicklungsrechner:
scp mqtt/deployment/yaha/nginx/controlapp.conf pi@<IP>:/tmp/controlapp.conf

ssh pi@<IP>
sudo cp /tmp/controlapp.conf /etc/nginx/sites-available/controlapp
sudo ln -sfn /etc/nginx/sites-available/controlapp /etc/nginx/sites-enabled/controlapp
sudo rm -f /etc/nginx/sites-enabled/default
sudo /usr/sbin/nginx -t && sudo systemctl reload nginx
```

### Schritt 2: GUI bauen und deployen

Vom Entwicklungsrechner, im Root dieses Repositories:

```bash
# Neuen Production-Build erstellen
scripts/create-install-package.sh

# Auf den Pi deployen und installieren
scripts/deploygui.sh --host pi@<IP>
```

`deploygui.sh` kopiert das Package per SCP auf den Pi und führt `installgui.sh` remote aus. Nach erfolgreichem Abschluss ist die GUI erreichbar unter:

```
http://<IP>/yahagui/
```

### Hinweise

- Der Hostname `yhahapi` muss im lokalen DNS oder `/etc/hosts` eingetragen sein, sonst direkt die IP verwenden.
- `nginx` liegt auf dem Pi unter `/usr/sbin/nginx` und ist nur im PATH von root verfügbar — `nginx -t` immer mit `sudo` aufrufen.
- `installgui.sh` erstellt vor jeder Änderung ein Backup der nginx-Site unter `/etc/nginx/sites-available/default.bak.yaha-<timestamp>`.
- Das Package (`deployment/yaha-gui-package.zip`) wird lokal gecacht. Vor dem Deploy prüfen ob es aktuell ist — bei neuen Commits neu bauen mit `scripts/create-install-package.sh`.

## Changelog

Siehe `CHANGELOG.md`.

## Sicherheit

Siehe `SECURITY.md`.
