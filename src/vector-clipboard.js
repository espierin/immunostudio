export async function copyVectorImage(svg,{
  fetcher=globalThis.fetch,
  clipboard=globalThis.navigator?.clipboard,
  Item=globalThis.ClipboardItem,
  href=globalThis.location?.href||'https://espierin.github.io/immunostudio/',
}={}){
  if(typeof svg!=='string'||!svg.includes('<svg'))throw Error('Selecteer eerst een 2D-figuur.');
  const url=new URL(href),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  const base=local?url.origin:'http://127.0.0.1:5180';
  let service;
  try{
    const response=await fetcher(base+'/api/status',{signal:AbortSignal.timeout(2500)});
    if(response.ok){const status=await response.json();if(status.officeClipboard&&typeof status.token==='string')service=status;}
  }catch{}
  if(service){
    const response=await fetcher(base+'/api/office/clipboard',{
      method:'POST',headers:{'Content-Type':'application/json','X-ImmunoStudio':service.token},body:JSON.stringify({svg}),signal:AbortSignal.timeout(110000),
    });
    if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'Kopiëren naar het Office-klembord is mislukt.');}
    return response.json();
  }
  // SVG is written only when the browser explicitly advertises vector support.
  // Do not silently turn an Office vector request into a bitmap or SVG text.
  if(clipboard?.write&&Item?.supports?.('image/svg+xml')){
    await clipboard.write([new Item({'image/svg+xml':new Blob([svg],{type:'image/svg+xml'})})]);
    return {format:'svg',outlinedText:false};
  }
  throw Error('Voor het Office-vector-klembord is de lokale ImmunoStudio-helper met Inkscape nodig.');
}
