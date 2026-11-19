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

// Write during the click gesture. Awaiting a network probe first loses clipboard
// activation in some browsers and unnecessarily requires a local service.
export async function copyVectorImage(svg,{
  clipboard=globalThis.navigator?.clipboard,
  Item=globalThis.ClipboardItem,
}={}){
  if(typeof svg!=='string'||!svg.includes('<svg'))throw Error('Selecteer eerst een 2D-figuur.');
  if(!clipboard?.write || !Item || (Item.supports && !Item.supports('image/svg+xml')))
    throw Error('Deze browser ondersteunt geen SVG op het klembord. Gebruik een recente versie van Edge of Chrome, of download de SVG.');
  try{
    await clipboard.write([new Item({'image/svg+xml':new Blob([svg],{type:'image/svg+xml'})})]);
    return {format:'svg',outlinedText:false};
  }catch(error){
    if(error.name==='NotAllowedError')throw Error('De browser staat kopiëren niet toe. Klik opnieuw op Vector kopiëren en geef de website zo nodig klembordtoegang.');
    throw Error('SVG kopiëren is niet gelukt. Download de SVG of kies Kopiëren als PNG.');
  }
}

export async function rasterizeClipboardSVG(svg){
  const root=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
  const box=(root.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
  const w=Number(root.getAttribute('width'))||box[2],h=Number(root.getAttribute('height'))||box[3];
  if(!(w>0&&h>0))throw Error('Ongeldige SVG-afmetingen.');
  const scale=Math.min(4096/Math.max(w,h),Math.sqrt(16000000/(w*h)));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try{
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('SVG kon niet worden gerenderd.'));image.src=url;});
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG kon niet worden gemaakt.')),'image/png'));
  }finally{URL.revokeObjectURL(url);}
}

export async function copyRasterImage(svg,{
  clipboard=globalThis.navigator?.clipboard,Item=globalThis.ClipboardItem,render=rasterizeClipboardSVG,
}={}){
  if(!clipboard?.write||!Item)throw Error('Deze browser ondersteunt geen afbeeldingen op het klembord. Download de SVG.');
  const png=Promise.resolve().then(()=>render(svg));
  png.catch(()=>{});
  await clipboard.write([new Item({'image/png':png})]);
  return {format:'png'};
}
