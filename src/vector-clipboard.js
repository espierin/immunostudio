export async function findOfficeService({fetcher=globalThis.fetch,href=globalThis.location?.href||'https://espierin.github.io/immunostudio/',clipboardRequired=false}={}){
  const url=new URL(href),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  const bases=[...new Set([...(local?[url.origin]:[]),'http://127.0.0.1:5180'])];
  for(const base of bases)try{
    const response=await fetcher(base+'/api/status',{signal:AbortSignal.timeout(2500)});
    if(response.ok){const status=await response.json();if((clipboardRequired?status.officeClipboard:status.office)&&typeof status.token==='string')return {...status,base};}
  }catch{}
  return null;
}

export async function exportOfficeImage(svg,format,{fetcher=globalThis.fetch,href,outlineText=true}={}){
  if(!['emf','wmf'].includes(format))throw Error('Kies EMF of WMF.');
  const service=await findOfficeService({fetcher,href});
  if(!service)throw Error('Start de lokale ImmunoStudio-helper met Inkscape voor EMF/WMF. SVG downloaden werkt ook zonder helper.');
  const result=await fetcher(service.base+'/api/office/export',{method:'POST',headers:{'Content-Type':'application/json','X-ImmunoStudio':service.token},body:JSON.stringify({svg,format,outlineText}),signal:AbortSignal.timeout(190000)});
  if(!result.ok){const error=await result.json().catch(()=>({}));throw Error(error.error||'Office-export mislukt');}
  return result.blob();
}

export async function copyVectorImage(svg,{
  fetcher=globalThis.fetch,
  clipboard=globalThis.navigator?.clipboard,
  Item=globalThis.ClipboardItem,
  href=globalThis.location?.href||'https://espierin.github.io/immunostudio/',
  allowSVG=true,
}={}){
  if(typeof svg!=='string'||!svg.includes('<svg'))throw Error('Selecteer eerst een 2D-figuur.');
  const service=await findOfficeService({fetcher,href,clipboardRequired:true});
  if(service){
    const response=await fetcher(service.base+'/api/office/clipboard',{
      method:'POST',headers:{'Content-Type':'application/json','X-ImmunoStudio':service.token},body:JSON.stringify({svg}),signal:AbortSignal.timeout(110000),
    });
    if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'Kopiëren naar het Office-klembord is mislukt.');}
    return response.json();
  }
  // SVG is written only when the browser explicitly advertises vector support.
  // Do not silently turn an Office vector request into a bitmap or SVG text.
  if(allowSVG&&clipboard?.write&&Item?.supports?.('image/svg+xml')){
    await clipboard.write([new Item({'image/svg+xml':new Blob([svg],{type:'image/svg+xml'})})]);
    return {format:'svg',outlinedText:false};
  }
  throw Error('Voor het Office-vector-klembord is de lokale ImmunoStudio-helper met Inkscape nodig.');
}
