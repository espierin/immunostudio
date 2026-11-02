export class SelectionBar {
  constructor(drawing, host) {
    this.drawing = drawing;
    this.element = document.createElement("div");
    this.element.className = "selection-bar";
    this.element.setAttribute("aria-label", "Snelle selectiebewerkingen");
    this.element.innerHTML =
      '<span data-selection-count data-no-translate></span><button data-sheet-action="duplicate" title="Selectie dupliceren">Dupliceren</button><button data-sheet-action="mirror-x" title="Horizontaal spiegelen">↔</button><button data-sheet-action="raise" title="Een laag naar voren">↑</button><button data-sheet-action="toggle-lock" title="Vergrendeling wisselen">Vergrendelen</button><button data-sheet-action="group" data-multiple title="Selectie groeperen">Groeperen</button><button data-sheet-action="align-left" data-multiple title="Linkerranden uitlijnen">Links</button><button data-sheet-action="align-middle" data-multiple title="Verticaal centreren">Midden Y</button><button data-sheet-action="floating-tools" title="Sculpting en modifiers">Sculpt</button>';
    host.append(this.element);
  }
  update() {
    const items = this.drawing.selectedItems();
    this.element.hidden = !items.length;
    this.element.querySelector("[data-selection-count]").textContent = String(
      items.length,
    );
    for (const button of this.element.querySelectorAll("button")) {
      button.hidden = button.hasAttribute("data-multiple") && items.length < 2;
      button.disabled =
        !["toggle-lock", "floating-tools"].includes(
          button.dataset.sheetAction,
        ) && items.every((i) => i.locked);
    }
    const lock = this.element.querySelector(
      '[data-sheet-action="toggle-lock"]',
    );
    lock.textContent =
      items.length && items.every((i) => i.locked)
        ? "Ontgrendelen"
        : "Vergrendelen";
  }
}
