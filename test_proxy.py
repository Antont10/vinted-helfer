#!/usr/bin/env python3
"""Testet ki-proxy.py mit einem Test-Ersatz für "claude". Kein Netz, kein Abo, kein Verbrauch.
Start: python3 test_proxy.py"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import base64, http.client, importlib.util, json, os, re, stat, sys, tempfile, threading, time, unittest

HIER = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('ki_proxy', os.path.join(HIER, 'ki-proxy.py'))
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)

STUB = '''#!%s
import sys, os, json, time
d = os.path.dirname(os.path.abspath(__file__))
modus = open(os.path.join(d, 'modus')).read().strip()
inp = sys.stdin.read()
n = 0
try:
    n = json.load(open(os.path.join(d, 'log.json')))['aufrufe']
except Exception:
    pass
json.dump({'args': sys.argv[1:], 'env': dict(os.environ), 'in': inp, 'cwd': os.getcwd(), 'aufrufe': n + 1}, open(os.path.join(d, 'log.json'), 'w'))
OK = '{"titel":"Nike Hoodie grau Gr. M","beschreibung":"Nike Hoodie in Grau, Größe M.\\\\nSehr gut erhalten.","fehlt":["Mängel prüfen"]}'
KAUF = '{"marke":"Venum","artikel":"Contender Gi","verkauf_von":45,"verkauf_bis":60,"nachfrage":"mittel","einschaetzung":"Gefragte Marke, der Preis passt.","echtheit":["Patch gestickt"],"fragen":["Maße?"],"risiken":["Größe unklar"]}'
TREND = '{"einkauf":[{"was":"Carhartt Detroit Jacket","marke":"Carhartt","suche":"Carhartt Detroit Jacket","warum":"Workwear ist gefragt.","verkauf_von":60,"verkauf_bis":90,"tempo":"schnell","nische":false},{"was":"Venum Contender Gi","marke":"Venum","suche":"Venum Contender Gi","warum":"Neue Kurse im Herbst.","verkauf_von":35,"verkauf_bis":55,"tempo":"mittel","nische":true},{"was":"Alte Vase","tempo":"langsam"}],"einstellen":[{"was":"Daunenjacken von The North Face","warum":"Es wird kalt.","tempo":"schnell"}],"quellen":[{"titel":"Vinted Trends","url":"https://www.vinted.de/press"},{"titel":"Boese","url":"javascript:alert(1)"}]}'
PREIS = '{"titel":"Nike Hoodie grau Gr. M","beschreibung":"Nike Hoodie in Grau, Gr. M.","fehlt":[],"verkauf_von":35,"verkauf_bis":"x","nachfrage":"hoch"}'
if modus == 'preis':
    print(json.dumps({'type': 'result', 'is_error': False, 'result': PREIS}))
elif modus == 'kauf':
    print(json.dumps({'type': 'result', 'is_error': False, 'result': KAUF}))
elif modus == 'trend':
    print(json.dumps({'type': 'system'}))
    print(json.dumps({'type': 'result', 'is_error': False, 'result': 'Hier die Trends: ' + TREND}))
elif modus == 'ok':
    print(json.dumps({'type': 'system'}))
    print(json.dumps({'type': 'result', 'is_error': False, 'result': OK}))
elif modus == 'struktur':
    print(json.dumps({'type': 'result', 'is_error': False, 'result': 'egal', 'structured_output': json.loads(OK)}))
elif modus == 'text':
    print(json.dumps({'type': 'result', 'is_error': False, 'result': 'Hier: ' + OK + ' Fertig.'}))
elif modus == 'login':
    print(json.dumps({'type': 'result', 'is_error': True, 'result': 'Not logged in \\u00b7 Please run /login'}))
elif modus == 'kaputt':
    print(json.dumps({'type': 'result', 'is_error': False, 'result': 'Das ist kein JSON'}))
elif modus == 'langsam':
    time.sleep(1.5)
    print(json.dumps({'type': 'result', 'is_error': False, 'result': OK}))
elif modus == 'haengt':
    time.sleep(5)
elif modus == 'absturz':
    sys.stderr.write('boom')
    sys.exit(3)
'''

# kleines gültiges PNG (1x1)
PNG = 'data:image/png;base64,' + base64.b64encode(base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).decode()


class Basis(unittest.TestCase):
    limit = 100
    timeout = 20

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name
        self.stub = os.path.join(self.dir, 'claude')
        with open(self.stub, 'w') as f:
            f.write(STUB % sys.executable)
        os.chmod(self.stub, os.stat(self.stub).st_mode | stat.S_IXUSR)
        self.modus('ok')
        P.ZAEHLER_DATEI = os.path.join(self.dir, 'zaehler.json')
        P.TRENDS_DATEI = os.path.join(self.dir, 'trends.json')
        k = P.konfig()
        k.update(port=0, limit=self.limit, timeout=self.timeout)
        self.k = k
        self.s = P.server_bauen(k, self.stub)
        self.port = self.s.port
        threading.Thread(target=self.s.serve_forever, daemon=True).start()

    def tearDown(self):
        self.s.shutdown()
        self.s.server_close()
        self.tmp.cleanup()

    def modus(self, m):
        with open(os.path.join(self.dir, 'modus'), 'w') as f:
            f.write(m)

    def log(self):
        with open(os.path.join(self.dir, 'log.json')) as f:
            return json.load(f)

    def aufrufe(self):
        try:
            return self.log()['aufrufe']
        except OSError:
            return 0

    def req(self, methode, pfad, body=None, host=None, origin='eigen', token='eigen'):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=30)
        h = {'Host': host or '127.0.0.1:%d' % self.port}
        if origin == 'eigen':
            origin = 'http://127.0.0.1:%d' % self.port
        if origin:
            h['Origin'] = origin
        if token == 'eigen':
            token = self.s.token
        if token:
            h['X-KI-Token'] = token
        data = None
        if body is not None:
            data = body if isinstance(body, bytes) else json.dumps(body).encode()
            h['Content-Type'] = 'application/json'
        c.request(methode, pfad, body=data, headers=h)
        r = c.getresponse()
        txt = r.read().decode('utf-8')
        hd = {k.lower(): v for k, v in r.getheaders()}
        c.close()
        try:
            return r.status, json.loads(txt), hd
        except ValueError:
            return r.status, txt, hd

    def frage(self, **kw):
        return self.req('POST', '/vorschlag', {'name': 'Nike Hoodie grau M', 'bild': PNG}, **kw)

    def kauf(self, body=None, **kw):
        return self.req('POST', '/kaufcheck', body or {'name': 'Venum Gi A2', 'preis': 30, 'text': 'Kaum getragen.', 'bild': PNG}, **kw)


class Sicherheit(Basis):
    def test_seite_hat_schluessel_und_kein_cors(self):
        st, txt, hd = self.req('GET', '/ki')
        self.assertEqual(st, 200)
        self.assertIn(self.s.token, txt)
        self.assertNotIn('access-control-allow-origin', hd)
        self.assertIn("frame-ancestors 'none'", hd['content-security-policy'])
        self.assertEqual(hd['cache-control'], 'no-store')

    def test_seite_nennt_erlaubte_origins_und_stand(self):
        st, txt, hd = self.req('GET', '/ki')
        self.assertIn('https://antont10.github.io', txt)
        self.assertIn('"modell": "claude-sonnet-5-5"', txt)

    def test_falscher_host(self):
        self.assertEqual(self.req('GET', '/ki', host='evil.example:80')[0], 403)
        self.assertEqual(self.frage(host='evil.example:80')[0], 403)
        self.assertEqual(self.aufrufe(), 0)

    def test_fremder_origin_oder_kein_origin(self):
        self.assertEqual(self.frage(origin='https://evil.example')[0], 403)
        self.assertEqual(self.frage(origin=None)[0], 403)
        self.assertEqual(self.frage(origin='https://antont10.github.io')[0], 403)  # der Helfer fragt nie direkt
        self.assertEqual(self.kauf(origin='https://evil.example')[0], 403)
        self.assertEqual(self.kauf(token='falsch')[0], 403)
        self.assertEqual(self.aufrufe(), 0)

    def test_ohne_oder_mit_falschem_schluessel(self):
        self.assertEqual(self.frage(token=None)[0], 403)
        self.assertEqual(self.frage(token='falsch')[0], 403)
        self.assertEqual(self.aufrufe(), 0)

    def test_options_und_unbekannte_wege(self):
        self.assertEqual(self.req('OPTIONS', '/vorschlag')[0], 405)
        self.assertEqual(self.req('GET', '/vorschlag')[0], 404)
        self.assertEqual(self.req('GET', '/status')[0], 404)
        self.assertEqual(self.req('POST', '/anders', {'name': 'x'})[0], 404)

    def test_nur_loopback(self):
        self.assertEqual(self.s.server_address[0], '127.0.0.1')


class Aufruf(Basis):
    def test_vorschlag_und_aufruf_des_programms(self):
        st, d, _ = self.frage()
        self.assertEqual(st, 200, d)
        self.assertEqual(d['titel'], 'Nike Hoodie grau Gr. M')
        self.assertEqual(d['fehlt'], ['Mängel prüfen'])
        self.assertEqual(d['stand']['n'], 1)
        self.assertEqual(self.aufrufe(), 1)
        a = self.log()['args']
        self.assertEqual(a[a.index('--model') + 1], 'claude-sonnet-5-5')
        self.assertEqual(a[a.index('--tools') + 1], '')
        self.assertEqual(a[a.index('--effort') + 1], 'low')
        for flag in ('-p', '--restricted', '--strict-mcp-config', '--no-session-persistence', '--disable-slash-commands'):
            self.assertIn(flag, a)
        self.assertNotIn('--bare', a)  # --bare liest keine Abo-Anmeldung
        self.assertNotIn('--dangerously-skip-permissions', a)

    def test_nachricht_enthaelt_nur_name_und_foto(self):
        self.frage()
        msg = json.loads(self.log()['in'].strip())
        teile = msg['message']['content']
        self.assertEqual([t['type'] for t in teile], ['image', 'text'])
        self.assertEqual(teile[0]['source']['media_type'], 'image/png')
        self.assertIn('Nike Hoodie grau M', teile[1]['text'])

    def test_ohne_foto(self):
        st, d, _ = self.req('POST', '/vorschlag', {'name': 'Gi weiß A2'})
        self.assertEqual(st, 200)
        teile = json.loads(self.log()['in'].strip())['message']['content']
        self.assertEqual([t['type'] for t in teile], ['text'])
        self.assertIn('Kein Foto', teile[0]['text'])

    def test_kein_api_schluessel_und_sauberer_ordner(self):
        os.environ['ANTHROPIC_API_KEY'] = 'sk-test-nicht-echt'
        os.environ['ANTHROPIC_AUTH_TOKEN'] = 'nicht-echt'
        try:
            self.frage()
        finally:
            del os.environ['ANTHROPIC_API_KEY'], os.environ['ANTHROPIC_AUTH_TOKEN']
        env = self.log()['env']
        self.assertFalse([k for k in env if k.startswith('ANTHROPIC')])
        self.assertNotEqual(os.path.realpath(self.log()['cwd']), os.path.realpath(HIER))

    def test_json_mitten_im_text(self):
        self.modus('text')
        self.assertEqual(self.frage()[1]['titel'], 'Nike Hoodie grau Gr. M')

    def test_nicht_angemeldet_zaehlt_nicht(self):
        self.modus('login')
        st, d, _ = self.frage()
        self.assertEqual(st, 502)
        self.assertIn('claude auth login', d['fehler'])
        self.assertEqual(d['stand']['n'], 0)

    def test_absturz_zaehlt_nicht(self):
        self.modus('absturz')
        st, d, _ = self.frage()
        self.assertEqual(st, 502)
        self.assertEqual(d['stand']['n'], 0)

    def test_unlesbare_antwort_zaehlt(self):
        self.modus('kaputt')
        st, d, _ = self.frage()
        self.assertEqual(st, 502)
        self.assertEqual(d['stand']['n'], 1)

    def test_programm_fehlt(self):
        self.s.programm = None
        st, d, _ = self.frage()
        self.assertEqual(st, 500)
        self.assertIn('nicht gefunden', d['fehler'])
        self.assertEqual(d['stand']['n'], 0)


class KaufCheck(Basis):
    def test_kaufcheck_mit_sonnet_preis_und_text(self):
        self.modus('kauf')
        st, d, _ = self.kauf({'name': 'Venum Gi A2', 'preis': 30, 'text': 'Kaum getragen. Fragen an lisa@web.de oder 0176 1234 5678', 'bild': PNG})
        self.assertEqual(st, 200, d)
        self.assertEqual((d['verkauf_von'], d['verkauf_bis'], d['marke']), (45, 60, 'Venum'))
        self.assertEqual(d['stand']['n'], 1)
        a = self.log()['args']
        self.assertEqual(a[a.index('--model') + 1], 'claude-sonnet-5-5')
        self.assertEqual(a[a.index('--effort') + 1], 'low')
        self.assertIn('Wiederverkäufer', a[a.index('--system-prompt') + 1])
        self.assertEqual(a[a.index('--tools') + 1], '')
        teile = json.loads(self.log()['in'].strip())['message']['content']
        self.assertEqual([x['type'] for x in teile], ['image', 'text'])
        self.assertIn('Preis: 30,00 €', teile[1]['text'])
        self.assertIn('Kaum getragen.', teile[1]['text'])
        self.assertNotIn('lisa@web.de', teile[1]['text'])  # keine Kontaktdaten an die KI
        self.assertNotIn('1234', teile[1]['text'])

    def test_kaufcheck_ohne_preis_und_namen(self):
        self.modus('kauf')
        st, d, _ = self.kauf({'text': 'Venum Gi A2, kaum getragen.'})
        self.assertEqual(st, 200, d)
        text = json.loads(self.log()['in'].strip())['message']['content'][-1]['text']
        self.assertIn('Preis: unbekannt', text)
        self.assertIn('kein Name', text)
        self.assertIn('Venum Gi A2', text)
        st, d, _ = self.kauf({'name': '', 'preis': None, 'bild': PNG})  # nur ein Foto
        self.assertEqual(st, 200, d)
        self.assertEqual(self.aufrufe(), 2)

    def test_vorschlag_eigene_regeln_und_zaehler_gemeinsam(self):
        self.modus('kauf')
        self.kauf()
        self.modus('ok')
        st, d, _ = self.frage()
        self.assertEqual(st, 200)
        a = self.log()['args']
        self.assertEqual(a[a.index('--model') + 1], 'claude-sonnet-5-5')
        self.assertEqual(a[a.index('--system-prompt') + 1], P.SYSTEM)
        self.assertEqual(d['stand']['n'], 2)

    def test_falsche_antwort_zaehlt(self):
        self.modus('ok')  # liefert Titel und Text statt Kauf-Check
        st, d, _ = self.kauf()
        self.assertEqual(st, 502)
        self.assertEqual(d['stand']['n'], 1)

    def test_ungueltige_kauf_eingaben(self):
        for body in ({'name': '', 'text': ''}, {'name': '  ', 'text': '  ', 'bild': None}, {'name': 5, 'text': 'x'}, {'name': 'Gi', 'preis': 0}, {'name': 'Gi', 'preis': -3}, {'name': 'Gi', 'preis': True},
                     {'name': 'Gi', 'preis': '30'}, {'name': 'Gi', 'preis': 30, 'text': 5}, {'name': 'Gi', 'preis': 30, 'text': 'x' * 7000},
                     {'name': '', 'preis': 30}, {'name': 'Gi', 'preis': 30, 'bild': 'javascript:alert(1)'}):
            self.assertEqual(self.kauf(body)[0], 400, body)
        self.assertEqual(self.aufrufe(), 0)

    def test_seite_kennt_kaufcheck(self):
        st, txt, _ = self.req('GET', '/ki')
        self.assertIn('"v": 6', txt)
        self.assertIn('claude-sonnet-5-5', txt)
        self.assertIn('/kaufcheck', txt)
        self.assertIn('/trends', txt)


class Trend(Basis):
    def trends(self, body=None, **kw):
        return self.req('POST', '/trends', {} if body is None else body, **kw)

    def warten(self):
        for _ in range(200):
            if not self.s.trends.laeuft:
                return
            time.sleep(0.05)
        self.fail('Die Recherche hört nicht auf')

    def test_recherche_nur_mit_websuche(self):
        self.modus('trend')
        self.assertTrue(self.s.trends.starten(warten=True))
        a = self.log()['args']
        self.assertEqual(a[a.index('--tools') + 1], 'WebSearch')
        self.assertEqual(a[a.index('--allowedTools') + 1], 'WebSearch')
        self.assertIn('--restricted', a)
        self.assertNotIn('WebFetch', ' '.join(a))
        self.assertEqual(a[a.index('--model') + 1], 'claude-sonnet-5-5')
        prompt = a[a.index('--system-prompt') + 1]
        self.assertIn('Kampfsport', prompt)
        self.assertNotIn('__NISCHEN__', prompt)
        self.assertIn('Heute ist der', self.log()['in'])
        self.assertNotIn('ANTHROPIC_API_KEY', self.log()['env'])
        t = self.s.trends.lesen()
        self.assertEqual([e['was'] for e in t['einkauf']], ['Carhartt Detroit Jacket', 'Venum Contender Gi'])
        self.assertTrue(t['einkauf'][1]['nische'])
        self.assertEqual(t['quellen'], [{'titel': 'Vinted Trends', 'url': 'https://www.vinted.de/press'}])
        self.assertEqual(t['modell'], 'claude-sonnet-5-5')
        self.assertEqual(self.s.zaehler.stand()['n'], 1)

    def test_erste_recherche_startet_von_selbst(self):
        self.modus('trend')
        st, d, _ = self.trends()
        self.assertEqual(st, 200)
        self.assertTrue(d['laeuft'] or d['trends'])
        self.warten()
        st, d, _ = self.trends()
        self.assertFalse(d['laeuft'])
        self.assertEqual(d['trends']['einstellen'][0]['tempo'], 'schnell')
        self.assertIsInstance(d['trends']['zeit'], int)
        self.assertEqual((d['stand']['n'], self.aufrufe()), (1, 1))

    def test_frische_trends_nur_mit_neu(self):
        self.modus('trend')
        self.s.trends.starten(warten=True)
        self.s.trends.versuch = 0
        self.assertFalse(self.s.trends.faellig())
        self.trends()
        self.warten()
        self.assertEqual(self.aufrufe(), 1)
        self.trends({'neu': True})
        self.warten()
        self.assertEqual((self.aufrufe(), self.s.zaehler.stand()['n']), (2, 2))

    def test_faellig_nach_trend_tagen_und_pause(self):
        self.modus('trend')
        tr = self.s.trends
        self.assertTrue(tr.faellig())
        tr.starten(warten=True)
        jetzt = time.time()
        self.assertFalse(tr.faellig(jetzt + 3600))
        self.assertFalse(tr.faellig(jetzt + 6 * 86400))
        self.assertTrue(tr.faellig(jetzt + 7 * 86400 + 60))
        tr.k['trend_auto'] = False
        self.assertFalse(tr.faellig(jetzt + 30 * 86400))

    def test_fehler_zaehlt_nicht_und_wartet(self):
        self.modus('login')
        self.s.trends.starten(warten=True)
        self.assertIn('nicht angemeldet', self.s.trends.fehler)
        self.assertEqual(self.s.zaehler.stand()['n'], 0)
        st, d, _ = self.trends()
        self.assertIn('nicht angemeldet', d['letzter_fehler'])
        self.assertIsNone(d['trends'])
        self.assertEqual(self.aufrufe(), 1)

    def test_unlesbare_antwort_zaehlt(self):
        self.modus('kaputt')
        self.s.trends.starten(warten=True)
        self.assertIn('nicht lesbar', self.s.trends.fehler)
        self.assertEqual(self.s.zaehler.stand()['n'], 1)
        self.assertIsNone(self.s.trends.lesen())

    def test_pause_nach_gezaehltem_fehler_ist_24_stunden(self):
        # Ein gezählter Fehler ohne Trends darf nicht alle paar Stunden einen Aufruf vom Monatslimit kosten
        self.modus('kaputt')
        tr = self.s.trends
        tr.starten(warten=True)
        jetzt = time.time()
        self.assertFalse(tr.faellig(jetzt + 23 * 3600))
        self.assertTrue(tr.faellig(jetzt + 25 * 3600))

    def test_pause_nach_fehler_ohne_kosten_ist_6_stunden(self):
        # „nicht angemeldet“ kostet nichts: nach dem Anmelden soll der Proxy nicht einen Tag warten
        self.modus('login')
        tr = self.s.trends
        tr.starten(warten=True)
        jetzt = time.time()
        self.assertFalse(tr.faellig(jetzt + 5 * 3600))
        self.assertTrue(tr.faellig(jetzt + 7 * 3600))
        self.modus('kaputt')
        tr.starten(warten=True)
        self.assertFalse(tr.faellig(time.time() + 23 * 3600))

    def test_alte_trends_bleiben_bei_fehler(self):
        self.modus('trend')
        self.s.trends.starten(warten=True)
        self.modus('absturz')
        self.trends({'neu': True})
        self.warten()
        st, d, _ = self.trends()
        self.assertEqual(len(d['trends']['einkauf']), 2)
        self.assertTrue(d['letzter_fehler'])

    def test_zeitgrenze(self):
        self.k['timeout_trend'] = 1
        self.modus('haengt')
        self.s.trends.starten(warten=True)
        self.assertIn('zu lange', self.s.trends.fehler)
        self.assertEqual(self.s.zaehler.stand()['n'], 1)

    def test_schutz_wie_bei_den_anderen(self):
        self.assertEqual(self.trends(token='falsch')[0], 403)
        self.assertEqual(self.trends(origin='https://evil.example')[0], 403)
        self.assertEqual(self.trends(host='evil.example:80')[0], 403)
        self.assertEqual(self.trends(b'[1]')[0], 400)
        self.assertEqual(self.trends(b'x' * 2000)[0], 413)
        self.assertFalse(self.s.trends.laeuft)
        self.assertEqual(self.aufrufe(), 0)


class KiPreis(Basis):
    def test_preis_kommt_mit_dem_vorschlag(self):
        self.modus('preis')
        st, d, _ = self.req('POST', '/vorschlag', {'name': 'Nike Hoodie grau M', 'bild': PNG, 'zustand': 'Sehr gut', 'groesse': ' M '})
        self.assertEqual(st, 200, d)
        self.assertEqual((d['verkauf_von'], d['verkauf_bis'], d['nachfrage']), (35.0, 35.0, 'hoch'))
        text = json.loads(self.log()['in'])['message']['content'][1]['text']
        self.assertIn('Zustand laut Verkäufer: Sehr gut', text)
        self.assertTrue(text.endswith('\nGröße laut Verkäufer: M'), text)

    def test_ohne_preis_und_ohne_angaben(self):
        self.modus('ok')
        st, d, _ = self.frage()
        self.assertEqual((st, d['verkauf_von'], d['verkauf_bis'], d['nachfrage']), (200, 0, 0, ''))
        text = json.loads(self.log()['in'])['message']['content'][1]['text']
        self.assertNotIn('laut Verkäufer', text)

    def test_falsche_angaben(self):
        for extra in ({'zustand': 5}, {'groesse': ['M']}, {'zustand': 'x' * 41}, {'groesse': 'y' * 31}):
            st, d, _ = self.req('POST', '/vorschlag', dict({'name': 'Nike Hoodie', 'bild': PNG}, **extra))
            self.assertEqual(st, 400, extra)
        self.assertEqual(self.aufrufe(), 0)

    def test_prompt_nennt_preis(self):
        self.assertIn('"verkauf_von":0,"verkauf_bis":0', P.SYSTEM)
        self.assertIn('nur für den Preis, nicht für Titel oder Beschreibung', P.SYSTEM)


class TrendGrenze(Basis):
    limit = 1

    def test_monatsgrenze_gilt_auch_fuer_trends(self):
        self.assertEqual(self.frage()[0], 200)
        self.modus('trend')
        self.s.trends.starten(warten=True)
        self.assertIn('Monatsgrenze', self.s.trends.fehler)
        self.assertEqual(self.aufrufe(), 1)


class Eingaben(Basis):
    def test_ungueltige_eingaben(self):
        for body in ({'name': ''}, {'name': 'x' * 201}, {'name': 5}, {'bild': PNG}, {'name': 'a', 'bild': 'data:text/html;base64,AAAA'},
                     {'name': 'a', 'bild': 'javascript:alert(1)'}, {'name': 'a', 'bild': 7}, b'kein json', [1, 2]):
            st = self.req('POST', '/vorschlag', body)[0]
            self.assertEqual(st, 400, body)
        self.assertEqual(self.aufrufe(), 0)
        self.assertEqual(self.s.zaehler.stand()['n'], 0)

    def test_zu_grosses_foto(self):
        gross = 'data:image/jpeg;base64,' + base64.b64encode(b'\0' * (P.MAX_BILD + 10)).decode()
        self.assertEqual(self.req('POST', '/vorschlag', {'name': 'a', 'bild': gross})[0], 400)

    def test_zu_grosse_anfrage(self):
        # nur die Längenangabe lügt, der Proxy darf den Rest gar nicht erst lesen
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
        c.putrequest('POST', '/vorschlag')
        for k, v in (('Host', '127.0.0.1:%d' % self.port), ('Origin', 'http://127.0.0.1:%d' % self.port), ('X-KI-Token', self.s.token),
                     ('Content-Length', str(P.MAX_BODY + 10))):
            c.putheader(k, v)
        c.endheaders()
        self.assertEqual(c.getresponse().status, 413)
        c.close()
        self.assertEqual(self.aufrufe(), 0)


class Grenze(Basis):
    limit = 2

    def test_monatsgrenze(self):
        self.assertEqual(self.frage()[0], 200)
        self.assertEqual(self.frage()[0], 200)
        st, d, _ = self.frage()
        self.assertEqual(st, 429)
        self.assertIn('Monatsgrenze', d['fehler'])
        self.assertEqual((d['stand']['n'], d['stand']['limit']), (2, 2))
        self.assertEqual(self.aufrufe(), 2)  # das Programm wurde nicht ein drittes Mal gestartet

    def test_zaehler_bleibt_ueber_neustart(self):
        self.frage()
        z = P.Zaehler(P.ZAEHLER_DATEI, 2)
        self.assertEqual(z.stand()['n'], 1)

    def test_neuer_monat_beginnt_bei_null(self):
        with open(P.ZAEHLER_DATEI, 'w') as f:
            json.dump({'monat': '1999-01', 'n': 99}, f)
        self.assertEqual(P.Zaehler(P.ZAEHLER_DATEI, 2).stand()['n'], 0)

    def test_kaputte_zaehlerdatei(self):
        with open(P.ZAEHLER_DATEI, 'w') as f:
            f.write('{kaputt')
        self.assertEqual(P.Zaehler(P.ZAEHLER_DATEI, 2).stand()['n'], 0)
        with open(P.ZAEHLER_DATEI, 'w') as f:
            json.dump({'monat': time.strftime('%Y-%m'), 'n': -5}, f)
        self.assertEqual(P.Zaehler(P.ZAEHLER_DATEI, 2).stand()['n'], 0)


class Gleichzeitig(Basis):
    def test_nur_ein_aufruf_gleichzeitig(self):
        self.modus('langsam')
        erg = []
        t = threading.Thread(target=lambda: erg.append(self.frage()))
        t.start()
        time.sleep(0.4)
        st, d, _ = self.frage()
        t.join()
        self.assertEqual(st, 429)
        self.assertIn('schon', d['fehler'])
        self.assertEqual(erg[0][0], 200)
        self.assertEqual(self.aufrufe(), 1)


class Zeitgrenze(Basis):
    timeout = 1

    def test_zeitueberschreitung_zaehlt(self):
        self.modus('haengt')
        st, d, _ = self.frage()
        self.assertEqual(st, 504)
        self.assertEqual(d['stand']['n'], 1)


class TavilyAttrappe(BaseHTTPRequestHandler):
    """Test-Ersatz für api.tavily.com. Das Verhalten steht in self.server.modus, alles Empfangene in self.server.log."""
    def log_message(self, *a):
        pass

    def _antwort(self, status, obj):
        daten = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(daten)))
        self.end_headers()
        self.wfile.write(daten)

    def do_POST(self):
        s = self.server
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        s.log.append(('POST', self.path, self.headers.get('Authorization'), body))
        if s.modus in ('401', '432'):
            return self._antwort(int(s.modus), {'detail': {'error': 'nein'}})
        self._antwort(201, {'request_id': 'abc12345-xyz', 'created_at': 'x', 'status': 'pending', 'input': 'x', 'model': 'mini', 'response_time': 1})

    def do_GET(self):
        s = self.server
        s.log.append(('GET', self.path, self.headers.get('Authorization'), None))
        fertig = sum(1 for x in s.log if x[0] == 'GET') >= 2 and s.modus != 'haengt'
        if not fertig:
            return self._antwort(202, {'request_id': 'abc12345-xyz', 'status': 'pending', 'response_time': 1})
        if s.modus == 'failed':
            return self._antwort(200, {'request_id': 'abc12345-xyz', 'status': 'failed', 'response_time': 1, 'usage': {'credits': 4}})
        inhalt = TAVILY_INHALT if s.modus != 'text' else json.dumps(TAVILY_INHALT)
        self._antwort(200, {'request_id': 'abc12345-xyz', 'status': 'completed', 'content': inhalt, 'response_time': 9, 'usage': {'credits': 16},
                            'sources': [{'title': 'Vinted Trends', 'url': 'https://www.vinted.de/press', 'favicon': ''},
                                        {'title': 'Böse', 'url': 'javascript:alert(1)', 'favicon': ''},
                                        {'title': 'Mode', 'url': 'https://fashionunited.de/x', 'favicon': ''}]})


TAVILY_INHALT = {'einkauf': [
    {'was': 'Carhartt Detroit Jacket', 'marke': 'Carhartt', 'suche': 'Carhartt Detroit', 'warum': 'Workwear ist gefragt.', 'neupreis': 150, 'verkauf_von': 60, 'verkauf_bis': 90, 'tempo': 'schnell', 'nische': 'nein'},
    {'was': 'Venum Elite Boxhandschuhe', 'marke': 'Venum', 'suche': 'Venum Elite', 'warum': 'Neue Kurse.', 'neupreis': 50, 'verkauf_von': 40, 'verkauf_bis': 50, 'tempo': 'mittel', 'nische': 'ja'},
    {'was': 'Nike Tech Fleece', 'marke': 'Nike', 'suche': 'Nike Tech Fleece', 'warum': 'Herbst.', 'verkauf_von': 35, 'verkauf_bis': 55, 'tempo': 'schnell', 'nische': 'nein'}],
    'einstellen': [{'was': 'Daunenjacken von The North Face', 'warum': 'Es wird kalt.', 'tempo': 'schnell', 'nische': 'Ja'}]}


class TrendTavily(Basis):
    """Mit ki-tavily.key recherchiert Tavily statt Claude: kein Claude-Aufruf, kein Claude-Zähler."""
    KEY = 'tvly-testschluessel1234'

    def setUp(self):
        super().setUp()
        self.tav = ThreadingHTTPServer(('127.0.0.1', 0), TavilyAttrappe)
        self.tav.modus, self.tav.log = 'ok', []
        threading.Thread(target=self.tav.serve_forever, daemon=True).start()
        self.alt = (P.TAVILY_URL, P.TAVILY_WARTEN, P.TAVILY_KEY_DATEI)
        P.TAVILY_URL, P.TAVILY_WARTEN = 'http://127.0.0.1:%d' % self.tav.server_address[1], 0.02
        P.TAVILY_KEY_DATEI = os.path.join(self.dir, 'ki-tavily.key')
        self.schluessel(self.KEY)

    def tearDown(self):
        P.TAVILY_URL, P.TAVILY_WARTEN, P.TAVILY_KEY_DATEI = self.alt
        self.tav.shutdown()
        self.tav.server_close()
        super().tearDown()

    def schluessel(self, text):
        with open(P.TAVILY_KEY_DATEI, 'w') as f:
            f.write(text)

    def test_tavily_statt_claude(self):
        self.modus('trend')
        self.s.trends.starten(warten=True)
        t = self.s.trends.lesen()
        self.assertEqual((self.aufrufe(), self.s.zaehler.stand()['n']), (0, 0))
        self.assertEqual(t['modell'], 'Tavily')
        self.assertEqual([e['nische'] for e in t['einkauf']], [False, True, False])
        self.assertTrue(t['einstellen'][0]['nische'])
        # Deckel: gebraucht höchstens 60 % vom Neupreis (Venum neu 50 € wird 30 €), ohne Neupreis und unter dem Deckel bleibt der Preis
        self.assertEqual([(e['verkauf_von'], e['verkauf_bis']) for e in t['einkauf']], [(60, 90), (30, 30), (35, 55)])
        self.assertEqual([q['url'] for q in t['quellen']], ['https://www.vinted.de/press', 'https://fashionunited.de/x'])
        post = self.tav.log[0]
        self.assertEqual((post[0], post[1], post[2]), ('POST', '/research', 'Bearer ' + self.KEY))
        self.assertEqual(post[3]['model'], 'mini')
        self.assertIn('einkauf', post[3]['output_schema']['properties'])
        self.assertIn('Kampfsport', post[3]['input'])
        self.assertNotIn('16', post[3]['input'])
        self.assertEqual(self.tav.log[1][:2], ('GET', '/research/abc12345-xyz?include_usage=true'))

    def test_antwort_als_text(self):
        self.tav.modus = 'text'
        self.s.trends.starten(warten=True)
        self.assertEqual(len(self.s.trends.lesen()['einkauf']), 3)

    def test_falscher_schluessel_kostet_nichts_und_wartet_kurz(self):
        self.tav.modus = '401'
        self.s.trends.starten(warten=True)
        self.assertIn('Schlüssel', self.s.trends.fehler)
        self.assertNotIn(self.KEY, self.s.trends.fehler)
        jetzt = time.time()
        self.assertEqual((self.aufrufe(), self.s.zaehler.stand()['n']), (0, 0))
        self.assertFalse(self.s.trends.faellig(jetzt + 5 * 3600))
        self.assertTrue(self.s.trends.faellig(jetzt + 7 * 3600))

    def test_tavily_limit(self):
        self.tav.modus = '432'
        self.s.trends.starten(warten=True)
        self.assertIn('Tavily-Limit', self.s.trends.fehler)

    def test_gescheiterte_recherche_wartet_24_stunden(self):
        self.tav.modus = 'failed'
        self.s.trends.starten(warten=True)
        self.assertIn('nicht abschließen', self.s.trends.fehler)
        self.assertFalse(self.s.trends.faellig(time.time() + 23 * 3600))
        self.assertEqual(self.s.zaehler.stand()['n'], 0)

    def test_zeitgrenze(self):
        self.tav.modus = 'haengt'
        self.s.trends.k['timeout_trend'] = 0.3
        self.s.trends.starten(warten=True)
        self.assertIn('zu lange', self.s.trends.fehler)

    def test_ohne_gueltigen_schluessel_recherchiert_claude(self):
        self.modus('trend')
        for text in ('', 'kein-schluessel'):
            self.schluessel(text)
            self.s.trends.versuch = 0
            self.s.trends.starten(warten=True)
        os.remove(P.TAVILY_KEY_DATEI)
        self.s.trends.starten(warten=True)
        self.assertEqual((self.aufrufe(), self.tav.log), (3, []))
        self.assertEqual(self.s.trends.lesen()['modell'], P.KONFIG['modell_trend'])

    def test_schluessel_steht_nirgends(self):
        self.s.trends.starten(warten=True)
        st, d, _ = self.req('POST', '/trends', {})
        self.assertNotIn(self.KEY, json.dumps(d))
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=30)
        c.request('GET', '/ki', headers={'Host': '127.0.0.1:%d' % self.port})
        seite = c.getresponse().read().decode()
        self.assertNotIn(self.KEY, seite)
        self.assertIn('Tavily', seite)


class Hilfen(unittest.TestCase):
    def test_bereinigen(self):
        b = P.bereinigen({'titel': '  „Nike   Hoodie“ ', 'beschreibung': 'a \r\nb\x07', 'fehlt': ['Größe', '', 5, 'x' * 99] + ['n'] * 9})
        self.assertEqual(b['titel'], 'Nike Hoodie')
        self.assertEqual(b['beschreibung'], 'a\nb')
        self.assertEqual(len(b['fehlt']), 4)  # leer und Zahl fallen raus, höchstens 6 vor dem Filtern
        self.assertIsNone(P.bereinigen({'titel': '', 'beschreibung': 'x'}))
        self.assertIsNone(P.bereinigen('text'))
        self.assertEqual(len(P.bereinigen({'titel': 'a' * 300, 'beschreibung': 'b' * 5000})['titel']), 80)

    def test_bereinigen_entfernt_platzhalter_und_zustandsaussagen(self):
        b = P.bereinigen({'titel': 'Polo Ralph Lauren Sweatshirt blau, Gr. unbekannt', 'beschreibung': 'Polo Ralph Lauren Sweatshirt in Blau.\nIm Foto sieht man den Schnitt gut; Material und Zustand bitte in der Anzeige ergänzen.\nAuf den Fotos sind keine Mängel zu erkennen.\nFür den Alltag.', 'fehlt': []})
        self.assertEqual(b['titel'], 'Polo Ralph Lauren Sweatshirt blau')
        self.assertEqual(b['beschreibung'], 'Polo Ralph Lauren Sweatshirt in Blau.\nFür den Alltag.')
        self.assertIsNone(P.bereinigen({'titel': 'Größe unbekannt', 'beschreibung': 'Text'}))
        self.assertIsNone(P.bereinigen({'titel': 'Hoodie', 'beschreibung': 'Zustand bitte ergänzen.'}))

    def test_bereinigen_nimmt_nur_stoerende_saetze_raus(self):
        # Version 8.3: Satz für Satz statt ganzer Zeilen. test.js prüft dieselben Fälle mit vorschlagSauber.
        f = lambda b: (P.bereinigen({'titel': 'Hoodie', 'beschreibung': b}) or {}).get('beschreibung')
        # So schrieb Haiku am 16.10.2026 ohne Foto
        self.assertEqual(f('Nike Hoodie in Grau, Gr. M. Material, Zustand und Passform prüfe ich vor dem Einstellen noch genau.\nPasst zu Jeans.'), 'Nike Hoodie in Grau, Gr. M.\nPasst zu Jeans.')
        self.assertEqual(f('Zara Poloshirt in Rosa, Gr. S. Passt z. B. zu Chinos.'), 'Zara Poloshirt in Rosa, Gr. S. Passt z. B. zu Chinos.')
        self.assertEqual(f('Nike Hoodie in Grau, Gr. M, neu mit Etikett.\nSehr guter Zustand, Nichtraucherhaushalt.\nVersand mit DHL. Bei Fragen einfach melden!'), 'Nike Hoodie in Grau, Gr. M, neu mit Etikett.')
        self.assertEqual(f('Jacke mit Lochmuster und Flecktarn.\nFällt etwas kleiner aus. Kapuze.\n\n\n\nPasst zu Cargos.'), 'Jacke mit Lochmuster und Flecktarn.\nKapuze.\n\nPasst zu Cargos.')
        self.assertEqual(f('Gi in Weiß.\nMaße auf Anfrage. Kleiner Fleck am Ärmel. Weiches Material, bequem. Neupreis 90 €.\nFürs Training.'), 'Gi in Weiß.\nFürs Training.')
        self.assertIsNone(f('Laut Artikelname ein Hoodie. Auf dem Foto nicht erkennbar.'))
        self.assertEqual(P.bereinigen({'titel': 'Hoodie', 'beschreibung': 'x', 'fehlt': ['Foto', 'fotos', 'Zustand', 'Foto vom Etikett']})['fehlt'], ['Zustand', 'Foto vom Etikett'])

    def test_stoert_wie_im_helfer(self):
        # vorschlagSauber in index.html nutzt wortgleich dieselben Muster wie bereinigen()
        html = open(os.path.join(HIER, 'index.html'), encoding='utf-8').read()
        for name, muster, flags in (('STOERT', P.STOERT, 'i'), ('SATZ_GRENZE', P.SATZ_GRENZE, ''), ('ABKUERZUNG', P.ABKUERZUNG, '')):
            m = re.search(r'\nconst %s=/(.+)/(\w*);\n' % name, html)
            self.assertIsNotNone(m, '%s fehlt in index.html' % name)
            self.assertEqual((m.group(1), m.group(2)), (muster.pattern, flags), '%s weicht von ki-proxy.py ab' % name)

    def test_bereinigen_kauf(self):
        b = P.bereinigen_kauf({'marke': ' Venum\n', 'verkauf_von': 60, 'verkauf_bis': 45, 'nachfrage': 'sehr hoch', 'einschaetzung': 'Lohnt\x07 sich.',
                               'echtheit': ['a', '', 3, 'b', 'c', 'd', 'e'], 'fragen': 'kein Array', 'risiken': ['x' * 99]})
        self.assertEqual((b['marke'], b['verkauf_von'], b['verkauf_bis'], b['nachfrage'], b['einschaetzung']), ('Venum', 45, 60, '', 'Lohnt sich.'))
        self.assertEqual((b['echtheit'], b['fragen'], len(b['risiken'][0])), (['a', 'b', 'c', 'd'], [], 60))
        self.assertEqual(P.bereinigen_kauf({'verkauf_von': '50', 'verkauf_bis': True, 'einschaetzung': 'x'})['verkauf_bis'], 0)
        self.assertEqual(P.bereinigen_kauf({'verkauf_bis': 50})['verkauf_von'], 50)
        self.assertIsNone(P.bereinigen_kauf({'titel': 'Nike', 'beschreibung': 'Text'}))
        self.assertIsNone(P.bereinigen_kauf([]))

    def test_proxy_haertung(self):
        self.assertEqual(P.Handler.timeout, 30)  # keine endlos offene Verbindung
        self.assertNotIn('http://localhost:8766', P.KONFIG['origins'])
        self.assertEqual(len(P.KONFIG['origins']), 3)

    def test_kauf_check_schreibt_verkaufstext(self):
        k = {'einschaetzung': 'Lohnt sich.', 'titel': ' "Nike Hoodie grau Gr. M" ', 'beschreibung': 'Nike Hoodie in Grau, Gr. M.\nMit Kapuze.\nZustand: sehr gut.\nPasst zu Jeans.'}
        b = P.bereinigen_kauf(k)
        self.assertEqual((b['titel'], b['beschreibung']), ('Nike Hoodie grau Gr. M', 'Nike Hoodie in Grau, Gr. M.\nMit Kapuze.\nPasst zu Jeans.'))  # Zustand fliegt raus wie beim Vorschlag
        for kaputt in ({'titel': 'Hoodie unbekannt'}, {'beschreibung': ''}, {'titel': 5, 'beschreibung': []}):
            b = P.bereinigen_kauf({**k, **kaputt})
            self.assertEqual((b['titel'], b['beschreibung'], b['einschaetzung']), ('', '', 'Lohnt sich.'))  # Kauf-Check bleibt gültig
        self.assertIn(P.TEXT_REGELN, P.SYSTEM_KAUF)
        self.assertIn(P.TEXT_REGELN, P.SYSTEM)

    def test_text_sauber(self):
        self.assertEqual(P.text_sauber('Mail: a.b@web.de, Tel. +49 176 1234567, https://x.de/y\r\n'), 'Mail: [E-Mail], Tel. [Nummer], [Link]')
        self.assertEqual(P.text_sauber('Länge 72 cm, Gr. 152 164'), 'Länge 72 cm, Gr. 152 164')
        self.assertEqual(P.text_sauber('Größen 152 / 158 / 164, Brust 52 54 56 58 60 cm, gekauft 2024-10-23'), 'Größen 152 / 158 / 164, Brust 52 54 56 58 60 cm, gekauft 2024-10-23')
        self.assertEqual(P.text_sauber('Tel 030 12345678, 0049 176 1234567, +49 (0)176 1234567'), 'Tel [Nummer], [Nummer], [Nummer]')
        self.assertEqual(len(P.text_sauber('x' * 5000)), P.MAX_TEXT)

    def test_json_aus_text(self):
        self.assertEqual(P.json_aus_text('Hier: {"a": 1} Ende'), {'a': 1})
        self.assertEqual(P.json_aus_text('{"a": 1}'), {'a': 1})
        self.assertIsNone(P.json_aus_text('nichts'))
        self.assertIsNone(P.json_aus_text('{kaputt}'))

    def test_claude_finden_nimmt_neueste_kopie(self):
        with tempfile.TemporaryDirectory() as home:
            for v in ('2.1.9', '2.1.10', '2.1.295'):
                d = os.path.join(home, 'Library/Application Support/Claude/claude-code', v, 'abc/claude.app/Contents/MacOS')
                os.makedirs(d)
                open(os.path.join(d, 'claude'), 'w').close()
            alt_home, alt_which = os.environ.get('HOME'), P.shutil.which
            os.environ['HOME'] = home
            P.shutil.which = lambda x: None
            try:
                self.assertIn('/2.1.295/', P.claude_finden({'claude': None}))
                self.assertIsNone(P.claude_finden({'claude': '/gibt/es/nicht'}))
            finally:
                os.environ['HOME'] = alt_home
                P.shutil.which = alt_which

    def test_freundliche_fehler(self):
        self.assertIn('nicht angemeldet', P.freundlich('Not logged in · Please run /login'))
        self.assertIn('Limit', P.freundlich('Claude usage limit reached'))
        self.assertIn('boom', P.freundlich('boom'))

    def test_standard_modelle_und_100(self):
        # KI-Vorschlag mit Sonnet seit 20.10.2026 (Wahl nach dem Vergleich mit Haiku)
        self.assertEqual((P.KONFIG['modell'], P.KONFIG['limit']), ('claude-sonnet-5-5', 100))
        self.assertEqual(P.KONFIG['modell_kauf'], 'claude-sonnet-5-5')
        self.assertEqual((P.KONFIG['modell_trend'], P.KONFIG['trend_tage'], P.KONFIG['trend_auto']), ('claude-sonnet-5-5', 7, True))

    def test_trend_auto_per_umgebung_aus(self):
        os.environ['VINTED_KI_TREND_AUTO'], os.environ['VINTED_KI_TREND_TAGE'] = 'aus', '3'
        try:
            k = P.konfig()
        finally:
            del os.environ['VINTED_KI_TREND_AUTO'], os.environ['VINTED_KI_TREND_TAGE']
        self.assertEqual((k['trend_auto'], k['trend_tage']), (False, 3))

    def test_bereinigen_trend(self):
        d = P.bereinigen_trend({'einkauf': [{'was': ' Nike  Tech Fleece ', 'tempo': 'schnell', 'verkauf_von': 50, 'verkauf_bis': 30, 'nische': 'ja'},
                                            {'was': 'Vase', 'tempo': 'langsam'}, {'was': '', 'tempo': 'schnell'}, 'kaputt',
                                            {'was': 'x' * 300, 'verkauf_bis': True}] + [{'was': 'T%d' % i, 'tempo': 'mittel'} for i in range(10)],
                                'einstellen': [{'was': 'Gis', 'tempo': 'schnell', 'nische': True}],
                                'quellen': [{'titel': '', 'url': 'https://example.org/a'}, {'url': 'http://example.org'}, {'url': 'https://x'},
                                            {'url': 'https://e.de/<script>'}, {'url': 5}]})
        e = d['einkauf']
        self.assertEqual(len(e), 8)
        self.assertEqual(e[0], {'was': 'Nike Tech Fleece', 'marke': '', 'suche': 'Nike Tech Fleece', 'warum': '', 'verkauf_von': 30.0,
                                'verkauf_bis': 50.0, 'tempo': 'schnell', 'nische': False})
        self.assertEqual((len(e[1]['was']), e[1]['tempo'], e[1]['verkauf_bis']), (80, 'mittel', 0))
        self.assertEqual(d['einstellen'], [{'was': 'Gis', 'warum': '', 'tempo': 'schnell', 'nische': True}])
        self.assertEqual(d['quellen'], [{'titel': 'example.org', 'url': 'https://example.org/a'}])
        self.assertIsNone(P.bereinigen_trend({'einkauf': [{'was': 'Vase', 'tempo': 'langsam'}]}))
        self.assertIsNone(P.bereinigen_trend([]))

    def test_umgebungsvariablen_schalten_modell_um(self):
        os.environ['VINTED_KI_MODELL'], os.environ['VINTED_KI_LIMIT'] = 'claude-sonnet-5-5', '50'
        os.environ['VINTED_KI_MODELL_KAUF'] = 'claude-haiku-5-5'
        try:
            k = P.konfig()
        finally:
            del os.environ['VINTED_KI_MODELL'], os.environ['VINTED_KI_LIMIT'], os.environ['VINTED_KI_MODELL_KAUF']
        self.assertEqual((k['modell'], k['limit'], k['modell_kauf']), ('claude-sonnet-5-5', 50, 'claude-haiku-5-5'))

    def test_app_regeln_wie_im_proxy(self):
        # Claude-App-Weg (Version 8.2): Die Fragen im Helfer nutzen wortgleich dieselben Regeln wie der Proxy
        html = open(os.path.join(HIER, 'index.html'), encoding='utf-8').read()
        for name, system in (('vorschlag', P.SYSTEM), ('kauf', P.SYSTEM_KAUF), ('trends', P.SYSTEM_TREND)):
            m = re.search(r'\n%s:`([^`]*)`' % name, html)
            self.assertIsNotNone(m, 'APP_REGELN.%s fehlt in index.html' % name)
            self.assertEqual(m.group(1), system, 'APP_REGELN.%s weicht von ki-proxy.py ab' % name)
        n = re.search(r"const NISCHEN='([^']*)'", html)
        self.assertIsNotNone(n, 'NISCHEN fehlt in index.html')
        self.assertEqual(n.group(1), P.KONFIG['nischen'])

    def test_trend_nachricht_wie_in_der_app(self):
        # gleicher Satz wie trendSatz() im Helfer (test.js prüft dort denselben Text)
        t = time.mktime((2026, 10, 16, 12, 0, 0, 0, 0, -1))
        inhalt = json.loads(P.trend_nachricht(t))['message']['content'][0]['text']
        self.assertEqual(inhalt, 'Heute ist der 16.10.2026 (Oktober). Recherchiere, was sich auf Vinted in Deutschland in den nächsten 2 Wochen schnell verkauft.')

    def test_origins_passen_zu_index_html(self):
        html = open(os.path.join(HIER, 'index.html'), encoding='utf-8').read()
        m = re.search(r"const KI_ORIGINS=(\[[^\]]*\])", html)
        self.assertIsNotNone(m, 'KI_ORIGINS fehlt in index.html')
        self.assertEqual(json.loads(m.group(1).replace("'", '"')), P.KONFIG['origins'])
        o = re.search(r"const KI_ORIGIN='([^']+)'", html)
        self.assertEqual(o.group(1), 'http://127.0.0.1:%d' % P.KONFIG['port'])


if __name__ == '__main__':
    unittest.main(verbosity=1)
