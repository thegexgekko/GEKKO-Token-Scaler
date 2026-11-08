import assert from 'node:assert/strict';
import test from 'node:test';
import {heightInCases, parseMeters, roundCases, textureAdjustment, fittedFrame, anchoredResizePosition} from '../scripts/calculations.mjs';

test('échelle Gekko : 1,80 m = 2,50 cases', () => {
  assert.deepEqual([1.5,1.6,1.7,1.8,1.9,2].map(h => roundCases(heightInCases(h,1.8,2.5))), [2.08,2.22,2.36,2.5,2.64,2.78]);
});
test('formats de saisie en mètres',()=>{
  assert.equal(parseMeters('1,70'),1.7);
  assert.equal(parseMeters('1.70'),1.7);
  assert.equal(parseMeters('1,7 m'),1.7);
  for (const s of ['x','', '-1', '0,10','3,2']) assert.equal(parseMeters(s),null);
});
test('cadre : hauteur précise, largeur conservée ou agrandie selon ratio',()=>{
  assert.deepEqual(fittedFrame(2.36,1,0.6),{width:1.4443,height:2.36});
  assert.deepEqual(fittedFrame(2.36,2,0.6),{width:2,height:2.36});
});
test('position : garder les pieds et le centre, même quand la largeur varie',()=>{
  const p=anchoredResizePosition(100,200,1,1,1.5,2.36,100);
  assert.deepEqual(p,{x:75,y:64});
  assert.ok(Math.abs((p.y+236)-(200+100)) <= 0.5);
  assert.equal(p.x+75,150);
});
test('mode visuel uniquement ancien et sans modification de base',()=>{
  assert.deepEqual(textureAdjustment({scaleX:1,scaleY:1},1,2.5),{scaleX:2.5,scaleY:2.5,anchorY:0.8});
});

// Régression V0.1.2 : les positions fractionnaires provoquaient un refus
// de mise à jour du token en V14. Ce test est distinct des simples calculs.
test('V14 : x et y sont toujours des pixels ENTIERS, même pour 1,70 m',()=>{
  const height=heightInCases(1.7,1.8,2.5);
  const frame=fittedFrame(height,1,0.6);
  const pos=anchoredResizePosition(100,200,1,1,frame.width,frame.height,100);
  assert.ok(Number.isInteger(pos.x));
  assert.ok(Number.isInteger(pos.y));
  assert.ok(Math.abs(pos.x + frame.width*50 - 150) <= 0.51);
  assert.ok(Math.abs(pos.y + frame.height*100 - 300) <= 0.51);
});
test('V14 : x/y arrondis aussi à la restauration',()=>{
  const pos=anchoredResizePosition(77,64,1.4443,2.3611,1,1,100);
  assert.ok(Number.isInteger(pos.x));
  assert.ok(Number.isInteger(pos.y));
});
