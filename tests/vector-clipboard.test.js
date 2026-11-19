import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {Drawing2D,newSheet} from '../src/drawing2d.js';
import {copyVectorImage} from '../src/vector-clipboard.js';
import {officeClipboard} from '../scripts/office-clipboard.mjs';
import {ccr5SVG} from '../src/receptor-art.js';
import {biologicalFigureFor,biologicalArtwork} from '../src/biological-figures.js';
test('selection vector export crops the visible selection and retains reflection and rotation',()=>{
  const doc=newSheet(),a={id:'a',x:200,y:300,w:80,h:120,rotation:35,opacity:.8,visible:true,mirrorX:true,svg:'<path id="selected-art" d="M0 0L80 120"/>'},b={...a,id:'b',x:1000,svg:'<text>not selected</text>'};
  doc.items=[a,b];const drawing={doc,selectedItems:()=>[a],itemMarkup:i=>i.svg};
  const before=JSON.stringify(doc),svg=Drawing2D.prototype.exportSelectionSVG.call(drawing);
  assert.match(svg,/selected-art/);assert.doesNotMatch(svg,/not selected/);
  assert.match(svg,/rotate\(35\)/);assert.match(svg,/scale\(-1 1\)/);
  assert.doesNotMatch(svg,/width="1600"/);assert.equal(JSON.stringify(doc),before);
  assert.throws(()=>Drawing2D.prototype.exportSelectionSVG.call({...drawing,selectedItems:()=>[]}),/Selecteer/);
});
test('Office copy sends only the prepared SVG to the authenticated local helper',async()=>{
  const seen=[],svg=ccr5SVG();
  const result=await copyVectorImage(svg,{href:'https://espierin.github.io/immunostudio/',fetcher:async(url,options)=>{
    seen.push({url,options});return url.endsWith('/status')?{ok:true,json:async()=>({officeClipboard:true,token:'test-token'})}:{ok:true,json:async()=>({format:'emf',outlinedText:true})};
  }});
  assert.equal(result.format,'emf');assert.equal(result.outlinedText,true);
  assert.equal(seen[1].url,'http://127.0.0.1:5180/api/office/clipboard');
  assert.equal(seen[1].options.headers['X-ImmunoStudio'],'test-token');
  assert.deepEqual(JSON.parse(seen[1].options.body),{svg});
});
test('browser fallback writes real SVG only when supported, and never silently supplies a bitmap',async()=>{
  let writes=0;
  class Item{constructor(data){this.data=data;}static supports(type){return type==='image/svg+xml';}}
  const result=await copyVectorImage(ccr5SVG(),{fetcher:async()=>{throw Error('offline');},Item,clipboard:{write:async items=>{writes++;assert.equal(items[0].data['image/svg+xml'].type,'image/svg+xml');assert.match(await items[0].data['image/svg+xml'].text(),/CCR5/);}}});
  assert.equal(result.format,'svg');assert.equal(writes,1);
  await assert.rejects(copyVectorImage(ccr5SVG(),{allowSVG:false,fetcher:async()=>{throw Error('offline');},Item,clipboard:{write:async()=>{throw Error('Office must not receive SVG clipboard data');}}}),/lokale ImmunoStudio-helper/);
  await assert.rejects(copyVectorImage(ccr5SVG(),{fetcher:async()=>{throw Error('offline');},Item:undefined,clipboard:undefined}),/lokale ImmunoStudio-helper/);
});
test('native clipboard outlines fonts, copies an EMF and removes the temporary file',async()=>{
  let copied;
  const result=await officeClipboard(ccr5SVG(),{platform:'win32',exporter:async(svg,format,options)=>{assert.match(svg,/CCR5/);assert.equal(format,'emf');assert.equal(options.outlineText,true);return Buffer.from('test-enhanced-metafile');},copier:async file=>{copied=file;assert.equal(await readFile(file,'utf8'),'test-enhanced-metafile');}});
  assert.equal(result.format,'emf');await assert.rejects(access(copied));
});
test('CCR5 is a standalone editable seven-helix vector and is reused by pathway imports',()=>{
  const svg=ccr5SVG();assert.equal([...svg.matchAll(/data-ccr5-helix=/g)].length,7);
  assert.doesNotMatch(svg,/<image|<script/);assert.match(svg,/UniProt P51681/);
  assert.match(biologicalArtwork(biologicalFigureFor('CCR5')),/data-receptor="CCR5"/);
});
