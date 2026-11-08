import { parseMeters, heightInCases, textureAdjustment, roundCases, fittedFrame, anchoredResizePosition } from "./calculations.mjs";
import { conflictingVisageProperties, activeVisageStack } from "./visage-compat.mjs";

const ID = "gekko-token-scaler";
const DIALOG = foundry.applications.api.DialogV2;

function scaleReference() {
  return {
    meters: Number(game.settings.get(ID, "referenceMeters")),
    cases: Number(game.settings.get(ID, "referenceCases"))
  };
}

function warn(message) { ui.notifications.warn(`[GEKKO Token Scaler] ${message}`); }
function error(message) { ui.notifications.error(`[GEKKO Token Scaler] ${message}`); }
function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function canEdit(token) {
  return Boolean(game.user?.isGM && token?.document?.isOwner);
}

function visageStatus(doc, resizeFrame) {
  const active = Boolean(game.modules?.get('visage')?.active);
  const stack = activeVisageStack(doc, active);
  return { hasStack: stack.length > 0, conflicts: conflictingVisageProperties(stack, resizeFrame) };
}

const VISAGE_HELP = 'Dans l’éditeur Visage > Apparence > Taille et ajustement, décoche les cases X/Y, Échelle, Ajustement et Ancrage si elles sont cochées. Conserve « Image » cochée, puis réapplique l’apparence.';

function originalTextureOf(doc) {
  const current = doc.texture;
  return doc.getFlag(ID, "originalTexture") ?? {
    scaleX: current.scaleX,
    scaleY: current.scaleY,
    anchorX: current.anchorX,
    anchorY: current.anchorY,
    fit: current.fit
  };
}

function resizePosition(doc, width, height) {
  const size = canvas?.grid?.size ?? canvas?.scene?.grid?.size;
  if (!(Number.isFinite(size) && size > 0)) throw new Error("Impossible de lire la taille de grille de la scène.");
  return anchoredResizePosition(doc.x, doc.y, doc.width, doc.height, width, height, size);
}

function imageAspect(token) {
  // Token.texture est la texture PIXI déjà chargée, donc pas de téléchargement.
  const tex = token?.texture ?? token?.mesh?.texture;
  const width = Number(tex?.width);
  const height = Number(tex?.height);
  if (width > 0 && height > 0) return Math.min(2, Math.max(0.15, width / height));
  // Valeur prudente pour un portrait plein pied, si la texture n'est pas encore chargée.
  return 0.5;
}

async function applyHeight(token, meters) {
  if (!canEdit(token)) { warn("Cette opération est réservée au MJ propriétaire du token."); return; }
  const doc = token.document;
  const { meters: refMeters, cases: refCases } = scaleReference();
  const targetCases = heightInCases(meters, refMeters, refCases);
  if (doc.ring?.enabled) {
    warn("Ce prototype est prévu pour les tokens classiques, pas pour les anneaux dynamiques.");
    return;
  }

  // An active Visage may override size/scale. Its interceptor persists
  // background changes but reconstructs the visible state from the mask.
  // We must not claim failure nor silently edit Visage's saved appearances.
  const vis = visageStatus(doc, game.settings.get(ID, 'resizeFrame'));
  if (vis.conflicts.length) {
    warn("Une apparence Visage bloque ce redimensionnement. Consulte les paramètres de GEKKO Token Scaler.");
    return;
  }

  const originalTexture = originalTextureOf(doc);
  const originalFrame = doc.getFlag(ID, "originalFrame") ?? { width: doc.width, height: doc.height };
  const resizeFrame = game.settings.get(ID, "resizeFrame");
  let frameExpected = null;
  const changes = {
    [`flags.${ID}.originalTexture`]: originalTexture,
    [`flags.${ID}.originalFrame`]: originalFrame,
    [`flags.${ID}.meters`]: meters
  };
  try {
    if (resizeFrame) {
      // Cadre ET image : texture contenue à 98 %, sans débordement.
      // Les dimensions du token sur la grille sont modifiées dans ce mode.
      const frame = fittedFrame(targetCases, originalFrame.width, imageAspect(token));
      frameExpected = frame;
      Object.assign(changes, resizePosition(doc, frame.width, frame.height), {
        width: frame.width,
        height: frame.height,
        "texture.fit": "contain",
        "texture.scaleX": Math.sign(originalTexture.scaleX || 1) * 0.98,
        "texture.scaleY": Math.sign(originalTexture.scaleY || 1) * 0.98,
        "texture.anchorX": 0.5,
        "texture.anchorY": 0.5
      });
    } else {
      // Mode historique : garde la surface initiale sur la grille.
      // Le cadre de Foundry peut être dépassé par l'illustration.
      if (targetCases < originalFrame.height / 2) {
        warn("La taille calculée est trop petite pour le cadre initial de ce token. Réduis sa hauteur de base avant de réessayer.");
        return;
      }
      Object.assign(changes, resizePosition(doc, originalFrame.width, originalFrame.height), {
        width: originalFrame.width,
        height: originalFrame.height,
        ...Object.fromEntries(Object.entries(textureAdjustment(originalTexture, originalFrame.height, targetCases)).map(([key, val]) => [`texture.${key}`, val])),
        "texture.fit": originalTexture.fit ?? "contain",
        "texture.anchorX": originalTexture.anchorX ?? 0.5
      });
    }
    await doc.update(changes);
    // Dans V14, un refus de déplacement/redimensionnement peut ne pas
    // se manifester de manière évidente. Vérifier la donnée sauvegardée
    // avant d'afficher une notification de succès.
    if (resizeFrame) {
      const actualHeight = Number(doc._source?.height ?? doc.height);
      const actualWidth = Number(doc._source?.width ?? doc.width);
      if (!Number.isFinite(actualHeight) || !Number.isFinite(actualWidth)
          || Math.abs(actualHeight - frameExpected.height) > 0.03
          || Math.abs(actualWidth - frameExpected.width) > 0.03) {
        throw new Error(`Mise à jour non confirmée par Foundry (hauteur voulue ${frameExpected.height}, obtenue ${actualHeight}; largeur voulue ${frameExpected.width}, obtenue ${actualWidth}).`);
      }
    }
    const suffix = resizeFrame ? "cadre ajusté (dimensions de grille modifiées)" : "visuel uniquement";
    ui.notifications.info(`[GEKKO Token Scaler] ${doc.name} : ${meters.toLocaleString("fr-FR")} m → ${roundCases(targetCases).toLocaleString("fr-FR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} cases (${suffix}).`);
  } catch (ex) {
    console.error(`${ID} | Échec de mise à jour`, ex);
    error("Redimensionnement non appliqué. Détails dans la console F12. Aucun succès n’est confirmé tant que les dimensions ne sont pas enregistrées.");
  }
}

async function restoreHeight(token) {
  if (!canEdit(token)) { warn("Cette opération est réservée au MJ."); return; }
  const doc = token.document;
  const backup = doc.getFlag(ID, "originalTexture");
  const originalFrame = doc.getFlag(ID, "originalFrame");
  if (!backup) { warn("Aucune taille précédente mémorisée pour ce token."); return; }
  try {
    const changes = {
      "texture.scaleX": backup.scaleX,
      "texture.scaleY": backup.scaleY,
      "texture.anchorY": backup.anchorY
    };
    if (backup.anchorX !== undefined) changes["texture.anchorX"] = backup.anchorX;
    if (backup.fit !== undefined) changes["texture.fit"] = backup.fit;
    if (originalFrame) {
      Object.assign(changes, resizePosition(doc, originalFrame.width, originalFrame.height), originalFrame);
    }
    await doc.update(changes);
    await doc.unsetFlag(ID, "originalTexture");
    await doc.unsetFlag(ID, "originalFrame");
    await doc.unsetFlag(ID, "meters");
    ui.notifications.info(`[GEKKO Token Scaler] Apparence initiale rétablie pour ${doc.name}.`);
  } catch (ex) {
    console.error(`${ID} | Échec de restauration`, ex);
    error("Impossible de restaurer ce token. Consulte la console F12.");
  }
}

async function openForToken(token) {
  if (!canvas?.ready || !canvas?.scene) { warn("Ouvre une scène avant d'utiliser l'outil."); return; }
  if (!token) { warn("Sélectionne un token sur la scène."); return; }
  if (!canEdit(token)) { warn("Ce token n'est pas modifiable avec ton compte MJ."); return; }

  const doc = token.document;
  const { meters: referenceMeters } = scaleReference();
  const saved = Number(doc.getFlag(ID, "meters"));
  const initial = saved > 0 ? saved : referenceMeters;
  const hasBackup = Boolean(doc.getFlag(ID, "originalTexture"));

  // Une boîte volontairement minimaliste : tous les détails d’échelle,
  // collisions et compatibilité Visage sont dans les paramètres du module.
  const content = `
    <div class="gekko-scaler-form">
      <p class="gekko-scaler-token"><i class="fa-solid fa-user"></i> <strong>${escapeHtml(doc.name)}</strong></p>
      <div class="form-group">
        <label for="gekko-token-meters">Taille (m)</label>
        <div class="form-fields"><input id="gekko-token-meters" name="characterMeters" type="text" inputmode="decimal" value="${initial.toFixed(2).replace(".", ",")}" placeholder="1,70" autocomplete="off" autofocus></div>
      </div>
    </div>`;

  const buttons = [
    { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark" },
    ...(hasBackup ? [{ action: "restore", label: "Restaurer", icon: "fa-solid fa-rotate-left" }] : []),
    {
      action: "apply", label: "Appliquer", icon: "fa-solid fa-check", default: true,
      callback: (_event, button) => ({ action: "apply", input: button.form.elements.characterMeters.value })
    }
  ];

  const response = await DIALOG.wait({
    window: { title: "GEKKO Token Scaler — Ajuster la taille", resizable: false },
    position: { width: 430, height: "auto" },
    classes: ["gekko-token-scaler-dialog"],
    content,
    buttons,
    rejectClose: false
  });

  if (response === "restore") return restoreHeight(token);
  if (!response || response === "cancel" || response.action !== "apply") return;
  const meters = parseMeters(response.input);
  if (meters === null) {
    warn("Indique une taille entre 0,30 m et 3,00 m (ex. : 1,70 ou 1.70).");
    return;
  }
  await applyHeight(token, meters);
}

function openSelected() {
  const tokens = canvas?.tokens?.controlled ?? [];
  if (tokens.length !== 1) {
    warn(tokens.length ? "Sélectionne un seul token à la fois." : "Sélectionne un token sur la scène.");
    return;
  }
  void openForToken(tokens[0]);
}

Hooks.once("init", () => {
  game.settings.register(ID, "referenceMeters", {
    name: "Taille réelle de référence (m)",
    hint: "Exemple : 1,80 pour un personnage de 1,80 m. Cette référence est commune à tous les tokens.",
    scope: "world", config: true, type: Number, default: 1.8,
    range: { min: 0.3, max: 3, step: 0.01 }, requiresReload: false
  });
  game.settings.register(ID, "referenceCases", {
    name: "Hauteur visuelle de référence (cases)",
    hint: "Exemple : 2,50 cases pour un personnage de 1,80 m. Valeur calculée proportionnellement pour chaque personnage.",
    scope: "world", config: true, type: Number, default: 2.5,
    range: { min: 0.1, max: 10, step: 0.01 }, requiresReload: false
  });
  game.settings.register(ID, "resizeFrame", {
    name: "Adapter le cadre à l’image",
    hint: "Activé : l’image reste dans son cadre, mais la surface occupée et les collisions changent. Désactivé : la surface reste inchangée, mais l’image peut déborder. Compatibilité Visage : " + VISAGE_HELP,
    scope: "world", config: true, type: Boolean, default: true, requiresReload: false
  });
});

// Bouton de la barre d'outils Tokens : fonctionne même quand le HUD est masqué.
Hooks.on("getSceneControlButtons", controls => {
  if (!game.user?.isGM || !controls?.tokens?.tools) return;
  controls.tokens.tools.gekkoTokenScaler = {
    name: "gekkoTokenScaler",
    title: "GEKKO Token Scaler : ajuster le token sélectionné",
    icon: "fa-solid fa-ruler-vertical",
    order: Object.keys(controls.tokens.tools).length + 1,
    button: true,
    visible: true,
    onChange: () => openSelected()
  };
});

// Bouton du HUD (clic droit) : événement ciblé V14 + filet de sécurité ApplicationV2.
// Compatibilité avec HTMLElement (V14), jQuery ou tableau de nœuds (modules tiers).
function normalizeHudRoot(html, app) {
  if (html && typeof html.querySelector === "function") return html;
  if (html?.[0] && typeof html[0].querySelector === "function") return html[0];
  if (app?.element && typeof app.element.querySelector === "function") return app.element;
  return null;
}

function insertHudButton(hud, html) {
  try {
    if (!game.user?.isGM) return;
    const token = hud?.object;
    if (!canEdit(token)) return;

    const root = normalizeHudRoot(html, hud);
    if (!root || root.querySelector(".gekko-token-scaler-hud-button")) return;

    // Sur V14, placer le bouton sous les contrôles de GAUCHE (sous le masque).
    // Conserver la droite uniquement comme ultime secours pour les HUD personnalisés.
    const selectors = [".col.left", ".left.col", ".control-column.left", ".left-controls", ".col.right", ".right.col", ".control-column.right", ".right-controls"];
    let holder = selectors.map(sel => root.matches?.(sel) ? root : root.querySelector(sel)).find(Boolean);
    const fallback = !holder;
    holder ??= root;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-icon gekko-token-scaler-hud-button";
    button.title = "GEKKO Token Scaler — Ajuster la taille";
    button.setAttribute("aria-label", button.title);
    button.innerHTML = '<i class="fa-solid fa-ruler-vertical" aria-hidden="true"></i>';
    if (fallback) {
      root.classList?.add("gekko-token-scaler-hud-fallback");
      button.classList.add("gekko-token-scaler-hud-floating");
    }
    button.addEventListener("pointerdown", e => e.stopPropagation());
    button.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      void openForToken(token);
    });
    holder.append(button);
    console.debug(`${ID} | Bouton HUD inséré`, { fallback });
  } catch (ex) {
    console.error(`${ID} | Erreur lors de l'ajout du bouton HUD`, ex);
  }
}

// L'événement dédié est prioritaire ; le second hook permet de gérer les HUD
// personnalisés qui ne déclenchent que le hook général ApplicationV2.
Hooks.on("renderTokenHUD", (hud, html) => insertHudButton(hud, html));
Hooks.on("renderApplicationV2", (app, html) => {
  const TokenHUDClass = foundry.applications?.hud?.TokenHUD;
  if (TokenHUDClass && app instanceof TokenHUDClass) insertHudButton(app, html);
});

Hooks.once("ready", () => {
  const mod = game.modules?.get(ID);
  if (mod) mod.api = { openSelected };
  console.info(`${ID} | V0.1.7 chargée — Foundry V14`);
});
