'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../engine/core.js');
function harness({deny=false,body='{"value":42,"token":"SENSITIVE"}',bodyError=false}={}){
 const listeners=[],detaches=[],rows=[],commands=[],notices=[];
 const chrome={debugger:{
  onEvent:{addListener:f=>listeners.push(f)},onDetach:{addListener:f=>detaches.push(f)},
  attach:async()=>{if(deny)throw new Error('Host access is restricted by policy.');},detach:async()=>{},
  sendCommand:async(target,method,args)=>{commands.push({method,args});if(method==='Network.getResponseBody'){if(bodyError)throw new Error('No resource');return {body,base64Encoded:false};}return {};}
 }};
 const ctx=vm.createContext({PAeroCore:core,PAeroStore:{addRecord:async r=>rows.push(structuredClone(r))},chrome,Map,Set,URL,TextEncoder,TextDecoder,Uint8Array,atob,Date,console});
 vm.runInContext(fs.readFileSync(require.resolve('../engine/recorder.js'),'utf8'),ctx);
 const R=ctx.PAeroRecorder;
 return {R,rows,commands,notices,start:()=>R.start(1,'https://example.test','job',(id,info)=>notices.push(info)),
  event:(m,p)=>listeners[0]({tabId:1},'Network.'+m,p),detach:()=>detaches[0]({tabId:1},'canceled_by_user')};
}
function req(h,id='1',url='https://example.test/api'){
 h.event('requestWillBeSent',{requestId:id,type:'XHR',wallTime:10,request:{url,method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'AUTH_SECRET',Cookie:'COOKIE_SECRET'},postData:'__VIEWSTATE_KEY=STATE_SECRET&a=1'}});
}
function response(h,id='1',url='https://example.test/api'){
 h.event('responseReceived',{requestId:id,response:{url,status:200,mimeType:'application/json',headers:{'Content-Type':'application/json','Set-Cookie':'COOKIE_SECRET'}}});
 h.event('loadingFinished',{requestId:id,encodedDataLength:100});
}
test('recorder persists one request + parsed response pair',async()=>{const h=harness();await h.start();req(h);response(h);const stats=await h.R.stop(1);assert.equal(stats.count,1);assert.equal(h.rows[0].body.data.value,42);});
test('recorder excludes credentials before persistence',async()=>{const h=harness();await h.start();req(h);response(h);await h.R.stop(1);const s=JSON.stringify(h.rows);for(const v of ['AUTH_SECRET','COOKIE_SECRET','STATE_SECRET','SENSITIVE'])assert(!s.includes(v));});
test('recorder does not record other origins',async()=>{const h=harness();await h.start();req(h,'foreign','https://other.test/api');response(h,'foreign','https://other.test/api');await h.R.stop(1);assert.equal(h.rows.length,0);});
test('recorder does not record image/document traffic',async()=>{const h=harness();await h.start();h.event('requestWillBeSent',{requestId:'i',type:'Image',request:{url:'https://example.test/i',method:'GET',headers:{}}});response(h,'i');await h.R.stop(1);assert.equal(h.rows.length,0);});
test('recorder never modifies, replays, or blocks requests',async()=>{const h=harness();await h.start();req(h);response(h);await h.R.stop(1);assert(h.commands.every(c=>['Network.enable','Network.getResponseBody'].includes(c.method)));});
test('missing body is explicitly labelled',async()=>{const h=harness({bodyError:true});await h.start();req(h);response(h);const s=await h.R.stop(1);assert.equal(s.errors,1);assert.equal(h.rows[0].body.format,'unavailable');});
test('HTML body is omitted',async()=>{const h=harness({body:'<html>SECRET</html>'});await h.start();req(h);response(h);await h.R.stop(1);assert.equal(h.rows[0].body.format,'omitted');assert(!JSON.stringify(h.rows).includes('SECRET'));});
test('pending request saved as incomplete when stopped',async()=>{const h=harness();await h.start();req(h);await h.R.stop(1);assert(h.rows[0].note.includes('до завершения'));});
test('policy denial propagates, no workaround attempted',async()=>{const h=harness({deny:true});await assert.rejects(h.start(),/restricted by policy/);assert.equal(h.commands.length,0);});
test('redirect outside the origin is not followed by recorder',async()=>{const h=harness();await h.start();req(h);h.event('requestWillBeSent',{requestId:'1',type:'XHR',redirectResponse:{status:302},request:{url:'https://foreign.test/api',method:'GET',headers:{}}});response(h,'1','https://foreign.test/api');await h.R.stop(1);assert.equal(h.rows.length,1);assert(h.rows[0].note.includes('302'));assert(!h.rows[0].body);});
test('record count limit terminates capture explicitly',async()=>{const h=harness({body:'{}'});await h.start();for(let i=0;i<1002;i++){req(h,String(i));response(h,String(i));}const s=await h.R.stop(1);assert.equal(h.rows.length,1000);assert(s.reason.includes('1000'));assert.equal(s.active,false);});
