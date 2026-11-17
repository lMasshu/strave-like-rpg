/** Identifiant DOM d'un onglet, relié à son panneau par `aria-controls`. */
export function tabId(prefix: string, id: string): string {
  return `${prefix}-tab-${id}`;
}

/** Identifiant DOM d'un panneau, relié à son onglet par `aria-labelledby`. */
export function panelId(prefix: string, id: string): string {
  return `${prefix}-panel-${id}`;
}
