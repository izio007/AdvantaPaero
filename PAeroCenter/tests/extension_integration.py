"""Real Chromium test, synthetic loopback fixture. Requires Python/Playwright for development only.
A TEST COPY gets a loopback host permission: programmatically opening a popup is not an activeTab gesture.
The distributed production manifest remains activeTab-only. No real ADVANTA data is accessed.
"""
import json, os, shutil, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
STATE={'bad_hours':False,'posts':0}
HTML=r'''<!doctype html><html><head><meta charset="utf-8"><title>Демо: структура ADVANTA</title>
<style>body{font:14px Arial;margin:20px;background:#eef1f5}project-tree{display:block;width:720px}
._projectsListWrapper_fixture{height:250px;overflow:auto;position:relative;border:1px solid #ccc;background:white}
#spacer{position:relative}._treeItem_fixture{height:44px;position:absolute;left:0;right:0}
._treeItemContent_fixture{display:flex;gap:8px;padding:10px;border-bottom:1px solid #eee}
img{width:12px;height:12px;cursor:pointer}._projectLink_fixture{width:140px}</style></head>
<body><h2>Искусственный стенд — не реальная ADVANTA</h2>
<input type="hidden" id="__VIEWSTATE_KEY" value="PARENT_SECRET"><input type="hidden" id="__CONTROLLER_KEY" value="PARENT_CONTROLLER">
<project-tree><div class="_projectsListWrapper_fixture"><div id="spacer"></div></div></project-tree>
<script>
const parents=Array.from({length:12},(_,i)=>({uid:'p'+(i+1),level:0,children:true}));
const expanded=new Set();const scroll=document.querySelector('._projectsListWrapper_fixture');const spacer=document.getElementById('spacer');
function flat(){return parents.flatMap(p=>expanded.has(p.uid)?[p,{uid:p.uid+'a',level:1},{uid:p.uid+'b',level:1}]:[p]);}
function render(){const rows=flat(), start=Math.max(0,Math.floor(scroll.scrollTop/44)-1);spacer.style.height=(rows.length*44)+'px';spacer.replaceChildren();
 rows.slice(start,start+9).forEach((r,k)=>{const row=document.createElement('div');row.className='_treeItem_fixture';row.style.top=((start+k)*44)+'px';row.style.marginLeft=(r.level*26)+'px';
 const box=document.createElement('div');box.className='_treeItemContent_fixture';
 if(r.children){const img=document.createElement('img');img.src=expanded.has(r.uid)?'/minusGray.png':'/plusGray.png';img.onclick=async()=>{if(expanded.has(r.uid))return;await fetch('/tree?uid='+r.uid);expanded.add(r.uid);render();};box.append(img);}
 const link=document.createElement('a');link.className='_projectLink_fixture';link.href='/project.aspx?uid='+r.uid;link.textContent='Одинаковое название';box.append(link);
 for(const [cl,txt] of [['_projectCode_fixture',r.uid],['ui-status__list-item-text','В работе'],['_userName_fixture','Иванов'],['_userName_fixture','Петров'],['_date_fixture','01.10.2026'],['_date_fixture','20.10.2026'],['_wrapper_fixture','35%']]){const el=document.createElement('span');el.className=cl;el.textContent=txt;box.append(el);}
 row.append(box);spacer.append(row);});}
scroll.addEventListener('scroll',()=>requestAnimationFrame(render));render();
</script></body></html>'''
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,text,mime='text/html',status=200):
  body=text.encode();self.send_response(status);self.send_header('Content-Type',mime+'; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.send_header('Set-Cookie','mock_session=COOKIE_SECRET; Path=/');self.end_headers()
  try:self.wfile.write(body)
  except BrokenPipeError:pass
 def do_GET(self):
  u=urlparse(self.path)
  if u.path=='/projects':self.send(HTML)
  elif u.path=='/tree':self.send(json.dumps({'children':[],'token':'TREE_SECRET'}),'application/json')
  elif u.path=='/project.aspx':
   uid=parse_qs(u.query).get('uid',[''])[0];self.send(f'<html><input id="__VIEWSTATE_KEY" value="STATE_SECRET_{uid}"><input id="__CONTROLLER_KEY" value="CTRL_SECRET_{uid}"></html>')
  elif u.path=='/foreign':self.send('{"private":"OUT_OF_SCOPE"}','application/json')
  else:self.send('',status=404)
 def do_POST(self):
  uid=parse_qs(urlparse(self.path).query).get('uid',[''])[0];form=parse_qs(self.rfile.read(int(self.headers.get('Content-Length','0'))).decode());STATE['posts']+=1
  if form.get('__VIEWSTATE_KEY')!=['STATE_SECRET_'+uid] or form.get('__CONTROLLER_KEY')!=['CTRL_SECRET_'+uid]:return self.send('wrong card state',status=400)
  if form.get('__CALLBACKID')!=['ctl34$cbKeyMeasureWidgets']:return self.send('wrong callback',status=400)
  if STATE['bad_hours']:return self.send('<html>login</html>')
  w=[{'Id':'cc8a35f0-e2d9-4e91-99c8-6bc061b6c377','Number1':3,'Number2':10},{'Id':'d67821dd-8739-494e-b638-c0d6a58e5388','Number1':4}]
  self.send('/*DX*/'+json.dumps({'result':{'data':json.dumps(w)}}),'text/plain')
def run():
 (ROOT/'test-results').mkdir(parents=True,exist_ok=True)
 checks=[]
 def check(name,condition):
  if not condition:raise AssertionError(name)
  checks.append(name);print('PASS:',name,flush=True)
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();port=server.server_port
 with tempfile.TemporaryDirectory(prefix='paerocenter-test-') as tmp:
  extension=Path(tmp)/'extension';shutil.copytree(ROOT,extension,ignore=shutil.ignore_patterns('__pycache__'));manifest=json.loads((extension/'manifest.json').read_text());manifest['host_permissions']=['http://127.0.0.1/*'];(extension/'manifest.json').write_text(json.dumps(manifest))
  with sync_playwright() as p:
   context=p.chromium.launch_persistent_context(str(Path(tmp)/'profile'),executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,accept_downloads=True,args=['--no-sandbox','--disable-dev-shm-usage',f'--disable-extensions-except={extension}',f'--load-extension={extension}'])
   worker=context.service_workers[0] if context.service_workers else context.wait_for_event('serviceworker',timeout=15000);extid=worker.url.split('/')[2]
   target=context.new_page();target.goto(f'http://127.0.0.1:{port}/projects');target.wait_for_selector('project-tree');tabid=worker.evaluate("async url => (await chrome.tabs.query({})).find(t=>t.url===url).id",target.url)
   def ui_page():
    ui=context.new_page();ui.goto(f'chrome-extension://{extid}/popup.html?tab={tabid}');ui.wait_for_function("document.querySelector('#target').textContent.includes('127.0.0.1')");return ui
   def last():return worker.evaluate("async tid=>(await PAeroStore.list()).filter(j=>j.tabId===tid).sort((a,b)=>b.startedAt-a.startedAt)[0]",tabid)
   def wait_done(seconds=80):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
     job=last()
     if job and job['status'] not in ('running','recording','stopping'):return job
     time.sleep(.3)
    raise AssertionError('Timeout: '+json.dumps({k:v for k,v in last().items() if k not in ('rows','diagnostic')}))
   ui=ui_page();errors=[];ui.on('pageerror',lambda e:errors.append(str(e)));ui.click('#probe');ui.wait_for_function("!document.querySelector('#diagnostic').hidden")
   check('classic scripts injected and page probe works','ADVANTA распознана: да' in ui.locator('#diagnostic').inner_text())
   ui.click('#start');ui.wait_for_function("document.querySelector('#status').textContent.includes('выполняется')",timeout=10000);ui.close();time.sleep(1)
   target.evaluate("port=>fetch('http://localhost:'+port+'/foreign',{mode:'no-cors'}).catch(()=>{})",port)
   job=wait_done();print('JOB:',{k:v for k,v in job.items() if k not in ('rows','diagnostic')},flush=True)
   check('job completes after popup was closed',job['status']=='completed')
   check('virtualized expanded tree: all 36 unique nodes',len(job['rows'])==36 and len({r['uid'] for r in job['rows']})==36)
   check('identical names do not merge different UID',len({r['name'] for r in job['rows']})==1)
   check('manager, executor, dates and progress preserved',all(r.get('manager')=='Иванов' and r.get('executor')=='Петров' and r.get('progress')=='35%' for r in job['rows']))
   check('per-card state: all hours correctly returned',all(r['planHours']==10 and r['factHours']==3 and r['allocatedHours']==4 for r in job['rows']))
   check('widget mapping explicitly identified',all(r['hoursStatus']=='widget-id' for r in job['rows']))
   deadline=time.monotonic()+10
   while time.monotonic()<deadline:
    job=last()
    if job.get('downloadId') is not None:break
    time.sleep(.2)
   check('automatic CSV initiated',job.get('downloadId') is not None)
   records=worker.evaluate('id=>PAeroStore.records(id)',job['id']);check('real chrome.debugger captures requests and response bodies',len(records)>=36 and any(r.get('body',{}).get('format')=='devexpress-data' for r in records));dumped=json.dumps(records)
   check('request, cookie and JSON secrets not persisted',all(s not in dumped for s in ['STATE_SECRET_','CTRL_SECRET_','COOKIE_SECRET','TREE_SECRET']))
   check('cross-origin traffic excluded','OUT_OF_SCOPE' not in dumped and all('localhost:' not in r['url'] for r in records))
   ui=ui_page();ui.click('#json');ui.wait_for_function("document.querySelector('#message').textContent.includes('JSON передан')");check('report JSON export works',True)
   ui.screenshot(path=os.environ.get('PAERO_SCREENSHOT',str(ROOT/'test-results'/'ui-tested.png')));check('UI has no page JavaScript errors',not errors)
   STATE['bad_hours']=True;STATE['posts']=0;ui.click('#screen');time.sleep(.7);job=wait_done(20)
   check('invalid callback: partial result and only three failing attempts',job['status']=='partial' and job['hoursErrors']==3 and STATE['posts']==3)
   check('unknown hours remain empty, not zero',all(r['planHours'] is None for r in job['rows']))
   STATE['bad_hours']=False;target.reload();time.sleep(.5);ui.click('#start');time.sleep(.8);ui.click('#stop');job=wait_done(15)
   check('stop cancels collection and saves partial checkpoint',job['status']=='stopped' and len(job['rows'])>0)
   ui.click('#recordOnly');time.sleep(.6);target.evaluate("()=>fetch('/tree?uid=p1')");time.sleep(.5);target.reload();time.sleep(.8);job=last()
   check('navigation interrupts independent recording',job['status']=='interrupted')
   context.close()
 server.shutdown()
 report={'checks':checks,'passed':len(checks),'fixture':'synthetic loopback ADVANTA, 12 parents + 24 children','notes':['Test copy adds loopback host permission. Production manifest has activeTab only.','Real intranet ADVANTA not tested.']}
 Path(os.environ.get('PAERO_TEST_REPORT',str(ROOT/'test-results'/'browser-results.json'))).write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False),flush=True)
if __name__=='__main__':run()
