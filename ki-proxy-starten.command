#!/bin/zsh
# Doppelklick startet den KI-Proxy. Fenster offen lassen, solange du die KI brauchst. Beenden: Strg+C oder Fenster schließen.
cd "$(dirname "$0")" && python3 ki-proxy.py
