import test from 'node:test';
import assert from 'node:assert/strict';
import {sheetToVolume} from '../src/basis-variants.js';
import {newProject,validateProject} from '../src/model.js';
test('2D molecule becomes a portable linked volume with its layout and Unicode source retained',()=>{
 const sheet={width:1600,height:900};
 const source={id:'source-1',kind:'svg',name:'TCR αβ',svg:'<svg xmlns="http://www.w3.org/2000/svg"><title>αβ</title><circle r="10"/></svg>',sourceFile:'basic.svg',x:1000,y:200,w:350,h:200,rotation:45,visible:true};
 const before=JSON.stringify(source),item=sheetToVolume(source,sheet);
 assert.equal(JSON.stringify(source),before);
 assert.equal(item.sourceSheetId,source.id);
 assert.equal(item.kind,'svg3d');assert.equal(item.anchored,false);
 assert.equal(item.rotation,-Math.PI/4);
 assert.ok(item.x>0&&item.y>8);assert.equal(item.scale,1);
 const decoded=new TextDecoder().decode(Uint8Array.from(atob(item.url.split(',')[1]),c=>c.charCodeAt(0)));
 assert.equal(decoded,source.svg);
 const project=newProject();project.items.push(item);assert.equal(validateProject(project).items.at(-1).sourceSheetId,source.id);
});
