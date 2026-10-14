'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function harness({debuggerDenied=false}={}) {
 const data=new Map(),listeners=[],downloads=[],commands=[],storage={};
 const DB={get:async id=>structuredClone(data.get(id)),put:async j=>data.set(j.id,structuredClone(j)),list:async()=>structuredClone([...data.values()]),records:async()=>[],addRecord:async()=>{},clear:async()=>data.clear()};
 const event=()=>({addListener:()=>{}});
 const chrome={
  runtime:{id:'test',getURL:s=>'chrome-extension://test/'+s,onMessage:{addListener:f=>listeners.push(f)},onStartup:event()},
  storage:{local:{set:async o=>Object.assign(storage,o),remove:async key=>delete storage[key]}},
  tabs:{get:async id=>({id,url:'https://example.test/projects'}),sendMessage:async()=>({ok:false}),onRemoved:event(),onUpdated:event()},
  scripting:{executeScript:async input=>{commands.push(input);return input.files?[]:[{result:input.func.toString().includes('inspect')?{supported:true,tree:true,url:'https://example.test/projects'}:true}];}},
  downloads:{download:async options=>{downloads.push(options);return downloads.length;}},
  debugger:{onEvent:event(),onDetach:event(),attach:async()=>{if(debuggerDenied)throw new Error('restricted by policy');},detach:async()=>{},sendCommand:async()=>({})}
 };
 const ctx=vm.createContext({chrome,PAeroStore:DB,crypto:webcrypto,URL,TextEncoder,TextDecoder,Uint8Array,atob,setTimeout,clearTimeout,console,structuredClone});
 ctx.importScripts=(...scripts)=>{for(const file of scripts)if(file!=='engine/store.js')vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),ctx);
 const ui={id:'test',url:'chrome-extension://test/popup.html'};
 const send=(msg,sender=ui)=>new Promise(resolve=>listeners[0](msg,sender,resolve));
 return {data,downloads,commands,send,content:{id:'test',url:'https://example.test/projects',tab:{id:1},frameId:0}};
}
const start=h=>h.send({type:'START',tabId:1,options:{mode:'full',record:false,hours:true}});
test('background creates a job before injecting collection entry',async()=>{const h=harness(),r=await start(h);assert(r.ok);assert.equal(h.data.get(r.data.id).status,'running');assert.equal(h.commands.length,3);});
test('background rejects duplicate starts',async()=>{const h=harness();await start(h);const second=await start(h);assert(!second.ok);assert.match(second.error,/остановите/);});
test('background persists completion and requests automatic CSV',async()=>{const h=harness(),r=await start(h),id=r.data.id;const saved=await h.send({type:'COLLECTOR_EVENT',id,final:true,state:{status:'completed',phase:'done',warnings:[]},rows:[{uid:'a',name:'А',level:0}]},h.content);assert(saved.ok);assert.equal(h.data.get(id).status,'completed');assert.equal(h.data.get(id).rows.length,1);assert.equal(h.downloads.length,1);assert.match(h.downloads[0].filename,/\.csv$/);});
test('late checkpoint cannot overwrite final result',async()=>{const h=harness(),r=await start(h),id=r.data.id;await h.send({type:'COLLECTOR_EVENT',id,final:true,state:{status:'completed',warnings:[]},rows:[{uid:'a'}]},h.content);await h.send({type:'COLLECTOR_EVENT',id,state:{status:'running',warnings:[]},rows:[]},h.content);assert.equal(h.data.get(id).status,'completed');assert.equal(h.data.get(id).rows.length,1);});
test('background refuses privileged commands from page scripts',async()=>{const h=harness();const r=await h.send({type:'START',tabId:1,options:{}},h.content);assert(!r.ok);assert.equal(h.data.size,0);});
test('background rejects events from wrong tab/origin',async()=>{const h=harness(),r=await start(h);const e=await h.send({type:'COLLECTOR_EVENT',id:r.data.id,rows:[]},{...h.content,tab:{id:2}});assert(!e.ok);assert.equal(h.data.get(r.data.id).status,'running');});
test('debugger policy refusal does not block DOM collector',async()=>{const h=harness({debuggerDenied:true});const r=await h.send({type:'START',tabId:1,options:{mode:'full',record:true}});assert(r.ok);assert.equal(r.data.status,'running');assert(r.data.warnings.some(w=>w.includes('policy')));});
test('record-only mode reports debugger policy error',async()=>{const h=harness({debuggerDenied:true});const r=await h.send({type:'START',tabId:1,options:{mode:'record'}});assert(!r.ok);assert.equal([...h.data.values()][0].status,'error');});
test('manual stop closes missing collector cleanly',async()=>{const h=harness();await start(h);const r=await h.send({type:'STOP',tabId:1});assert(r.ok);assert.equal(r.data.status,'stopped');});
