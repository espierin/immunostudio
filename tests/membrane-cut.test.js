import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {newProject,arcTable} from '../src/model.js';
import {membraneCutGeometry} from '../src/membrane-cut.js';
test('Curved membrane cut is coplanar across both leaflets and stays within membrane depth',()=>{
 const p=newProject(),normal=new T.Vector3(.5,.4,.75).normalize(),target=new T.Vector3(0,1,0);
 const g=membraneCutGeometry(p,arcTable(p.curve),normal,target),a=g.attributes.position;
 assert.ok(a.count>100);
 for(let i=0;i<a.count;i++){
  const v=new T.Vector3().fromBufferAttribute(a,i);
  assert.ok(Math.abs(normal.dot(v.clone().sub(target)))<.00001,'Every point belongs to the same cutting plane');
  assert.ok(Math.abs(v.z)<=p.depth/2+.00001,'No cut bars outside the physical membrane');
 }
});
test('Continuous cut leaves a channel opening instead of spanning its lumen',()=>{
 const p=newProject();p.curve=[[-16,0],[-5,0],[5,0],[16,0]];
 const table=arcTable(p.curve),g=membraneCutGeometry(p,table,new T.Vector3(0,0,1),new T.Vector3(),[{s:table.length/2,v:0,r:1.25}]);
 const a=g.attributes.position;
 for(let i=0;i<a.count;i++)assert.ok(Math.abs(a.getX(i))>=1.24);
});
