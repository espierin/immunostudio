import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {receptorAnchorProfile,fitReceptorAnchor} from '../src/receptor-anchor.js';
import {anchoredPose,contourFrame,sculptContour} from '../src/contour2d.js';
import {newProject,validateProject} from '../src/model.js';
import {newSheet} from '../src/drawing2d.js';

const files = ['basic_13_TCR_CD3_user.svg','basic_14_TCR_CD8.svg','basic_150_CD4_coreceptor_four_domains.svg','basic_15_CD8_coreceptor.svg'];
const native = file => ({kind:'svg',sourceFile:`02_HLA_peptiden_en_receptoren/${file}`,svg:readFileSync(new URL(`../public/library/02_HLA_peptiden_en_receptoren/${file}`,import.meta.url),'utf8'),w:240,h:240,anchor2d:{targetId:'host',pathIndex:0,u:.3,pivotX:.5,pivotY:.8,side:1,offset:0,angle:0}});
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);

test('native TCR, CD4 and CD8 anchor their transmembrane stems, including asymmetric bounds and reversed CD4 orientation',()=>{
  for(const file of files){
    const item=native(file),profile=receptorAnchorProfile(item);
    assert.ok(profile && profile.pivotX>0 && profile.pivotX<1 && profile.pivotY>0 && profile.pivotY<1);
    assert.equal(fitReceptorAnchor(item,{bilayerThickness:34}),true);
    close(item.h*profile.span,34);
    if(file.includes('CD4')) {assert.equal(item.anchor2d.angle,180);assert.notEqual(item.anchor2d.pivotX,.5);}
    assert.equal(fitReceptorAnchor(item,{bilayerThickness:34},true),false);
    assert.equal(fitReceptorAnchor(item,{bilayerThickness:50},true),true);
    close(item.h*profile.span,50);
  }
  assert.equal(receptorAnchorProfile({name:'CD4 helper T cell',svg:'<svg/>'}),null);
});

test('all native receptors stay on a sculpted membrane and perpendicular on either side, with reflection and movement',()=>{
  const initial=Array.from({length:64},(_,n)=>[200*Math.cos(n*Math.PI/32),200*Math.sin(n*Math.PI/32)]);
  const sculpted=sculptContour(initial,[200,0],[-55,35],{radius:110,strength:1});
  for(const file of files)for(const mirrorX of [false,true])for(const mirrorY of [false,true])for(const side of [-1,1]){
    const item={...native(file),mirrorX,mirrorY};item.anchor2d.side=side;
    fitReceptorAnchor(item,{bilayerThickness:34});
    const profile=receptorAnchorProfile(item);
    for(const points of [initial,sculpted,sculpted.map(([x,y])=>[x+83,y-42])]){
      const frame=contourFrame(points,.035,true),pose=anchoredPose(item,frame,item.anchor2d),r=pose.rotation*Math.PI/180;
      const x=(item.anchor2d.pivotX-.5)*item.w,y=(item.anchor2d.pivotY-.5)*item.h;
      close(pose.x+item.w/2+x*Math.cos(r)-y*Math.sin(r),frame.point[0]);
      close(pose.y+item.h/2+x*Math.sin(r)+y*Math.cos(r),frame.point[1]);
      const outward=(profile.angle===180?1:-1)*(mirrorY?-1:1),axis=[-Math.sin(r)*outward,Math.cos(r)*outward];
      close(axis[0]*frame.tangent[0]+axis[1]*frame.tangent[1],0);
      close(axis[0]*frame.normal[0]+axis[1]*frame.normal[1],side);
    }
  }
});

test('pathway receptor artwork has a matching profile and fitted anchors survive local project saving',()=>{
  for(const type of ['tcr','tra','trb','cd4','cd8a','cd8b']){
    const profile=receptorAnchorProfile({pathway:{type:`bio-${type}`}});
    close(profile.pivotY,87/140);close(profile.span,38/140);
  }
  const project=newProject();project.sheet=newSheet();
  const item={...native(files[0]),id:'tcr',x:0,y:0,rotation:0,opacity:1,visible:true};
  fitReceptorAnchor(item,{bilayerThickness:34});
  project.sheet.items=[{id:'host',kind:'ellipse',x:0,y:0,w:300,h:300,rotation:0,opacity:1,visible:true},item];
  const restored=validateProject(JSON.parse(JSON.stringify(project)));
  assert.equal(restored.sheet.items[1].anchor2d.receptorFit,item.anchor2d.receptorFit);
});
