import test from 'node:test';
import assert from 'node:assert/strict';
import {figureLabelMarkup, figureLabelControls} from '../src/figure-label.js';
import {fitReceptorAnchor} from '../src/receptor-anchor.js';
import {ccr5SVG} from '../src/receptor-art.js';
import {anchoredPose} from '../src/contour2d.js';

test('figure labels escape text, respect local and global visibility and remain inside the export frame', () => {
  const item = {kind:'svg', w:100, h:80, figureLabel:'CD4 <TCR>', figureLabelVisible:true};
  assert.match(figureLabelMarkup(item), /CD4 &lt;TCR&gt;/);
  assert.match(figureLabelMarkup(item), /textLength="93.96"|textLength="94"/);
  assert.equal(figureLabelMarkup(item, false), '');
  assert.equal(figureLabelMarkup({...item, figureLabelVisible:false}), '');
  assert.match(figureLabelControls(item), /data-sheet-field="figureLabel"/);
});

test('CCR5 anchoring matches the helix span to the bilayer and puts its center on the contour', () => {
  const item = {svg:ccr5SVG(),w:240,h:140,anchor2d:{side:1,pivotX:.5,pivotY:.8,offset:0}};
  assert.equal(fitReceptorAnchor(item,{bilayerThickness:34}),true);
  assert.ok(Math.abs(item.h * 62 / 140 - 34)<1e-9);
  const pose = anchoredPose(item,{point:[100,200],normal:[0,-1]},item.anchor2d);
  assert.ok(Math.abs(pose.y + item.h * item.anchor2d.pivotY - 200)<1e-9);
  assert.equal(fitReceptorAnchor({svg:'<svg/>',anchor2d:{}},{}),false);
  const mirrored={...item,mirrorY:true,anchor2d:{...item.anchor2d}};
  fitReceptorAnchor(mirrored,{bilayerThickness:40});
  assert.equal(mirrored.anchor2d.pivotY,1-61/140);
});
