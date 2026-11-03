import { pathwayTopics, topicSearch, keggSearchURL } from "./pathway-topics.js";
import { searchPathways } from "./pathway-search.js";
import { loadPathway, importPathwayFile } from "./pathway-import.js";
import { translate } from "./i18n.js";
import "./pathway-search.css";
const node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
export class PathwaySearchDialog {
  constructor(onImport) {
    this.onImport = onImport;
    this.dialog = document.createElement("dialog");
    this.dialog.className = "pathway-search-dialog";
    this.dialog.setAttribute("aria-labelledby", "pathway-search-title");
    this.dialog.innerHTML = `<div class="pathway-search-heading"><div><small>Reactome · WikiPathways · Pathway Commons</small><h2 id="pathway-search-title">Pathways zoeken</h2></div><button type="button" data-pathway-close aria-label="Sluiten" title="Sluiten">×</button></div>
      <p>Zoek op een molecuul, pathway-ID of een deel van de pathwaynaam.</p>
      <details class="pathway-topics"><summary>Immunologie en celbiologie</summary><p>Gecontroleerde humane referentiepathways. Een thema stelt bron, ID en organisme in.</p><div class="pathway-topic-groups"></div></details>
      <form class="pathway-search-form"><label class="pathway-query">Zoekterm<input name="query" type="search" minlength="2" maxlength="160" required placeholder="Bijvoorbeeld AKT1, interleukin, WP127…" autocomplete="off"></label>
      <label>Zoeken op<select name="mode" aria-label="Zoeken op"><option value="auto">Automatisch</option><option value="name">Pathwaynaam</option><option value="molecule">Molecuulnaam</option><option value="id">Pathway-ID</option></select></label>
      <label>Database<select name="source" aria-label="Database"><option value="all">Alle gekoppelde databases</option><option value="Reactome">Reactome</option><option value="WikiPathways">WikiPathways</option><option value="Pathway Commons">Pathway Commons</option></select></label>
      <label>Organisme<select name="species" aria-label="Organisme"><option value="Homo sapiens">Homo sapiens</option><option value="Mus musculus">Mus musculus</option><option value="">Alle organismen</option></select></label>
      <div class="pathway-search-buttons"><button class="primary" type="submit">Zoeken</button><button type="button" data-pathway-cancel hidden>Annuleren</button></div></form>
      <div class="pathway-kegg"><a class="pathway-kegg-link" target="_blank" rel="noopener noreferrer">Zoek verder op de KEGG-website ↗</a><small>Externe ingang: KEGG-resultaten verschijnen op de KEGG-website. Voor moleculen is daar een aanvullende gen-/compoundzoekactie nodig.</small></div>
      <div class="pathway-file-import"><button type="button" data-pathway-file>Pathwaybestand importeren…</button><small>GPML · KGML (KEGG) · Reactome-diagram-JSON</small><input type="file" accept=".gpml,.xml,.kgml,.json" hidden></div>
      <div class="pathway-search-status" role="status" aria-live="polite"></div><div class="pathway-search-results"></div><div class="pathway-search-more"></div>
      <footer>Kies Op tekenblad plaatsen voor losse bewerkbare elementen. Bronindelingen worden overgenomen waar beschikbaar; anders wordt de indeling automatisch gemaakt.</footer>`;
    document.body.append(this.dialog);
    this.form = this.dialog.querySelector("form");
    const topicGroups = this.dialog.querySelector(".pathway-topic-groups");
    for (const group of [...new Set(pathwayTopics.map((t) => t.group))]) {
      const section = node("section"),
        heading = node("h3", group),
        buttons = node("div");
      for (const topic of pathwayTopics.filter((t) => t.group === group)) {
        const button = node("button", topic.label);
        button.type = "button";
        button.title = topic.name + " · " + topic.id;
        button.onclick = () => {
          for (const [key, value] of Object.entries(topicSearch(topic.key)))
            this.form.elements[key].value = value;
          this.updateKegg();
          this.dialog.querySelector(".pathway-topics").open = false;
          this.form.elements.query.focus();
          this.search();
        };
        buttons.append(button);
      }
      section.append(heading, buttons);
      topicGroups.append(section);
    }
    this.form.addEventListener("input", () => this.updateKegg());
    this.form.addEventListener("change", () => this.updateKegg());
    this.updateKegg();
    this.status = this.dialog.querySelector("[role=status]");
    this.results = this.dialog.querySelector(".pathway-search-results");
    this.more = this.dialog.querySelector(".pathway-search-more");
    this.cancel = this.dialog.querySelector("[data-pathway-cancel]");
    this.submit = this.form.querySelector("[type=submit]");
    const file = this.dialog.querySelector("input[type=file]");
    this.dialog.querySelector("[data-pathway-file]").onclick = () =>
      file.click();
    file.onchange = async () => {
      const selected = file.files[0];
      if (!selected) return;
      this.abort();
      const generation = this.request;
      try {
        if (selected.size > 12000000)
          throw Error(
            "Dit pathway is te groot. Kies een specifieker deelpathway.",
          );
        const result = importPathwayFile(await selected.text(), selected.name);
        if (generation !== this.request || !this.dialog.open) return;
        await this.onImport(result);
        this.dialog.close();
      } catch (error) {
        if (generation === this.request && this.dialog.open)
          this.status.textContent = translate(error.message);
      } finally {
        file.value = "";
      }
    };
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
  updateKegg() {
    this.dialog.querySelector(".pathway-kegg-link").href = keggSearchURL(
      this.form.elements.query.value,
      this.form.elements.species.value,
    );
  }
  show({ topics = false, kegg = false } = {}) {
    if (this.dialog.open) return;
    this.previous = document.activeElement;
    this.dialog.querySelector(".pathway-topics").open = topics;
    this.dialog.showModal();
    if (kegg) this.dialog.querySelector(".pathway-kegg-link").focus();
    else this.form.elements.query.focus();
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
                  : "Beperkte selectie. Maximaal 50 pathways en 8 molecuultreffers per bron. Verfijn de zoekterm."
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
  async importRow(row) {
    if (this.importing) return;
    this.abort();
    this.importing = true;
    const request = this.request;
    this.controller = new AbortController();
    this.submit.disabled = true;
    this.cancel.hidden = false;
    this.status.textContent = translate(
      "Pathway ophalen en omzetten naar bewerkbare elementen…",
    );
    try {
      const result = await loadPathway(row, { signal: this.controller.signal });
      if (request !== this.request || !this.dialog.open) return;
      await this.onImport(result);
      this.dialog.close();
    } catch (error) {
      if (request === this.request && this.dialog.open)
        this.status.textContent = translate(
          error.name === "AbortError"
            ? "Pathway ophalen geannuleerd of tijdslimiet bereikt."
            : error.message,
        );
    } finally {
      this.importing = false;
      if (request === this.request) {
        this.submit.disabled = false;
        this.cancel.hidden = true;
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
      if (this.onImport) {
        const select = node("button", row.name, "pathway-result-select");
        select.type = "button";
        select.title = translate("Op tekenblad plaatsen");
        select.onclick = () => this.importRow(row);
        heading.replaceChildren(select);
      }
      content.append(source, heading);
      if (row.providers?.length) {
        const providers = node("small", row.providers.join(" · "));
        providers.dataset.noTranslate = "";
        content.append(providers);
      }
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
      if (this.onImport) {
        const place = node("button", "Op tekenblad plaatsen", "primary");
        place.type = "button";
        place.onclick = () => this.importRow(row);
        actions.append(place);
      }
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
