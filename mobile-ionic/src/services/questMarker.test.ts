import { describe, expect, it } from "vitest";
import { createQuestMarkerElement } from "./questMarker";

describe("createQuestMarkerElement", () => {
  it.each([
    "Cap sur : le parc",
    "",
    "Église 🌳",
    '<img src=x onerror="alert(1)"><script>alert(1)</script>',
    "&lt;b&gt;",
  ])("affiche le titre %j comme du texte sans créer de HTML", (title) => {
    const marker = createQuestMarkerElement(title);

    expect(marker.tagName).toBe("DIV");
    expect(marker.className).toBe("map-poi-marker quest-objective-marker");
    expect(marker.children).toHaveLength(2);

    const [icon, label] = Array.from(marker.children);
    expect(icon.tagName).toBe("DIV");
    expect(icon.className).toBe("poi-marker-icon");
    expect(icon.textContent).toBe("🏆");
    expect(label.tagName).toBe("DIV");
    expect(label.className).toBe("poi-marker-label");
    expect(label.textContent).toBe(title);
    expect(label.children).toHaveLength(0);
    expect(marker.querySelector("img, script, [onerror], [onload]")).toBeNull();
  });
});
