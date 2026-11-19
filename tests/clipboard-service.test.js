import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
test('local clipboard service permits the published app and requires its session token',async()=>{
  const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const child=spawn(process.execPath,['scripts/server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),IMMUNOSTUDIO_FFMPEG:path.join(root,'missing-test-encoder.exe')},windowsHide:true,stdio:['ignore','pipe','pipe']});
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Clipboard test server did not start.')),15000);
      child.once('error',e=>{clearTimeout(timer);reject(e);});
      child.once('exit',code=>{clearTimeout(timer);reject(Error('Clipboard test server exited: '+code));});
      child.stdout.on('data',data=>{if(data.toString().includes('ImmunoStudio:')){clearTimeout(timer);resolve();}});
    });
    const base=`http://127.0.0.1:${port}`,origin='https://espierin.github.io';
    const status=await fetch(base+'/api/status',{headers:{Origin:origin}});
    assert.equal(status.status,200);assert.equal(status.headers.get('access-control-allow-origin'),origin);
    const data=await status.json();assert.equal(typeof data.token,'string');assert.equal(typeof data.officeClipboard,'boolean');
    const badOrigin=await fetch(base+'/api/status',{headers:{Origin:'https://example.invalid'}});assert.equal(badOrigin.status,403);
    const options=await fetch(base+'/api/office/clipboard',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-immunostudio'}});
    assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),origin);
    const unauthorized=await fetch(base+'/api/office/clipboard',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({svg:'<svg/>'})});
    assert.equal(unauthorized.status,403);
    const exportOptions=await fetch(base+'/api/office/export',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST'}});
    assert.equal(exportOptions.status,204);assert.equal(exportOptions.headers.get('access-control-allow-origin'),origin);
    const exportUnauthorized=await fetch(base+'/api/office/export',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
    assert.equal(exportUnauthorized.status,403);
  }finally{child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('close',resolve);});}
});
