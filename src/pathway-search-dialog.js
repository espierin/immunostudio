import { searchPathways } from "./pathway-search.js";
import { translate } from "./i18n.js";
import "./pathway-search.css";
const node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
export class PathwaySearchDialog {
  constructor() {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "pathway-search-dialog";
    this.dialog.setAttribute("aria-labelledby", "pathway-search-title");
    this.dialog.innerHTML = `<div class="pathway-search-heading"><div><small>Reactome · WikiPathways</small><h2 id="pathway-search-title">Pathways zoeken</h2></div><button type="button" data-pathway-close aria-label="Sluiten" title="Sluiten">×</button></div>
      <p>Zoek op een molecuul, pathway-ID of een deel van de pathwaynaam.</p>
      <form class="pathway-search-form"><label class="pathway-query">Zoekterm<input name="query" type="search" minlength="2" maxlength="160" required placeholder="Bijvoorbeeld AKT1, interleukin, WP127…" autocomplete="off"></label>
      <label>Zoeken op<select name="mode" aria-label="Zoeken op"><option value="auto">Automatisch</option><option value="name">Pathwaynaam</option><option value="molecule">Molecuulnaam</option><option value="id">Pathway-ID</option></select></label>
      <label>Database<select name="source" aria-label="Database"><option value="both">Beide databases</option><option value="Reactome">Reactome</option><option value="WikiPathways">WikiPathways</option></select></label>
      <label>Organisme<select name="species" aria-label="Organisme"><option value="Homo sapiens">Homo sapiens</option><option value="Mus musculus">Mus musculus</option><option value="">Alle organismen</option></select></label>
      <div class="pathway-search-buttons"><button class="primary" type="submit">Zoeken</button><button type="button" data-pathway-cancel hidden>Annuleren</button></div></form>
      <div class="pathway-search-status" role="status" aria-live="polite"></div><div class="pathway-search-results"></div><div class="pathway-search-more"></div>
      <footer>Zoekresultaten openen bij de bron. Het automatisch opbouwen van een volledig pathway is nog niet beschikbaar.</footer>`;
    document.body.append(this.dialog);
    this.form = this.dialog.querySelector("form");
    this.status = this.dialog.querySelector("[role=status]");
    this.results = this.dialog.querySelector(".pathway-search-results");
    this.more = this.dialog.querySelector(".pathway-search-more");
    this.cancel = this.dialog.querySelector("[data-pathway-cancel]");
    this.submit = this.form.querySelector("[type=submit]");
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.search();
    });
    this.dialog.querySelector("[data-pathway-close]").onclick = () =>
      this.dialog.close();
    this.cancel.onclick = () => {
      this.abort();
      this.status.textContent = translate("Zoekopdracht geannuleerd.");
    };
    this.dialog.addEventListener("close", () => {
      this.abort();
      if (this.previous?.isConnected) this.previous.focus();
    });
  }
  show() {
    if (this.dialog.open) return;
    this.previous = document.activeElement;
    this.dialog.showModal();
    this.form.elements.query.focus();
  }
  abort() {
    this.request = (this.request || 0) + 1;
    this.controller?.abort();
    this.submit.disabled = false;
    this.cancel.hidden = true;
    this.results.removeAttribute("aria-busy");
  }
  async search() {
    this.abort();
    const request = this.request;
    this.controller = new AbortController();
    const options = Object.fromEntries(new FormData(this.form));
    this.results.replaceChildren();
    this.more.replaceChildren();
    this.status.textContent = translate("Databases doorzoeken…");
    this.results.setAttribute("aria-busy", "true");
    this.submit.disabled = true;
    this.cancel.hidden = false;
    try {
      const data = await searchPathways(options, {
        signal: this.controller.signal,
      });
      if (request !== this.request || !this.dialog.open) return;
      this.status.replaceChildren();
      const count = node("p");
      count.append(
        node("strong", String(data.results.length)),
        document.createTextNode(" "),
        node("span", "pathways gevonden"),
      );
      this.status.append(count);
      for (const source of data.sources) {
        const p = node(
          "p",
          undefined,
          source.error ? "pathway-source-error" : "pathway-source-summary",
        );
        p.append(
          node("b", source.source + ": "),
          node(
            "span",
            source.error
              ? source.error === "timeout"
                ? "Tijdslimiet bereikt. Probeer opnieuw of kies één database."
                : "Niet bereikbaar. Probeer opnieuw of kies de andere database."
              : source.limited
                ? source.source === "WikiPathways"
                  ? "Eerste 50 pathways getoond. Verfijn de zoekterm voor een kleinere selectie."
                  : "Beperkte selectie. Maximaal 50 pathways; Reactome onderzoekt maximaal 8 molecuultreffers. Verfijn de zoekterm."
                : "Zoekopdracht voltooid.",
          ),
        );
        this.status.append(p);
      }
      if (!data.results.length)
        this.results.append(
          node(
            "p",
            data.sources.every((s) => s.error)
              ? "Geen resultaten beschikbaar. Controleer je internetverbinding en probeer opnieuw."
              : "Geen pathways gevonden. Probeer een andere term of kies Alle organismen.",
          ),
        );
      this.rows = data.results;
      this.shown = 0;
      this.appendResults();
    } catch (error) {
      if (request === this.request && this.dialog.open)
        this.status.textContent = translate(error.message);
    } finally {
      if (request === this.request) {
        this.submit.disabled = false;
        this.cancel.hidden = true;
        this.results.removeAttribute("aria-busy");
      }
    }
  }
  appendResults() {
    const end = Math.min(this.shown + 20, this.rows.length);
    for (const row of this.rows.slice(this.shown, end)) {
      const article = node("article", undefined, "pathway-result");
      const content = node("div");
      // All database content is plain text and excluded from interface translation.
      const source = node(
        "small",
        `${row.source} · ${row.id} · ${row.species}`,
      );
      source.dataset.noTranslate = "";
      const heading = node("h3", row.name);
      heading.dataset.noTranslate = "";
      content.append(source, heading);
      if (row.matched.length) {
        const match = node("p", undefined, "pathway-matched");
        const names = node("span", row.matched.join(", "));
        names.dataset.noTranslate = "";
        match.append(node("b", "Molecuultreffers: "), names);
        content.append(match);
      }
      if (row.description) {
        const details = node("details"),
          summary = node("summary", "Beschrijving"),
          description = node("p", row.description);
        description.dataset.noTranslate = "";
        details.append(summary, description);
        content.append(details);
      }
      const actions = node("div", undefined, "pathway-result-actions");
      const link = node("a", "Open bij de bron ↗");
      link.href = row.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const copy = node("button", "ID kopiëren");
      copy.type = "button";
      copy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(row.id);
          copy.textContent = translate("Gekopieerd");
        } catch {
          copy.textContent = row.id;
          copy.dataset.noTranslate = "";
        }
      };
      actions.append(link, copy);
      article.append(content, actions);
      this.results.append(article);
    }
    this.shown = end;
    this.more.replaceChildren();
    if (end < this.rows.length) {
      const button = node("button", "Meer resultaten tonen");
      button.type = "button";
      button.onclick = () => this.appendResults();
      this.more.append(button);
    }
  }
}
