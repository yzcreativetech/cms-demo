"""Real browser E2E QA. Default: interactive manual CMS login; --public-only: read-only.

Credentials remain in the isolated Chrome profile and Supabase. Reports contain
only public content snapshots, fixed check labels, status codes and QA paths.
Use --verify-cleanup after manually removing the reported Storage object.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import base64
import json
import os
import re
import socket
import struct
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RESULT = ROOT / 'tests/step13-e2e-results.json'
REPORT = ROOT / 'tests/step13-e2e-report.md'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--public-only', action='store_true')
parser.add_argument('--verify-cleanup', action='store_true')
args = parser.parse_args()
finished = threading.Event()
latest = {}
profile_path = None
write_lock = threading.Lock()


def write_report(data):
    checks = data.get('checks', [])
    passed = sum(row['result'] == 'PASS' for row in checks)
    failed = sum(row['result'] == 'FAIL' for row in checks)
    pending = sum(row['result'] == 'PENDING' for row in checks)
    complete = (data.get('phase') == 'finished' and data.get('mode') == 'full'
                and data.get('writesStarted') and data.get('restored') and not failed and not pending)
    data['summary'] = {'passed': passed, 'failed': failed, 'pending': pending,
                       'overall': 'PASS' if complete else 'INCOMPLETE' if not failed else 'FAIL'}
    RESULT.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    lines = ['# Step 13 End-to-End QA', '', '**Overall: ' + data['summary']['overall'] + '**', '',
             f'Checks: {passed} passed; {failed} failed; {pending} pending. Mode: {data.get("mode")}; phase: {data.get("phase")}.', '',
             '## Acceptance matrix', '', '| Area | Check | Result | Evidence |', '|---|---|---|---|']
    for row in checks:
        detail = json.dumps(row.get('detail', {}), ensure_ascii=True).replace('|', '\\|')
        lines.append(f'| {row["area"]} | {row["test"]} | {row["result"]} | {detail if detail != "{}" else ""} |')
    lines += ['', '## Snapshot, restoration, and artifacts', '',
              '- The JSON result contains the public pre-QA database snapshot, IDs, ordering, timestamps, and all three original image references. No credentials or auth payloads are collected.',
              '- Restoration compares every original content field, image reference, record ID, created_at, and announcement order. The automatic updated_at triggers advance on actual writes; that metadata is reported separately and is not reset by weakening database behavior.',
              '- The run uses the real UI and live Supabase for saves; instrumentation records method/table/status only. Expected network failure is injected only for the static fallback check.',
              '- Responsive checks measure overflow, form/button bounds, text size, image fitting, navigation bounds, section overlap, and status visibility at 1440/1200/1024/800/650/390 CSS pixels. Screenshots are temporary review artifacts, outside the repository.',
              '- A UI save is restored through the UI when possible; a finally block independently reconciles the snapshot through the authorized client if needed.', '']
    for artifact in data.get('artifacts', []):
        lines.append(f'- Storage `{artifact["path"]}`: {artifact["state"]}.')
    if not data.get('artifacts'):
        lines.append('- No recorded Storage upload.')
    if data.get('finalIntegrity'):
        integrity = data['finalIntegrity']
        lines += ['', 'Final integrity: ' + json.dumps(integrity, ensure_ascii=True), '']
    if data.get('publishedVerification'):
        lines += ['', '## Published demo', '',
                  '- Verified existing deployment: ' + data['publishedVerification']['url'],
                  '- The public, login, and editor HTML and frontend configuration matched local files. A fresh logged-out Chrome browser verified live content, images, announcements, demo labeling, and absence of editing controls.',
                  '- Authenticated editing was exercised against live Supabase through the local QA origin. No new deployment or published-origin admin login was performed.', '']
    if data.get('visualReview'):
        lines += ['', '## Visual review', '',
                  '- Reviewed public, login, and editor screenshots at desktop, tablet, and mobile widths. No overlapping sections, clipped navigation/actions, distorted images, or obscured status messages were observed.', '']
    if complete and data.get('milestoneStatus') == 'COMPLETE':
        lines += ['', '## Final milestone', '',
                  '**STEP 13: COMPLETE. VCA Philippines CMS Demo: COMPLETE.** There is no Step 14. Prior milestone history is preserved.',
                  'No application code or security-policy correction was needed. The only tracked-file change is `milestone.md`; the four Step 13 QA files are new. Nothing was staged, committed, or pushed.', '']
    lines += ['', '## Scope and handoff', '',
              '- Local browser workflow and repository-subpath asset resolution are covered. Published-demo acceptance is recorded separately when a published URL is supplied/confirmed.',
              '- Do not mark the milestone COMPLETE until the full workflow passes, content is restored, and every recorded Storage object is confirmed absent.',
              '- Run `python tests/step13-e2e.py --verify-cleanup` after manual Dashboard removal. No Storage DELETE policy is added.',
              '- No staging, commit, push, or deployment is performed by this runner.', '']
    REPORT.write_text('\n'.join(lines), encoding='utf-8')


def verify_cleanup():
    data = json.loads(RESULT.read_text(encoding='utf-8'))
    source = (ROOT / 'admin/js/supabase-client.js').read_text(encoding='utf-8')
    url = re.search(r'const SUPABASE_URL = "([^"]+)"', source)[1]
    for artifact in data.get('artifacts', []):
        if not re.fullmatch(r'cms-demo/hero/[A-Za-z0-9-]+\.png', artifact['path']):
            raise ValueError('Unexpected artifact path; no request performed')
        request = urllib.request.Request(url + '/storage/v1/object/public/' + artifact['path'] + '?e2e_cleanup=' + str(time.time_ns()), headers={'Cache-Control': 'no-cache'})
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                artifact['state'] = 'PRESENT' if response.status == 200 else 'UNVERIFIED'
        except urllib.error.HTTPError as error:
            body = json.loads(error.read())
            artifact['state'] = 'REMOVED' if str(body.get('statusCode')) == '404' and body.get('code') == 'NoSuchKey' else 'UNVERIFIED'
        except (OSError, ValueError):
            artifact['state'] = 'UNVERIFIED'
    for row in data['checks']:
        if row['test'] == 'Temporary Storage artifacts removed':
            row['result'] = 'PASS' if all(a['state'] == 'REMOVED' for a in data.get('artifacts', [])) else 'PENDING'
            row['detail'] = {'verification': 'Cache-busted public GET; Storage 404 / NoSuchKey required', 'objects': len(data.get('artifacts', []))}
    write_report(data)
    print(json.dumps({'summary': data['summary'], 'artifacts': data.get('artifacts', [])}, indent=2))


def cdp(method, params, target_url='/e2e-qa'):
    """Small local WebSocket client for read-only browser QA; no auth inspection."""
    port = int((profile_path / 'DevToolsActivePort').read_text().splitlines()[0])
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list') as response:
        pages = json.load(response)
    page = next(p for p in pages if p.get('type') == 'page' and target_url in p.get('url', ''))
    from urllib.parse import urlsplit
    target = urlsplit(page['webSocketDebuggerUrl'])
    connection = socket.create_connection((target.hostname, target.port), timeout=20)
    connection.sendall((f'GET {target.path} HTTP/1.1\r\nHost: {target.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {base64.b64encode(os.urandom(16)).decode()}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
    header = b''
    while not header.endswith(b'\r\n\r\n'):
        header += connection.recv(1)
    if b' 101 ' not in header.split(b'\r\n')[0]:
        raise RuntimeError('CDP handshake failed')
    payload = json.dumps({'id': 1, 'method': method, 'params': params}).encode()
    mask = os.urandom(4)
    length = len(payload)
    prefix = bytes([0x81, 0x80 | length]) if length < 126 else bytes([0x81, 0xfe]) + struct.pack('!H', length)
    connection.sendall(prefix + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def receive(size):
        chunks = b''
        while len(chunks) < size:
            part = connection.recv(size - len(chunks))
            if not part:
                raise RuntimeError('CDP closed')
            chunks += part
        return chunks

    assembled = b''
    try:
        while True:
            first, second = receive(2)
            size = second & 127
            if size == 126:
                size = struct.unpack('!H', receive(2))[0]
            elif size == 127:
                size = struct.unpack('!Q', receive(8))[0]
            assembled += receive(size)
            if first & 0x80:
                message = json.loads(assembled)
                assembled = b''
                if message.get('id') == 1:
                    return message['result']
    finally:
        connection.close()


INSTRUMENT = '''<script>
window.qa={requests:[],errors:0,confirmations:0,answer:true};
addEventListener('error',()=>qa.errors++);addEventListener('unhandledrejection',()=>qa.errors++);
window.confirm=()=>{qa.confirmations++;return qa.answer;};
const originalFetch=window.fetch;window.fetch=async(input,init)=>{
 const url=new URL(input.url||String(input),location.href);const method=init?.method||input.method||'GET';
 const area=url.pathname.includes('/rest/v1/')?'database':url.pathname.includes('/storage/v1/')?'storage':url.pathname.includes('/auth/v1/')?'auth':'other';
 const resource=area==='database'?url.pathname.split('/').pop():area==='auth'?(url.pathname.includes('/logout')?'logout':url.pathname.includes('/token')?'login':'session'):'object';
 const entry={area,resource,method,status:null};qa.requests.push(entry);
 if(location.search.includes('e2e-fallback')&&area==='database')throw new Error('Expected QA fallback');
 const response=await originalFetch(input,init);entry.status=response.status;
 if(area==='storage'&&method==='POST'&&response.ok){
  const path=url.pathname.split('/storage/v1/object/')[1];
  if(path?.startsWith('cms-demo/hero/'))await parent.qaArtifact(path);
 }
 return response;
};</script>'''


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass

    def send_json(self, value):
        data = json.dumps(value).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/e2e-qa':
            html = '''<!doctype html><meta charset="utf-8"><title>VCA Step 13 QA</title>
<style>body{margin:0;font:16px system-ui}#dashboard{padding:12px;background:#eef2f8;position:sticky;top:0;z-index:2}iframe{display:block;border:0}pre{white-space:pre-wrap}body.capture #dashboard,body.capture pre{display:none}</style>
<div id="dashboard"><b>VCA Step 13 QA</b><p id="status">Preparing baseline...</p></div><div id="browser"></div><pre id="results"></pre>
<script>window.publicOnly=PUBLIC_ONLY;</script><script type="module" src="/tests/step13-e2e.js"></script>'''.replace('PUBLIC_ONLY', str(args.public_only).lower())
        else:
            route = self.path.split('?', 1)[0]
            if route.startswith('/repo/'):
                self.path = self.path[len('/repo'):]
            target = Path(self.translate_path(self.path.split('?', 1)[0])).resolve()
            if not target.is_relative_to(ROOT) or target.is_dir() or any(p.startswith('.') for p in target.relative_to(ROOT).parts):
                self.send_error(404)
                return
            if target.suffix != '.html':
                super().do_GET()
                return
            html = target.read_text(encoding='utf-8').replace('<head>', '<head>' + INSTRUMENT)
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(html.encode())

    def do_POST(self):
        size = int(self.headers.get('Content-Length', '0'))
        if size > 200000:
            self.send_error(413)
            return
        data = json.loads(self.rfile.read(size))
        if self.path == '/qa-capture':
            # Capture only named application views, never entered login credentials.
            kind = data.get('kind')
            width = data.get('width')
            if kind not in ['public', 'login', 'editor'] or width not in [1440, 1200, 1024, 800, 650, 390]:
                self.send_error(400)
                return
            try:
                shot = cdp('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': True,
                           'clip': {'x': 0, 'y': 0, 'width': width, 'height': min(int(data['height']), 8000), 'scale': 1}})
                folder = Path(tempfile.gettempdir()) / 'vca-step13-screenshots'
                folder.mkdir(exist_ok=True)
                path = folder / f'{kind}-{width}.png'
                path.write_bytes(base64.b64decode(shot['data']))
                self.send_json({'captured': True, 'file': str(path)})
            except Exception:
                self.send_json({'captured': False})
            return
        if self.path != '/qa-state':
            self.send_error(405)
            return
        global latest
        with write_lock:
            latest = data
            write_report(latest)
        self.send_json({'saved': True})
        if data.get('phase') == 'finished':
            finished.set()


if __name__ == '__main__':
    if args.verify_cleanup:
        verify_cleanup()
        raise SystemExit(0 if json.loads(RESULT.read_text(encoding='utf-8'))['summary']['overall'] == 'PASS' else 1)
    if RESULT.exists():
        prior = json.loads(RESULT.read_text(encoding='utf-8'))
        if prior.get('writesStarted') and not prior.get('restored') or any(a['state'] != 'REMOVED' for a in prior.get('artifacts', [])):
            raise SystemExit('Prior run needs restoration/Storage cleanup. Preserve its snapshot and resolve it before a new run.')
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with tempfile.TemporaryDirectory(prefix='vca-e2e-') as profile:
        profile_path = Path(profile)
        chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '--disable-gpu', '--no-first-run',
                  '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0',
                  '--window-size=1600,1000', '--user-data-dir=' + profile]
        if args.public_only:
            chrome.append('--headless')
        url = f'http://127.0.0.1:{server.server_port}/e2e-qa'
        print('Step 13 QA browser: ' + url, flush=True)
        process = subprocess.Popen(chrome + [url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            # Tool callers can poll; no request or response bodies are logged.
            deadline = time.monotonic() + (240 if args.public_only else 1800)
            while not finished.wait(1) and time.monotonic() < deadline:
                pass
            if not finished.is_set():
                print('INCOMPLETE: timed out. Preserve the saved snapshot; inspect restoration status before rerunning.', flush=True)
            print(json.dumps({'summary': latest.get('summary'), 'phase': latest.get('phase'),
                              'restored': latest.get('restored'), 'artifacts': latest.get('artifacts', [])}, indent=2), flush=True)
        finally:
            # Never terminate a live browser while it may need to restore content.
            if latest.get('writesStarted') and not latest.get('restored'):
                print('Recovery required: browser remains open. Use its signed-in session and the public snapshot in the JSON result.', flush=True)
                finished.clear()
                while not latest.get('restored'):
                    time.sleep(1)
            process.terminate()
            process.wait(timeout=10)
            server.shutdown()
    raise SystemExit(0 if finished.is_set() and latest.get('summary', {}).get('failed') == 0
                     and latest.get('summary', {}).get('pending') == 0 else 1)
