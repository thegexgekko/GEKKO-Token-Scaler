/**
 * Visage V5 applies active masks over the TokenDocument background state.
 * A non-null width/height/scale/fit override takes visual priority over
 * external modules even when those modules successfully update the base token.
 * No Visage data is modified here (intentional non-destructive integration).
 */
export function conflictingVisageProperties(stack, resizeFrame = true) {
  if (!Array.isArray(stack) || stack.length === 0) return [];
  const conflicts = new Set();
  for (const layer of stack) {
    if (!layer || layer.disabled) continue;
    const c = layer.changes ?? {};
    if (resizeFrame) {
      if (c.width != null) conflicts.add('largeur (X)');
      if (c.height != null) conflicts.add('hauteur (Y)');
    }
    if (c.scale != null || c.texture?.scaleX != null || c.texture?.scaleY != null) conflicts.add('échelle visuelle');
    if (c.texture?.fit != null) conflicts.add('ajustement de l’image');
    if (c.texture?.anchorX != null || c.texture?.anchorY != null) conflicts.add('point d’ancrage');
  }
  return [...conflicts];
}

export function activeVisageStack(doc, isActive) {
  if (!isActive) return [];
  const stack = doc?.getFlag?.('visage', 'activeStack');
  return Array.isArray(stack) ? stack : [];
}
