"""Run with Python and installed Chrome; serves local fixtures, never Supabase."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
TEST = r'''
import {createEditorState, statesEqual} from '/admin/js/editor-state.js';
import {defaultContent} from '/admin/js/editor-defaults.js';
const results = [];
function check(name, ok) { if (!ok) throw Error(name); results.push(name); }
const button = id => document.getElementById(id + '-button');
const field = id => document.getElementById(id);
const click = id => button(id).click();
function edit(id, value) {
  field(id).value = value;
  field(id).dispatchEvent(new Event('input', {bubbles:true}));
  field(id).dispatchEvent(new Event('change', {bubbles:true}));
}
function select(file) {
  const transfer = new DataTransfer(); transfer.items.add(file);
  field('hero-image-input').files = transfer.files;
  field('hero-image-input').dispatchEvent(new Event('change', {bubbles:true}));
}
try {
  await import('/admin/js/homepage-editor.js');
  await new Promise(resolve => setTimeout(resolve, 50));
  check('Initial history state', button('undo').disabled && button('redo').disabled && button('cancel').disabled);
  edit('hero-title', 'B'); click('undo');
  check('Single edit + Undo; duplicate input/change skipped', field('hero-title').value === 'Saved title' && button('undo').disabled && !button('redo').disabled);
  click('redo'); check('Redo', field('hero-title').value === 'B' && button('redo').disabled);
  edit('hero-button-text', 'CTA');
  const rowTitle = document.querySelector('[data-field="announcement_title"]');
  edit(rowTitle.id, 'Event B');
  click('undo'); check('Consecutive edits: announcement', document.querySelector('[data-field="announcement_title"]').value === defaultContent.announcements[0].announcement_title);
  click('undo'); check('Consecutive edits: CTA', field('hero-button-text').value === defaultContent.hero_button_text);
  click('undo'); check('Consecutive edits: title', field('hero-title').value === 'Saved title');
  click('redo'); click('redo'); click('redo');
  check('Consecutive redos', document.querySelector('[data-field="announcement_title"]').value === 'Event B');
  click('undo'); edit('footer-text', 'New branch'); check('New edit clears Redo', button('redo').disabled);
  let confirmations = 0;
  window.confirm = () => { confirmations++; return false; };
  click('cancel'); check('Cancel declined', field('hero-title').value === 'B');
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), c => c.charCodeAt(0));
  const b = new File([png], 'B.png', {type:'image/png'});
  const c = new File([png], 'C.png', {type:'image/png'});
  const savedImage = field('hero-image-preview').src;
  select(b); select(c); click('undo');
  check('Image Undo to B', field('hero-image-preview').alt.includes('B.png'));
  await fetch(field('hero-image-preview').src).then(r => check('Restored object URL is valid', r.ok));
  click('undo'); check('Image Undo to saved A', field('hero-image-preview').src === savedImage);
  click('redo'); check('Image Redo to B', field('hero-image-preview').alt.includes('B.png'));
  window.confirm = () => true; click('cancel');
  check('Cancel restores text, rows, image and clears history', field('hero-title').value === 'Saved title' && field('hero-image-preview').src === savedImage && document.querySelector('[data-field="announcement_title"]').value === defaultContent.announcements[0].announcement_title && button('undo').disabled && button('redo').disabled && button('cancel').disabled);
  window.confirm = () => false; click('restore-default');
  check('Restore Default declined', field('hero-title').value === 'Saved title');
  window.confirm = () => true; click('restore-default');
  check('Restore Default confirmed', field('hero-title').value === defaultContent.hero_title && button('restore-default').disabled && !button('undo').disabled && !button('cancel').disabled);
  click('undo'); check('Restore Default undoable', field('hero-title').value === 'Saved title');
  click('add-announcement'); check('Add announcement', document.querySelectorAll('.announcement-entry').length === 2);
  click('undo'); check('Undo add', document.querySelectorAll('.announcement-entry').length === 1);
  click('redo'); check('Redo add', document.querySelectorAll('.announcement-entry').length === 2);
  const added = document.querySelectorAll('[data-field="announcement_title"]')[1]; edit(added.id, 'Keep this event');
  document.querySelectorAll('[data-delete-announcement]')[1].click(); click('undo');
  check('Undo delete preserves values', document.querySelectorAll('[data-field="announcement_title"]')[1].value === 'Keep this event');
  const s = createEditorState(defaultContent);
  s.setField('hero_title', 'Persisted'); s.acceptSavedState();
  check('State-level successful Save boundary', !s.isDirty() && !s.canUndo && !s.canRedo && s.savedState.hero_title === 'Persisted');
  s.setField('hero_title', 'Unsaved'); s.setField('footer_text', 'unsaved footer'); s.undo();
  const before = s.currentState;
  // A rejected persistence attempt must not call acceptSavedState.
  await Promise.reject(Error('simulated failure')).catch(() => {});
  check('State-level failed Save preserves both stacks', statesEqual(s.currentState, before) && s.canUndo && s.canRedo && s.savedState.hero_title === 'Persisted');
  try { s.undo(() => { throw Error('simulated render failure'); }); } catch {}
  check('Render failure preserves state/history', statesEqual(s.currentState, before) && s.canUndo && s.canRedo);
  const snapshot = s.currentState; snapshot.announcements[0].announcement_title = 'mutated';
  check('Nested snapshot isolation', s.currentState.announcements[0].announcement_title !== 'mutated');
  s.setImage('hero_image_url', b); s.restoreDefaults(); s.undo();
  check('Restore Default Undo retains File', s.currentState.media.hero_image_url.file === b);
  s.cancel(); check('Saved baseline isolated', s.currentState.hero_title === 'Persisted' && !s.canUndo && !s.canRedo);
  click('restore-default');
  const iframe = document.createElement('iframe'); iframe.src = '/reload-fixture'; document.body.append(iframe);
  await new Promise(resolve => iframe.onload = resolve);
  await new Promise(resolve => setTimeout(resolve, 100));
  check('Reload restores saved fixture, defaults remain unsaved', iframe.contentDocument.getElementById('hero-title').value === 'Saved title');
  check('No uncaught errors or import failures', !window.testErrors.length);
  document.body.innerHTML = '<pre id="test-results">PASS\n' + results.join('\n') + '</pre>';
} catch (error) { document.body.innerHTML = '<pre id="test-results">FAIL\n' + error.stack + '\nPassed: ' + results.join(', ') + '</pre>'; }
'''
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
        elif self.path == '/admin/js/editor-data.js':
            self.send_text('import {defaultContent} from "./editor-defaults.js"; export async function loadEditorContent(){return {...defaultContent, hero_title:"Saved title"};}', 'text/javascript')
        else: super().do_GET()
    def send_text(self, text, kind):
        self.send_response(200); self.send_header('Content-Type', kind); self.end_headers(); self.wfile.write(text.encode())
    def do_POST(self):
        requests.append(('POST', self.path)); self.send_error(405)
    do_PATCH = do_POST
    do_PUT = do_POST
    do_DELETE = do_POST

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
chrome = Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
with tempfile.TemporaryDirectory(prefix='vca-history-') as profile:
    run = subprocess.run([str(chrome), '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--user-data-dir='+profile, '--dump-dom', '--virtual-time-budget=5000', f'http://127.0.0.1:{server.server_port}/fixture'], capture_output=True, text=True, encoding='utf-8', timeout=45)
    start = run.stdout.find('<pre id="test-results">')
    result = run.stdout[start:run.stdout.find('</pre>', start)]
    print(result)
    print('Non-GET requests:', [r for r in requests if r[0] != 'GET'])
    server.shutdown()
    if 'test-results">PASS' not in result or any(r[0] != 'GET' for r in requests):
        print(run.stderr[-2000:]); raise SystemExit(1)
