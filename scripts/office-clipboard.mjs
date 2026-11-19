import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import {officeExport} from './office-export.mjs';
const script=fileURLToPath(new URL('./copy-emf.ps1',import.meta.url));
function copyEMF(file){
  return new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-STA','-WindowStyle','Hidden','-File',script,'-Path',file],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    child.stdout.resume();
    let error='';const timer=setTimeout(()=>{child.kill();reject(Error('Clipboard operation timed out.'));},15000);
    child.stderr.on('data',b=>error=(error+b).slice(-1500));
    child.once('error',e=>{clearTimeout(timer);reject(e);});
    child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error(error||'Cannot copy the enhanced metafile.'));});
  });
}
export async function officeClipboard(svg,{exporter=officeExport,copier=copyEMF,platform=process.platform}={}){
  if(platform!=='win32')throw Error('The native Office clipboard requires Windows.');
  const bytes=await exporter(svg,'emf',{outlineText:true});
  const dir=await mkdtemp(path.join(os.tmpdir(),'immunostudio-clipboard-'));
  try{
    const file=path.join(dir,'selection.emf');await writeFile(file,bytes);await copier(file);
    return {format:'emf',outlinedText:true};
  }finally{
    const resolved=path.resolve(dir),prefix=path.resolve(os.tmpdir())+path.sep+'immunostudio-clipboard-';
    if(resolved.startsWith(prefix))await rm(resolved,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
}
