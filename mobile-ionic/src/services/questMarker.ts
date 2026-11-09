/** Crée un marqueur de quête sans interpréter le titre comme du HTML. */
export function createQuestMarkerElement(title: string): HTMLDivElement {
  const marker = document.createElement("div");
  marker.className = "map-poi-marker quest-objective-marker";

  const icon = document.createElement("div");
  icon.className = "poi-marker-icon";
  icon.textContent = "🏆";

  const label = document.createElement("div");
  label.className = "poi-marker-label";
  label.textContent = title;

  marker.append(icon, label);
  return marker;
}
