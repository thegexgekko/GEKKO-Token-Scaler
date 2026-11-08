import assert from 'node:assert/strict';
import test from 'node:test';

const hooks=new Map();
const settings=new Map();
let adaptFrame=true;
let response={action:'apply',input:'1,70'};
const updates=[];
const flags={};
let visageStack=[];
const warningMessages=[];
class FakeHUD {}
globalThis.foundry={applications:{api:{DialogV2:{wait:async()=>response}},hud:{TokenHUD:FakeHUD}}};
globalThis.Hooks={on:(k,f)=>hooks.set(k,f),once:(k,f)=>hooks.set(k,f)};
globalThis.game={user:{isGM:true},modules:{get:id=>id==='visage'?{active:true}:undefined},settings:{
  register:(_id,k,s)=>settings.set(k,s),
  get:(_id,k)=>k==='resizeFrame'?adaptFrame:settings.get(k).default
}};
globalThis.ui={notifications:{warn:(t)=>{warningMessages.push(t)},error:(t)=>{throw new Error(t)},info:()=>{}}};
const doc={name:'Miimé',isOwner:true,x:100,y:200,width:1,height:1,
  texture:{src:'test.png',scaleX:1,scaleY:1,anchorX:0.5,anchorY:0.5,fit:'contain'}, ring:{enabled:false},
  getFlag:(id,k)=>id==='visage'?(k==='activeStack'?visageStack:undefined):flags[k],unsetFlag:async(_id,k)=>{delete flags[k]},
  update:async ch=>{
    // Contraintes de Foundry V14 : les positions en pixels sont des entiers.
    if (ch.x!==undefined && !Number.isInteger(ch.x)) throw new Error(`Foundry: x non entier: ${ch.x}`);
    if (ch.y!==undefined && !Number.isInteger(ch.y)) throw new Error(`Foundry: y non entier: ${ch.y}`);
    updates.push({...ch});
    for (const [k,v] of Object.entries(ch)) {
      if (k.startsWith('texture.'))doc.texture[k.slice(8)]=v;
      else if (k.startsWith('flags.gekko-token-scaler.'))flags[k.split('.').at(-1)]=v;
      else doc[k]=v;
    }
  }
};
const token={document:doc,texture:{width:600,height:1000}};
globalThis.canvas={ready:true,scene:{grid:{size:100}},grid:{size:100},tokens:{controlled:[token]}};
await import('../scripts/main.mjs');
hooks.get('init')();
const launch=async()=>{const c={tokens:{tools:{}}};hooks.get('getSceneControlButtons')(c);c.tokens.tools.gekkoTokenScaler.onChange();await new Promise(r=>setImmediate(r));return c;};

test('les 3 paramètres sont bien présents, nouveau mode actif',()=>{
  assert.equal(settings.size,3);
  assert.equal(settings.get('referenceMeters').default,1.8);
  assert.equal(settings.get('referenceCases').default,2.5);
  assert.equal(settings.get('resizeFrame').default,true);
});
test('mode cadre : l’image reste dedans et on préserve les pieds',async()=>{
  await launch();
  assert.equal(updates.length,1);
  assert.ok(Math.abs(doc.height-1.7/1.8*2.5)<0.0001);
  assert.ok(doc.width>=doc.height*0.6);
  assert.equal(doc.texture.fit,'contain');
  assert.equal(doc.texture.scaleX,0.98);
  assert.equal(doc.texture.scaleY,0.98);
  assert.equal(doc.texture.anchorY,0.5);
  assert.ok(Math.abs(doc.y+doc.height*100-300)<=0.51);
  assert.ok(Math.abs(doc.x+doc.width*50-150)<=0.51);
  assert.equal(flags.meters,1.7);
  assert.deepEqual(flags.originalFrame,{width:1,height:1});
});
test('second ajustement garde le même bas et l’échelle n’est pas cumulative',async()=>{
  response={action:'apply',input:'1,60'};
  await launch();
  assert.ok(Math.abs(doc.height-1.6/1.8*2.5)<0.0001);
  assert.equal(doc.texture.scaleX,0.98);
  assert.ok(Math.abs(doc.y+doc.height*100-300)<=0.51);
  assert.deepEqual(flags.originalFrame,{width:1,height:1});
});
test('Restaurer remet cadre et texture sans téléporter un token déplacé',async()=>{
  doc.x+=250;doc.y+=125;
  const movedFeet=doc.y+doc.height*100,movedCenter=doc.x+doc.width*50;
  response='restore';
  await launch();
  assert.equal(doc.width,1);
  assert.equal(doc.height,1);
  assert.equal(doc.texture.scaleX,1);
  assert.equal(doc.texture.anchorY,0.5);
  assert.ok(Math.abs(doc.y+100-movedFeet)<=0.51);
  assert.ok(Math.abs(doc.x+50-movedCenter)<=0.51);
  assert.equal(flags.meters,undefined);
  assert.equal(flags.originalFrame,undefined);
});
test('mode visuel conserve la surface occupée sur la grille',async()=>{
  adaptFrame=false;
  response={action:'apply',input:'1,50'};
  const beforeWidth=doc.width,beforeHeight=doc.height;
  await launch();
  assert.equal(doc.width,beforeWidth);
  assert.equal(doc.height,beforeHeight);
  assert.equal(doc.texture.scaleY,1.5/1.8*2.5);
  assert.equal(flags.meters,1.5);
});
test('migration d’une sauvegarde V0.1.1 vers cadre adapté',async()=>{
  adaptFrame=true;
  response={action:'apply',input:'1,70'};
  delete flags.originalFrame;
  flags.originalTexture={scaleX:1,scaleY:1,anchorY:0.5};
  await launch();
  assert.equal(doc.texture.scaleX,0.98);
  assert.ok(Math.abs(doc.height-1.7/1.8*2.5)<0.0001);
  assert.equal(flags.originalTexture.scaleX,1);
});
test('bouton HUD ajouté SOUS les contrôles de gauche, même si la droite existe',async()=>{
  const left={children:[],append(b){this.children.push(b)}};
  const right={children:[],append(b){this.children.push(b)}};
  const root={querySelector(s){
    if(s==='.col.left') return left;
    if(s==='.col.right') return right;
    if(s==='.gekko-token-scaler-hud-button') return left.children[0]??right.children[0]??null;
    return null;
  },matches(){return false}};
  const handlers={};
  globalThis.document={createElement(){return{className:'',type:null,title:'',setAttribute(){},addEventListener(t,f){handlers[t]=f},classList:{add(){}}}}};
  const hud=new FakeHUD();hud.object=token;
  hooks.get('renderTokenHUD')(hud,{0:root,length:1,jquery:'3'});
  assert.equal(left.children.length,1);
  assert.equal(right.children.length,0);
  assert.match(left.children[0].innerHTML,/ruler/);
  hooks.get('renderApplicationV2')(hud,root);
  assert.equal(left.children.length,1);
  const last=updates.length;
  handlers.click({preventDefault(){},stopPropagation(){}});
  await new Promise(r=>setImmediate(r));
  assert.equal(updates.length,last+1);
});

test('compatibilité HUD personnalisé : bouton dans la seule colonne disponible',()=>{
  const right={children:[],append(b){this.children.push(b)}};
  const root={querySelector(s){
    if(s==='.col.right') return right;
    if(s==='.gekko-token-scaler-hud-button') return right.children[0]??null;
    return null;
  },matches(){return false}};
  const hud=new FakeHUD();hud.object=token;
  hooks.get('renderTokenHUD')(hud,root);
  assert.equal(right.children.length,1);
});

test('avec un costume Visage qui impose X/Y, avertir sans tenter une mise à jour masquée',async()=>{
  adaptFrame=true;
  response={action:'apply',input:'1,70'};
  visageStack=[{changes:{width:3,height:3,texture:{src:'tenue.png'}}}];
  const n=updates.length;
  await launch();
  assert.equal(updates.length,n);
  assert.match(warningMessages.at(-1),/Visage bloque ce redimensionnement/);
  assert.match(warningMessages.at(-1),/paramètres de GEKKO Token Scaler/);
  visageStack=[];
});

test('avec un costume Visage qui ne change que le PNG, calcul autorisé',async()=>{
  adaptFrame=true;
  response={action:'apply',input:'1,70'};
  visageStack=[{changes:{texture:{src:'tenue.png'}}}];
  const n=updates.length;
  await launch();
  assert.equal(updates.length,n+1);
  visageStack=[];
});
