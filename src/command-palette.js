import { translate } from "./i18n.js";
const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function searchCommands(commands, query) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return commands.filter((c) =>
    words.every((w) =>
      norm(
        c.label + " " + translate(c.label) + " " + (c.keywords || ""),
      ).includes(w),
    ),
  );
}
export class CommandPalette {
  constructor(getCommands) {
    this.getCommands = getCommands;
    this.dialog = document.createElement("dialog");
    this.dialog.className = "command-palette";
    this.dialog.innerHTML =
      '<div class="command-heading"><h2>Opdrachten zoeken</h2><button data-command-close aria-label="Sluiten">×</button></div><input type="search" aria-label="Zoek een opdracht" placeholder="Zoek een gereedschap of bewerking…"><div class="command-results" data-no-translate></div><p>↑ ↓ kiezen · Enter uitvoeren · Esc sluiten</p>';
    document.body.append(this.dialog);
    this.input = this.dialog.querySelector("input");
    this.input.addEventListener("input", () => {
      this.index = 0;
      this.render();
    });
    this.dialog
      .querySelector("[data-command-close]")
      .addEventListener("click", () => this.dialog.close());
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog) this.dialog.close();
    });
    this.dialog.addEventListener(
      "close",
      () => this.previous?.isConnected && this.previous.focus(),
    );
    document.addEventListener(
      "keydown",
      (e) => {
        if (document.documentElement.dataset.home === "true") return;
        if (
          e.key === "F3" ||
          ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.show();
          return;
        }
        if (!this.dialog.open) return;
        if (["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (e.key === "Enter") {
            this.run(this.matches[this.index]);
            return;
          }
          const direction = e.key === "ArrowDown" ? 1 : -1;
          this.index = Math.max(
            0,
            Math.min(this.matches.length - 1, this.index + direction),
          );
          this.render();
        }
      },
      true,
    );
  }
  show() {
    this.previous = document.activeElement;
    this.input.value = "";
    this.index = 0;
    this.dialog.showModal();
    this.render();
    this.input.focus();
  }
  run(command) {
    if (!command || command.disabled) return;
    this.dialog.close();
    command.run();
  }
  render() {
    this.matches = searchCommands(this.getCommands(), this.input.value);
    const root = this.dialog.querySelector(".command-results");
    root.replaceChildren();
    if (!this.matches.length) {
      const p = document.createElement("p");
      p.textContent = translate("Geen resultaten.");
      root.append(p);
    }
    this.matches.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = i === this.index ? "command-current" : "";
      b.disabled = !!c.disabled;
      b.textContent = translate(c.label);
      const key = document.createElement("kbd");
      key.textContent = c.shortcut || "";
      b.append(key);
      b.addEventListener("click", () => this.run(c));
      root.append(b);
    });
    root.children[this.index]?.scrollIntoView({ block: "nearest" });
  }
}
