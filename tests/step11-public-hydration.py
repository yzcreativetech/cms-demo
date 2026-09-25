"""Local Chrome fixtures; --live checks real logged-out reads without writes."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import subprocess, tempfile, threading, sys
from urllib.parse import unquote
ROOT=Path(__file__).resolve().parents[1]
LIVE='--live' in sys.argv
CLIENT=r'''
export async function getSupabaseClient(){
 const f=window.top.fixture;
 if(f.clientFail) throw Error('fixture client failure');
 return {from(table){
  const q={table,filters:[],orders:[],select(){return this;},eq(k,v){this.filters.push([k,v]);return this;},single(){this.one=true;return this;},order(k,o){this.orders.push([k,o]);return this;},async then(resolve,reject){
   try{
    window.top.reads.push({table:this.table,filters:this.filters,orders:this.orders,one:this.one});
    await new Promise(r=>setTimeout(r,80));
    if(f.networkFail)throw Error('network failure');
    if(f.fail===table)return resolve({error:{message:'private fixture error'}});
    let data=table==='homepage_content'?f.home:f.rows;
    if(Array.isArray(data)) data=[...data].filter(r=>this.filters.every(([k,v])=>r[k]===v)).sort((a,b)=>a.sort_order-b.sort_order||a.id-b.id);
    resolve({data,error:null});
   }catch(e){reject(e);}
  }};return q;
 }};
}
'''
requests=[]
finished=threading.Event()
live_result=[]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
 def send_text(self,text,kind):
  try:
   self.send_response(200);self.send_header('Content-Type',kind);self.end_headers();self.wfile.write(text.encode('utf-8'))
  except (ConnectionAbortedError,ConnectionResetError,BrokenPipeError):pass
 def do_GET(self):
  if self.path.startswith('/test-result?'):
   live_result.append(unquote(self.path.split('?',1)[1]));finished.set();self.send_text('OK','text/plain');return
  requests.append(('GET',self.path))
  if self.path=='/test':
   self.send_text('<html><body><script>window.live='+str(LIVE).lower()+';</script><script type="module" src="/tests/step11-public-hydration.js"></script></body></html>','text/html');return
  if self.path.startswith('/repo/'):
   path=self.path.split('?',1)[0][len('/repo/'):]
   if path=='index.html':
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    instrumentation='''<script>window.errors=[];window.calls=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));const originalFetch=window.fetch;window.fetch=(input,init)=>{const url=String(input.url||input);const method=init?.method||input.method||'GET';calls.push({url,method});if(method!=='GET'&&method!=='HEAD')return Promise.reject(Error('Non-read request blocked by test'));return originalFetch(input,init);};</script>'''
    html=html.replace('<head>','<head>'+instrumentation)
    html=html.replace('<script type="module" src="js/homepage-hydration.js"></script>','<script type="module">window.run=import("./js/homepage-hydration.js").then(m=>m.hydrationComplete);</script>')
    self.send_text(html,'text/html');return
   if path=='admin/js/supabase-client.js' and not LIVE:self.send_text(CLIENT,'text/javascript');return
   self.path='/'+path
  super().do_GET()
 def do_POST(self):requests.append(('WRITE',self.path));self.send_error(405)
 do_PUT=do_POST
 do_PATCH=do_POST
 do_DELETE=do_POST
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
with tempfile.TemporaryDirectory(prefix='vca-public-') as profile:
 args=['C:/Program Files/Google/Chrome/Application/chrome.exe','--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--user-data-dir='+profile]
 if LIVE:
  # Real network/image decoding needs wall-clock time, not virtual-time dumping.
  process=subprocess.Popen(args+[f'http://127.0.0.1:{server.server_port}/test'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  try:
   finished.wait(40)
   result='<pre id="test-results">'+(live_result[0] if live_result else 'BLOCKED: Live browser checks did not finish within 40 seconds.')
  finally:
   process.terminate();process.wait(timeout=10)
 else:
  run=subprocess.run(args+['--dump-dom','--virtual-time-budget=30000',f'http://127.0.0.1:{server.server_port}/test'],capture_output=True,text=True,encoding='utf-8',timeout=45)
  start=run.stdout.find('<pre id="test-results">')
  result=run.stdout[start:run.stdout.find('</pre>',start)]
 print(result);print('Non-GET local requests:',[r for r in requests if r[0]!='GET'])
 server.shutdown()
 if 'test-results">PASS' not in result or any(r[0]!='GET' for r in requests):
  print('Chrome did not finish the checks successfully.');raise SystemExit(1)
