/** Calculs indépendants de Foundry, faciles à tester. */
export function parseMeters(text) {
  const raw = String(text ?? "").trim().replace(/\s/g, "").replace(/m$/i, "").replace(",", ".");
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0.30 || value > 3.00) return null;
  return value;
}

export function heightInCases(meters, refMeters, refCases) {
  if (![meters, refMeters, refCases].every(n => typeof n === "number" && Number.isFinite(n) && n > 0)) {
    throw new Error("La taille et l'échelle doivent être des nombres positifs.");
  }
  return (meters / refMeters) * refCases;
}

export function textureAdjustment(currentTexture, baseTokenHeight, targetHeightCases) {
  if (!Number.isFinite(baseTokenHeight) || baseTokenHeight <= 0 || !Number.isFinite(targetHeightCases) || targetHeightCases <= 0) {
    throw new Error("Hauteur du token invalide.");
  }
  // Image plein pied verticale dans une case carrée : en mode « contain »,
  // sa hauteur d'origine vaut celle du token. Échelle ABSOLUE, non cumulative.
  const factor = targetHeightCases / baseTokenHeight;
  // Le signe est conservé pour respecter les éventuelles inversions d'image.
  const signX = Number(currentTexture?.scaleX) < 0 ? -1 : 1;
  const signY = Number(currentTexture?.scaleY) < 0 ? -1 : 1;
  // Ancre de bas de case : positionner le bas de l'image sur le bord inférieur
  // du token sans changer sa surface d'occupation. Pas valable pour l'anneau dynamique.
  const anchorY = Math.min(1, Math.max(0, 1 - baseTokenHeight / (2 * targetHeightCases)));
  return { scaleX: signX * factor, scaleY: signY * factor, anchorY };
}

export function roundCases(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Dimensions réelles du cadre qui doit contenir l'illustration à l'échelle voulue.
 * La hauteur est exacte, la largeur est agrandie si nécessaire pour éviter tout rognage.
 */
export function fittedFrame(targetHeightCases, originalWidth, imageAspectRatio, margin = 1.02) {
  if (![targetHeightCases, originalWidth, imageAspectRatio, margin].every(n => Number.isFinite(n) && n > 0)) {
    throw new Error("Paramètres du cadre invalides.");
  }
  return {
    width: Math.round(Math.max(originalWidth, targetHeightCases * imageAspectRatio * margin) * 10000) / 10000,
    height: Math.round(targetHeightCases * 10000) / 10000
  };
}

/** Ajuste la position pour conserver le centre horizontal et le bas du personnage. */
export function anchoredResizePosition(x, y, beforeWidth, beforeHeight, afterWidth, afterHeight, gridPixels) {
  if (![x, y, beforeWidth, beforeHeight, afterWidth, afterHeight, gridPixels].every(Number.isFinite)) {
    throw new Error("Coordonnées invalides.");
  }
  return {
    // Foundry V14 exige des coordonnées X/Y entières (pixels).
    // Sans arrondi, toute la mise à jour du token peut être rejetée.
    x: Math.round(x + (beforeWidth - afterWidth) * gridPixels / 2),
    y: Math.round(y + (beforeHeight - afterHeight) * gridPixels)
  };
}
