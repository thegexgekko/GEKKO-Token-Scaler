import assert from 'node:assert/strict';
import test from 'node:test';
import { conflictingVisageProperties, activeVisageStack } from '../scripts/visage-compat.mjs';

test('sans Visage actif, aucun blocage', () => {
 assert.deepEqual(activeVisageStack({getFlag: () => [{changes:{width:2}}]},false), []);
 assert.deepEqual(conflictingVisageProperties([],true), []);
});
test('Visage qui ne remplace que les vêtements ne bloque pas le redimensionnement', () => {
 const stack=[{disabled:false,changes:{texture:{src:'miime_nouveau.png'},name:'Miimé'}}];
 assert.deepEqual(conflictingVisageProperties(stack,true),[]);
 assert.deepEqual(activeVisageStack({getFlag:(_mod,k)=>k==='activeStack'?stack:undefined},true),stack);
});
test('Visage X/Y impose sa taille et bloque le mode cadre', () => {
 const stack=[{disabled:false,changes:{width:2.5,height:2.5,texture:{src:'costume.png'}}}];
 assert.deepEqual(conflictingVisageProperties(stack,true),['largeur (X)','hauteur (Y)']);
 assert.deepEqual(conflictingVisageProperties(stack,false),[]);
});
test('Visage scale/fit/anchors bloque les dimensions visuelles dans les deux modes', () => {
 const stack=[{changes:{scale:1.2,texture:{fit:'cover',anchorY:.1}}}];
 assert.deepEqual(conflictingVisageProperties(stack,true),['échelle visuelle','ajustement de l’image','point d’ancrage']);
 assert.equal(conflictingVisageProperties(stack,false).length,3);
});
test('une couche Visage désactivée ne bloque rien, même si elle contient une taille', () => {
 const stack=[{disabled:true,changes:{width:10,height:10,scale:5}},{changes:{texture:{src:'foo.png'}}}];
 assert.deepEqual(conflictingVisageProperties(stack,true),[]);
});
test('une couche visuelle sans taille ne masque pas la taille du token', () => {
 const stack=[{changes:{texture:{src:'a.png'}}},{changes:{alpha:0.5}}];
 assert.deepEqual(conflictingVisageProperties(stack,true),[]);
});
