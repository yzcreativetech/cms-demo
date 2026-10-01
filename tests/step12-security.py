"""Live Security QA with public configuration. --admin opens an interactive login.

No credentials are accepted by this server or written to its reports. Only use
against the demo: admin QA creates/deletes a temporary announcement, performs a
homepage no-op UPDATE, and leaves one Storage image for Dashboard cleanup.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import subprocess
import tempfile
import threading
import sys

ROOT = Path(__file__).resolve().parents[1]
ADMIN = '--admin' in sys.argv
finished = threading.Event()
result = []


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/security-qa':
            body = ('<!doctype html><title>VCA Security QA</title>'
                    '<h1>VCA Security QA</h1><p id="status">Running anonymous checks...</p>'
                    '<pre id="results"></pre><div id="browser"></div>'
                    '<script>window.adminQA=' + str(ADMIN).lower() + ';</script>'
                    '<script type="module" src="/tests/step12-security.js"></script>').encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
            return
        # Serve only project assets; never expose Git, dotfiles, or directories.
        path = self.path.split('?', 1)[0]
        target = Path(self.translate_path(path)).resolve()
        if (not target.is_relative_to(ROOT) or target.is_dir()
                or any(part.startswith('.') for part in target.relative_to(ROOT).parts)):
            self.send_error(404)
            return
        if path in ['/admin/login.html', '/admin/index.html', '/admin/security-bypass.html']:
            # Install before SDK initialization; never retain URLs, headers or bodies.
            instrumentation = '''<script>window.qaAuthResponses=[];
const qaFetch=window.fetch;window.fetch=async(...args)=>{
const response=await qaFetch(...args);const url=String(args[0]?.url??args[0]);
if(url.includes('/auth/v1/token'))qaAuthResponses.push({operation:'login',status:response.status});
if(url.includes('/auth/v1/logout'))qaAuthResponses.push({operation:'logout',status:response.status});
return response;};</script>'''
            if path == '/admin/security-bypass.html':
                target = ROOT / 'admin' / 'index.html'
            html = target.read_text(encoding='utf-8')
            if path == '/admin/security-bypass.html':
                # Test-only DOM bypass. The production file is never changed.
                html = html.replace('<script type="module" src="js/admin-auth.js"></script>', '')
            body = html.replace('<head>', '<head>' + instrumentation).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self.path != '/security-result':
            self.send_error(405)
            return
        size = int(self.headers.get('Content-Length', '0'))
        if size > 50000:
            self.send_error(413)
            return
        data = json.loads(self.rfile.read(size))
        # The runner only sends test labels, status codes, booleans and QA paths.
        result.append(data)
        self.send_response(200)
        self.end_headers()
        finished.set()


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
with tempfile.TemporaryDirectory(prefix='vca-security-') as profile:
    args = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
            '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--disable-background-networking', '--user-data-dir=' + profile]
    if not ADMIN:
        args.append('--headless')
    url = f'http://127.0.0.1:{server.server_port}/security-qa'
    print(('Sign in within the QA window: ' if ADMIN else 'Running live anonymous browser QA: ') + url, flush=True)
    process = subprocess.Popen(args + [url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        # Main process remains pollable; tool calls need not block on this wait.
        finished.wait(900 if ADMIN else 180)
        if result:
            report = json.dumps(result[0], indent=2)
            print(report, flush=True)
            (ROOT / 'tests' / ('step12-admin-results.json' if ADMIN else 'step12-anonymous-results.json')).write_text(report + '\n', encoding='utf-8')
        else:
            print('INCOMPLETE: Browser checks timed out; no acceptance inferred.', flush=True)
    finally:
        process.terminate()
        process.wait(timeout=10)
        server.shutdown()
    if not result or any(row['result'] == 'FAIL' for row in result[0]['checks']):
        raise SystemExit(1)
