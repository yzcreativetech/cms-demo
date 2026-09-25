"""Run with Python and installed Chrome; serves local fixtures, never Supabase."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
TEST = (ROOT / 'tests/step10-image-upload.js').read_text(encoding='utf-8')

requests = []
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args): pass
    def do_GET(self):
        requests.append(('GET', self.path))
        if self.path in ('/fixture', '/reload-fixture'):
            html = (ROOT / 'admin/index.html').read_text(encoding='utf-8')
            html = html.replace('<head>', '<head><base href="/admin/"><script>window.testErrors=[];window.addEventListener("error",e=>testErrors.push(e.message));window.addEventListener("unhandledrejection",e=>testErrors.push(String(e.reason)));</script>')
            html = html.replace('<script type="module" src="js/admin-auth.js"></script>', '')
            if self.path == '/fixture': html = html.replace('<script type="module" src="js/homepage-editor.js"></script>', '<script type="module" src="/test.js"></script>')
            self.send_text(html, 'text/html')
        elif self.path == '/test.js': self.send_text(TEST, 'text/javascript')
        elif self.path == '/admin/js/supabase-client.js':
            self.send_text((ROOT / 'tests/step9-client.js').read_text(encoding='utf-8'), 'text/javascript')
        elif self.path.startswith('/storage/v1/object/public/cms-demo/'):
            self.send_text('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>', 'image/svg+xml')
        else: super().do_GET()
    def send_text(self, text, kind):
        try:
            self.send_response(200); self.send_header('Content-Type', kind); self.end_headers(); self.wfile.write(text.encode())
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            # Replacing previews/removing the reload frame cancels image requests.
            pass
    def do_POST(self):
        requests.append(('POST', self.path)); self.send_error(405)
    do_PATCH = do_POST
    do_PUT = do_POST
    do_DELETE = do_POST

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
chrome = Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
with tempfile.TemporaryDirectory(prefix='vca-image-') as profile:
    run = subprocess.run([str(chrome), '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--user-data-dir='+profile, '--dump-dom', '--virtual-time-budget=15000', f'http://127.0.0.1:{server.server_port}/fixture'], capture_output=True, text=True, encoding='utf-8', timeout=45)
    start = run.stdout.find('<pre id="test-results">')
    result = run.stdout[start:run.stdout.find('</pre>', start)]
    print(result)
    print('Non-GET requests:', [r for r in requests if r[0] != 'GET'])
    server.shutdown()
    if 'test-results">PASS' not in result or any(r[0] != 'GET' for r in requests):
        print(run.stderr[-2000:]); raise SystemExit(1)
