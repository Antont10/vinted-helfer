#!/usr/bin/env python3
"""Testet ki-proxy.py mit einem Test-Ersatz für "claude". Kein Netz, kein Abo, kein Verbrauch.
Start: python3 test_proxy.py"""
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
if modus == 'ok':
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
        self.assertIn('claude-haiku-5-5', txt)

    def test_falscher_host(self):
        self.assertEqual(self.req('GET', '/ki', host='evil.example:80')[0], 403)
        self.assertEqual(self.frage(host='evil.example:80')[0], 403)
        self.assertEqual(self.aufrufe(), 0)

    def test_fremder_origin_oder_kein_origin(self):
        self.assertEqual(self.frage(origin='https://evil.example')[0], 403)
        self.assertEqual(self.frage(origin=None)[0], 403)
        self.assertEqual(self.frage(origin='https://antont10.github.io')[0], 403)  # der Helfer fragt nie direkt
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
        self.assertEqual(a[a.index('--model') + 1], 'claude-haiku-5-5')
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
        b = P.bereinigen({'titel': 'Polo Ralph Lauren Sweatshirt grau, Gr. unbekannt', 'beschreibung': 'Polo Ralph Lauren Sweatshirt in Grau.\nIm Foto sieht man den Schnitt gut; Material und Zustand bitte in der Anzeige ergänzen.\nAuf den Fotos sind keine Mängel zu erkennen.\nFür den Alltag.', 'fehlt': []})
        self.assertEqual(b['titel'], 'Polo Ralph Lauren Sweatshirt grau')
        self.assertEqual(b['beschreibung'], 'Polo Ralph Lauren Sweatshirt in Grau.\nFür den Alltag.')
        self.assertIsNone(P.bereinigen({'titel': 'Größe unbekannt', 'beschreibung': 'Text'}))
        self.assertIsNone(P.bereinigen({'titel': 'Hoodie', 'beschreibung': 'Zustand bitte ergänzen.'}))

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

    def test_standard_ist_haiku_und_100(self):
        self.assertEqual((P.KONFIG['modell'], P.KONFIG['limit']), ('claude-haiku-5-5', 100))

    def test_umgebungsvariablen_schalten_modell_um(self):
        os.environ['VINTED_KI_MODELL'], os.environ['VINTED_KI_LIMIT'] = 'claude-sonnet-5-5', '50'
        try:
            k = P.konfig()
        finally:
            del os.environ['VINTED_KI_MODELL'], os.environ['VINTED_KI_LIMIT']
        self.assertEqual((k['modell'], k['limit']), ('claude-sonnet-5-5', 50))

    def test_origins_passen_zu_index_html(self):
        html = open(os.path.join(HIER, 'index.html'), encoding='utf-8').read()
        m = re.search(r"const KI_ORIGINS=(\[[^\]]*\])", html)
        self.assertIsNotNone(m, 'KI_ORIGINS fehlt in index.html')
        self.assertEqual(json.loads(m.group(1).replace("'", '"')), P.KONFIG['origins'])
        o = re.search(r"const KI_ORIGIN='([^']+)'", html)
        self.assertEqual(o.group(1), 'http://127.0.0.1:%d' % P.KONFIG['port'])


if __name__ == '__main__':
    unittest.main(verbosity=1)
