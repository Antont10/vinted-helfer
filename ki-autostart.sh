#!/bin/zsh
# Startet den KI-Proxy von selbst, sobald du dich am Mac anmeldest (macOS-Anmelde-Dienst, nur für dich).
#   ./ki-autostart.sh an       einschalten (startet den Proxy auch gleich)
#   ./ki-autostart.sh neu      Proxy neu starten (nach einer Änderung in ki-proxy.py, z. B. anderes Modell)
#   ./ki-autostart.sh aus      ausschalten und die Dienst-Datei löschen
#   ./ki-autostart.sh status   zeigt, ob der Proxy läuft
# Die Dienst-Datei liegt in ~/Library/LaunchAgents, das Protokoll in ~/Library/Logs/vinted-helfer-ki-proxy.log.
cd "$(dirname "$0")" || exit 1
ORDNER="$PWD"
NAME="de.vinted-helfer.ki-proxy"
PLIST="$HOME/Library/LaunchAgents/$NAME.plist"
LOG="$HOME/Library/Logs/vinted-helfer-ki-proxy.log"
GUI="gui/$(id -u)"

lauft() { curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/ki 2>/dev/null; }

case "$1" in
  an)
    if [ ! -f ki-proxy.py ]; then echo "ki-proxy.py fehlt im Ordner $ORDNER"; exit 1; fi
    if [ "$(lauft)" = "200" ]; then echo "Der Proxy läuft schon (z. B. in einem Terminal-Fenster). Bitte dort mit Strg+C beenden, dann nochmal „an“."; exit 1; fi
    mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$NAME</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>-lc</string><string>cd '$ORDNER' &amp;&amp; exec python3 ki-proxy.py</string></array>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
EOF
    launchctl bootout "$GUI" "$PLIST" 2>/dev/null
    launchctl bootstrap "$GUI" "$PLIST" || { echo "Der Dienst ließ sich nicht laden."; exit 1; }
    for i in 1 2 3 4 5 6; do [ "$(lauft)" = "200" ] && break; sleep 1; done
    if [ "$(lauft)" = "200" ]; then echo "An. Der Proxy läuft und startet künftig beim Anmelden."; else echo "Der Proxy antwortet noch nicht. Protokoll: $LOG"; tail -5 "$LOG" 2>/dev/null; exit 1; fi
    ;;
  neu)
    [ -f "$PLIST" ] || { echo "Autostart ist aus. Erst ./ki-autostart.sh an"; exit 1; }
    launchctl kickstart -k "$GUI/$NAME" || { echo "Neustart ging nicht."; exit 1; }
    for i in 1 2 3 4 5 6; do sleep 1; [ "$(lauft)" = "200" ] && break; done
    [ "$(lauft)" = "200" ] && echo "Der Proxy wurde neu gestartet." || { echo "Der Proxy antwortet nicht. Protokoll: $LOG"; exit 1; }
    ;;
  aus)
    launchctl bootout "$GUI" "$PLIST" 2>/dev/null
    rm -f "$PLIST"
    echo "Aus. Der Proxy startet nicht mehr von selbst (Doppelklick auf ki-proxy-starten.command geht weiter)."
    ;;
  status)
    [ -f "$PLIST" ] && echo "Autostart: an" || echo "Autostart: aus"
    [ "$(lauft)" = "200" ] && echo "Proxy: läuft" || echo "Proxy: läuft nicht"
    ;;
  *)
    echo "Benutzung: ./ki-autostart.sh an | neu | aus | status"; exit 1
    ;;
esac
