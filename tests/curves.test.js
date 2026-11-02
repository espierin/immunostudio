import test from 'node:test';
import assert from 'node:assert/strict';
import {bezier,splitBezier,arcTable,arcT} from '../src/model.js';
import {membraneMarkup} from '../src/membrane2d.js';

test('Adding several Bézier anchors preserves the membrane path and arc-length placement',()=>{
 const original=[[0,0],[5,7],[15,-4],[24,2]];
 const expanded=splitBezier(splitBezier(original,.37),.8);
 assert.equal(expanded.length,10);
 const a=arcTable(original,6000),b=arcTable(expanded,6000);
 assert.ok(Math.abs(a.length-b.length)<.001);
 for(let i=0;i<=40;i++){
  const x=bezier(original,arcT(a,i/40)),y=bezier(expanded,arcT(b,i/40));
  assert.ok(Math.hypot(x[0]-y[0],x[1]-y[1])<.002);
 }
 assert.equal(original.length,4);
});
test('2D bilayer remains finite and vector-based after adding curve anchors',()=>{
 const item={w:600,h:180,curve:splitBezier([[.05,.5],[.3,.1],[.7,.9],[.95,.5]]),bilayerThickness:34};
 const svg=membraneMarkup(item,{head:'#AFCBE0',tail:'#0077B6',core:'#EAF6FF'});
 assert.ok(svg.includes('<ellipse')||svg.includes('<circle'));
 assert.ok(svg.includes('<path'));
 assert.ok(!/NaN|Infinity|<image/.test(svg));
});
