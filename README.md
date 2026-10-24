# Vinted-Helfer

Ein lokales Werkzeug für Vinted-Verkäufer: mehr verkaufen, Zeit sparen, die Zahlen im Blick behalten.
Eine einzige Web-App (`index.html`), läuft im Browser und als App auf dem iPhone-Home-Bildschirm.

**Live:** https://antont10.github.io/vinted-helfer/

## Was es kann
- **Artikel verwalten:** Status von Idee bis Bewertet, Alter und Ampel, Preissenkungs-Vorschlag, Versandfrist.
- **Heute-Liste:** was heute zu tun ist (Preis senken, neu einstellen, Nachrichten beantworten).
- **Texte:** Titel-Baukasten, Foto-Checkliste, Angebotstexte zum Kopieren.
- **Zahlen:** Umsatz, Gewinn pro Artikel und pro Stunde, Jahreszähler mit Hinweis auf die Meldegrenze, CSV-Export.
- **Einkauf:** Kauf-Check (kaufen, handeln oder lassen), gespeicherte Such-Links, Merkliste, Trends.
- **KI (optional):** Titel, Beschreibung, Preis-Schätzung und Kauf-Check über Claude, entweder über den kleinen lokalen Proxy (`ki-proxy.py`, nur auf dem eigenen Mac) oder per Kopieren in die Claude-App.

## Was es nie tut
- Es greift **nie** auf Vinted zu: kein Login, kein Scraping, kein Bot, keine Nachrichten oder Käufe. Der Nutzer kopiert und klickt selbst.
- Die Daten bleiben im Browser des eigenen Geräts. Keine Tracker, keine fremden Skripte, keine Schlüssel im Code.
- Beim KI-Weg gehen nur Artikelname, Foto und bei Bedarf der Angebotstext (ohne E-Mails, Nummern und Links) an Claude.

## Starten und testen
```
python3 -m http.server 8765        # dann http://localhost:8765 öffnen
TZ=Europe/Berlin node test.js      # Rechentests
python3 test_proxy.py              # Tests für den KI-Proxy
```
Den KI-Proxy startet man mit `python3 ki-proxy.py` (braucht das offizielle `claude`-Programm, angemeldet).

Kein offizielles Vinted-Produkt, keine Verbindung zu Vinted.
