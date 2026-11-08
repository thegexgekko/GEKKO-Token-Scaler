import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const code=readFileSync(new URL('../scripts/main.mjs',import.meta.url),'utf8');
const dialog=code.slice(code.indexOf('async function openForToken('),code.indexOf('function openSelected()'));
test('fenêtre petite et contrôlée',()=>{
  assert.match(dialog,/position: \{ width: 430, height: "auto" \}/);
  assert.match(dialog,/name="characterMeters"/);
  assert.match(dialog,/action: "apply"/);
  assert.doesNotMatch(dialog,/gekko-scaler-visage-warning|gekko-scaler-help|gekko-scaler-reference|gekko-scaler-result/);
});
test('conseils Visage dans les paramètres et notification courte',()=>{
  assert.match(code,/Compatibilité Visage : " \+ VISAGE_HELP/);
  assert.match(code,/Consulte les paramètres de GEKKO Token Scaler/);
  assert.doesNotMatch(dialog,/VISAGE_HELP/);
});
