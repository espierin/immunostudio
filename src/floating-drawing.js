import { lineAppearanceControls } from "./curve-appearance2d.js";
export class FloatingDrawingTools {
  constructor(drawing) {
    this.drawing = drawing;
    this.key =
      "immunostudio-floating-tools" +
      (new URLSearchParams(location.search).has("qa") ? "-qa" : "");
    this.state = {
      x: 300,
      y: 170,
      minimized: true,
      wide: false,
      hidden: false,
    };
    try {
      Object.assign(
        this.state,
        JSON.parse(localStorage.getItem(this.key) || "{}"),
      );
    } catch {}
    this.element = document.createElement("section");
    this.element.className = "floating-drawing";
    this.element.setAttribute("aria-label", "Sculpting en modifiers");
    this.element.innerHTML = `<div class="floating-grip" tabindex="0" title="Sleep deze balk om het menu te verplaatsen. Pijltjestoetsen verplaatsen het menu."><strong>Sculpting en modifiers</strong><button data-floating="minimize" title="Minimaliseren of openen" aria-expanded="false">▾</button><button data-floating="expand" title="Breder of smaller maken">⤢</button><button data-floating="close" title="Zwevend menu sluiten">×</button></div><div class="floating-content"><p class="floating-selection" data-no-translate></p><div class="drawing-grid"><button data-sheet-tool="select">Selecteren</button><button data-sheet-tool="nodes">Punten bewerken</button><button data-sheet-tool="sculpt">Sculpten</button><button data-sheet-action="contour-reset">Contour herstellen</button></div><div class="floating-line-appearance"></div><details open><summary>Sculptpenseel</summary><label>Werking<select data-sculpt-option="mode"><option value="drag">Duwen en trekken</option><option value="inflate">Opbollen</option><option value="deflate">Induwen</option><option value="smooth">Lokaal gladmaken</option></select></label><label>Radius (px)<input type="number" min="10" max="400" step="5" value="100" data-sculpt-option="radius"></label><label>Sterkte (%)<input type="range" min="5" max="100" value="70" data-sculpt-option="strength"></label><label>Binnenstructuren meevormen<input type="checkbox" data-sculpt-option="interior" checked></label><p class="muted">Selecteer een cel of weefsel en sleep bij de rand. Kies eerst een onderdeel met Punten bewerken voor een specifieke contour. Shift keert duwen en opbollen om.</p></details><details open><summary>Contourmodifiers</summary><label>Afstand / tolerantie (px)<input type="number" min=".5" max="100" step=".5" value="8" data-sculpt-option="amount"></label><div class="drawing-grid"><button data-sheet-action="contour-smooth">Gladmaken</button><button data-sheet-action="contour-simplify">Vereenvoudigen</button><button data-sheet-action="contour-inset">Krimpen</button><button data-sheet-action="contour-outset">Vergroten</button><button data-sheet-action="mirror-x">Horizontaal spiegelen</button><button data-sheet-action="mirror-y">Verticaal spiegelen</button></div><p class="muted">Contourmodifiers volgen de gekozen membraanrand. Spiegelen werkt op het hele object. Gebruik Ongedaan maken om een stap terug te gaan.</p></details><details open><summary>Membraanankers</summary><p class="floating-target" data-no-translate></p><div class="drawing-grid"><button data-sheet-action="anchor-target">Gebruik als membraan</button><button data-sheet-action="anchor-attach">Koppel selectie</button><button data-sheet-action="anchor-detach">Losmaken van membraan</button><button data-sheet-action="anchor-flip">Andere membraanzijde</button></div><button class="wide" data-sheet-action="anchor-mark-embedded">Onderdeel als membraanmolecuul</button><label>Positie langs rand (%)<input type="number" data-anchor-field="u" min="0" max="100" step=".5"></label><label>Afstand tot rand (px)<input type="number" data-anchor-field="offset" min="-300" max="300" step="1"></label><label>Ankerhoogte in molecuul (%)<input type="number" data-anchor-field="pivotY" min="0" max="100" step="1"></label><p class="muted">Kies eerst de cel of het membraan als doel, selecteer daarna de losse moleculen en koppel ze. Gekoppelde moleculen volgen de rand en blijven haaks staan. Ingebouwde herkenbare receptorgroepen bewegen automatisch mee bij sculpten.</p></details></div>`;
    document.body.append(this.element);
    this.bind();
    this.place();
    this.update();
  }
  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.state));
    } catch {}
  }
  place() {
    const s = this.state;
    s.x = Math.max(
      0,
      Math.min(innerWidth - (s.minimized ? 270 : s.wide ? 460 : 300), s.x),
    );
    s.y = Math.max(78, Math.min(innerHeight - (s.minimized ? 55 : 260), s.y));
    Object.assign(this.element.style, { left: s.x + "px", top: s.y + "px" });
    this.element.style.setProperty("--floating-top", s.y + "px");
    this.element.hidden = s.hidden;
    this.element.classList.toggle("minimized", s.minimized);
    this.element.classList.toggle("wide", s.wide);
    const b = this.element.querySelector('[data-floating="minimize"]');
    b.textContent = s.minimized ? "▾" : "−";
    b.setAttribute("aria-expanded", String(!s.minimized));
  }
  show() {
    this.state.hidden = false;
    this.state.minimized = false;
    this.place();
    this.save();
    this.update();
  }
  update() {
    const d = this.drawing,
      selected = d.selectedItems(),
      target = d.doc.items.find((i) => i.id === d.anchorTargetId),
      a = selected.length === 1 ? selected[0].anchor2d : null;
    this.element.querySelector(".floating-selection").textContent =
      selected.map((i) => i.name).join(", ") || "—";
    this.element.querySelector(".floating-target").textContent =
      target?.name || "—";
    const appearance = this.element.querySelector(".floating-line-appearance");
    if (!appearance.contains(document.activeElement))
      appearance.innerHTML =
        selected.length === 1 ? lineAppearanceControls(selected[0]) : "";
    for (const input of this.element.querySelectorAll("[data-anchor-field]")) {
      const key = input.dataset.anchorField;
      input.disabled = !a;
      if (document.activeElement !== input)
        input.value = a
          ? key === "offset"
            ? a[key] || 0
            : Math.round((a[key] ?? 0.8) * 1000) / 10
          : "";
    }
  }
  bind() {
    this.element.addEventListener("click", (e) => {
      const action = e.target.closest("[data-floating]")?.dataset.floating;
      if (!action) return;
      if (action === "minimize") this.state.minimized = !this.state.minimized;
      if (action === "expand") {
        this.state.wide = !this.state.wide;
        this.state.minimized = false;
      }
      if (action === "close") this.state.hidden = true;
      this.place();
      this.save();
    });
    this.element.addEventListener("input", (e) => {
      const key = e.target.dataset.sculptOption;
      if (!key) return;
      if (key === "interior") {
        this.drawing.sculptOptions.interior = e.target.checked;
        return;
      }
      this.drawing.sculptOptions[key] =
        key === "mode"
          ? e.target.value
          : Math.max(
              key === "strength" ? 5 : key === "radius" ? 10 : 0.5,
              Math.min(key === "radius" ? 400 : 100, +e.target.value || 1),
            ) / (key === "strength" ? 100 : 1);
    });
    this.element.addEventListener("change", (e) => {
      const key = e.target.dataset.anchorField;
      if (!key) return;
      const value = +e.target.value;
      if (!Number.isFinite(value)) return;
      this.drawing.beforeChange();
      for (const i of this.drawing.selectedItems())
        if (i.anchor2d)
          i.anchor2d[key] =
            key === "offset"
              ? Math.max(-300, Math.min(300, value))
              : Math.max(0, Math.min(100, value)) / 100;
      this.drawing.notify();
    });
    const grip = this.element.querySelector(".floating-grip");
    let drag;
    grip.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      drag = {
        x: e.clientX,
        y: e.clientY,
        left: this.state.x,
        top: this.state.y,
      };
    });
    grip.addEventListener("pointermove", (e) => {
      if (!drag) return;
      this.state.x = drag.left + e.clientX - drag.x;
      this.state.y = drag.top + e.clientY - drag.y;
      this.place();
    });
    grip.addEventListener("pointerup", () => {
      drag = null;
      this.save();
    });
    grip.addEventListener("keydown", (e) => {
      if (!e.key.startsWith("Arrow") || e.target !== grip) return;
      e.preventDefault();
      e.stopPropagation();
      const n = e.shiftKey ? 20 : 5;
      this.state.x +=
        e.key === "ArrowRight" ? n : e.key === "ArrowLeft" ? -n : 0;
      this.state.y += e.key === "ArrowDown" ? n : e.key === "ArrowUp" ? -n : 0;
      this.place();
      this.save();
    });
    window.addEventListener("resize", () => this.place());
  }
}
