import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import {Drawing2D,newSheet} from '../src/drawing2d.js';
import {curveAppearanceMarkup,lineStyles} from '../src/curve-appearance2d.js';
import {findOfficeService,exportOfficeImage} from '../src/vector-clipboard.js';
import {ccr5SVG} from '../src/receptor-art.js';
const {SaxesParser}=createRequire(import.meta.resolve('jsdom'))('saxes');

test('full and selection SVG exports are strict XML for every line, membrane and tissue style',()=>{
  const window=new JSDOM('').window;
  globalThis.DOMParser=window.DOMParser;globalThis.XMLSerializer=window.XMLSerializer;
  try{
    for(const lineStyle of lineStyles){
      const doc=newSheet(),item={id:'curve',kind:'membrane',lineStyle,w:400,h:150,x:20,y:30,visible:true,opacity:1,bilayerThickness:34,curve:[[0,.5],[.3,.1],[.7,.9],[1,.5]]};
      const receptor={id:'ccr5',kind:'svg',svg:ccr5SVG(),x:100,y:80,w:140,h:80,visible:true,opacity:1,figureLabel:'CCR5 & receptor',figureLabelVisible:true};
      doc.items=[item,receptor];
      const drawing={doc,selectedItems:()=>doc.items,style:{label:'#064986',head:'#a9c6e2',tail:'#80b2d8'},cache:new Map(),labelsVisible:true,curveMarkup:curveAppearanceMarkup,itemMarkup:Drawing2D.prototype.itemMarkup};
      for(const method of ['exportSVG','exportSelectionSVG']){
        const svg=Drawing2D.prototype[method].call(drawing);
        const parser=new SaxesParser({xmlns:true});parser.write(svg).close();
        assert.match(svg,/data-curve-fill="true"/);
        assert.match(svg,/CCR5 &amp; receptor/);
      }
    }
  }finally{delete globalThis.DOMParser;delete globalThis.XMLSerializer;window.close();}
});

test('Office export from the published app uses the local converter and its session token',async()=>{
  const requests=[];
  const blob=await exportOfficeImage('<svg/>','emf',{href:'https://espierin.github.io/immunostudio/',fetcher:async(url,options)=>{
    requests.push({url,options});return url.endsWith('/status')?{ok:true,json:async()=>({office:true,token:'session'})}:{ok:true,blob:async()=>new Blob(['emf'])};
  }});
  assert.equal(await blob.text(),'emf');
  assert.equal(requests[1].url,'http://127.0.0.1:5180/api/office/export');
  assert.equal(requests[1].options.headers['X-ImmunoStudio'],'session');
});

test('a local development page can find the standard helper on a different port',async()=>{
  const service=await findOfficeService({href:'http://127.0.0.1:5181/',fetcher:async url=>url.startsWith('http://127.0.0.1:5180/')?{ok:true,json:async()=>({office:true,token:'session'})}:{ok:false}});
  assert.equal(service.base,'http://127.0.0.1:5180');
});
