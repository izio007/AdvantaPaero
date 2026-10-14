"""Offline DOM/timer tests in Chromium. No navigation or network access is required.
location, fetch and chrome.runtime are test doubles; no Chrome-extension API claims.
"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from extension_integration import HTML,ROOT
MOCK=r'''window.__events=[];window.__listeners=[];window.__bad=false;window.__posts=0;
window.__testLocation={href:'https://fixture.invalid/projects',origin:'https://fixture.invalid'};
window.chrome={runtime:{id:'test',onMessage:{addListener:f=>__listeners.push(f)},sendMessage:async m=>{__events.push(structuredClone(m));return {ok:true}}}};
window.fetch=async(raw,opt={})=>{const u=new URL(raw,__testLocation.href),uid=u.searchParams.get('uid');
if(opt.signal?.aborted)throw new DOMException('aborted','AbortError');
if(u.pathname==='/tree')return new Response(JSON.stringify({children:[],token:'TREE_SECRET'}),{headers:{'content-type':'application/json'}});
if(opt.method==='POST'){
 __posts++;const form=new URLSearchParams(opt.body);
 if(form.get('__VIEWSTATE_KEY')!=='STATE_SECRET_'+uid||form.get('__CONTROLLER_KEY')!=='CTRL_SECRET_'+uid)return new Response('wrong state',{status:400});
 if(__bad)return new Response('<html>login</html>');
 const w=[{Id:'cc8a35f0-e2d9-4e91-99c8-6bc061b6c377',Number1:3,Number2:10},{Id:'d67821dd-8739-494e-b638-c0d6a58e5388',Number1:4}];
 return new Response('/*DX*/'+JSON.stringify({result:{data:JSON.stringify(w)}}));
}
return new Response('<html><input id="__VIEWSTATE_KEY" value="STATE_SECRET_'+uid+'"><input id="__CONTROLLER_KEY" value="CTRL_SECRET_'+uid+'"></html>');};'''
def run():
 (ROOT/'test-results').mkdir(parents=True,exist_ok=True)
 results=[]
 def check(name,value):
  if not value:raise AssertionError(name)
  results.append(name);print('PASS:',name,flush=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
  context=browser.new_context();page=None
  def prepare():
   nonlocal page
   if page:page.close()
   page=context.new_page();page.set_content(HTML)
   page.add_script_tag(content=MOCK)
   page.add_script_tag(path=str(ROOT/'engine/core.js'))
   # Only the test wrapper supplies location. Production uses the real page location.
   page.add_script_tag(content='((location)=>{'+(ROOT/'engine/collector.js').read_text()+'})(__testLocation);')
  def start(name,mode='full',hours=True):page.evaluate('(input)=>PAeroCollector.start(input)',{'id':name,'options':{'mode':mode,'hours':hours}})
  def done(timeout=80000):
   page.wait_for_function('window.__events.some(e=>e.final)',timeout=timeout);return page.evaluate('__events.findLast(e=>e.final)')
  prepare();d=page.evaluate('PAeroCollector.inspect()');check('DOM adapter recognizes ADVANTA-shaped fixture',d['supported'] and d['tree'])
  start('full');j=done();print('FINAL',j['state'],flush=True);check('collector completes on real DOM with mocked transport',j['state']['status']=='completed')
  check('virtualized tree: 36 distinct UID collected',len(j['rows'])==36 and len({r['uid'] for r in j['rows']})==36)
  check('CSV hierarchy order stays parent-children-sibling', [r['uid'] for r in j['rows']]==[uid for i in range(1,13) for uid in [f'p{i}',f'p{i}a',f'p{i}b']])
  check('equal names preserve different projects',len({r['name'] for r in j['rows']})==1)
  check('manager, executor, dates and progress preserved',all(r.get('manager')=='Иванов' and r.get('executor')=='Петров' and r.get('progress')=='35%' and r.get('planStart')=='01.10.2026' for r in j['rows']))
  check('per-card state used, all 36 mock hours correct',all(r['planHours']==10 and r['factHours']==3 and r['allocatedHours']==4 for r in j['rows']))
  check('widget IDs used instead of array order',all(r['hoursStatus']=='widget-id' for r in j['rows']))
  check('periodic checkpoints exist',sum(bool(e.get('rows')) for e in page.evaluate('__events'))>=3)
  csv=page.evaluate('PAeroCore.toCsv([...PAeroCollector.last.rows.values()], "completed")');check('CSV format contains all rows and BOM',csv.startswith('\ufeff') and len(csv.split('\r\n'))==37)
  prepare();page.evaluate('__bad=true');start('bad',mode='screen');j=done(20000)
  check('invalid callback stops after three consecutive failures',j['state']['status']=='partial' and j['state']['hoursErrors']==3 and page.evaluate('__posts')==3)
  check('failed hours remain null, never fabricated zeros',all(r['planHours'] is None for r in j['rows']))
  prepare();start('stop');page.wait_for_timeout(800);page.evaluate('PAeroCollector.stop("stop")');j=done(10000)
  check('Stop saves partial rows and does not report success',j['state']['status']=='stopped' and len(j['rows'])>0)
  prepare();start('double');rejected=page.evaluate('''()=>{try{PAeroCollector.start({id:'duplicate',options:{}});return false}catch(e){return e.message.includes('уже')}}''');page.evaluate('PAeroCollector.stop("double")');done(10000);check('duplicate start rejected',rejected)
  ui=context.new_page();ui.set_content((ROOT/'popup.html').read_text());ui.add_style_tag(path=str(ROOT/'popup.css'))
  ui.evaluate("""()=>{window.chrome={tabs:{query:async()=>[{id:1}],get:async()=>({url:'http://fixture.invalid/projects'})},runtime:{sendMessage:async()=>({ok:true,data:{job:{id:'test',status:'completed',phase:'done',collected:36,processed:36,network:{count:84},warnings:[]},history:[]}})}}}""")
  ui.add_script_tag(path=str(ROOT/'popup.js'));ui.wait_for_function("document.querySelector('#rows').textContent==='36'");ui.screenshot(path=os.environ.get('PAERO_SCREENSHOT',str(ROOT/'test-results'/'ui-tested.png')),full_page=True)
  check('popup renders and displays a saved job via mocked API',ui.locator('#status').inner_text()=='Сбор завершён');browser.close()
 report={'passed':len(results),'checks':results,'browser':'Chromium 144.0.7559.96','scope':'Real DOM and timers. location, fetch and chrome.runtime mocked. Chrome-extension API integration not executed: container policy blocks extension loading and local navigation.','real_ADVANTA':'not tested'}
 Path(os.environ.get('PAERO_TEST_REPORT',str(ROOT/'test-results'/'browser-results.json'))).write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False),flush=True)
if __name__=='__main__':run()
