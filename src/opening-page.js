export const hasArtwork = (p) => !!(p.sheet?.items?.length || p.items?.length);
export class OpeningPage {
  constructor({ resume, create, open }) {
    this.resume = resume;
    this.create = create;
    this.open = open;
    this.element = document.createElement("section");
    this.element.className = "opening-page";
    this.element.setAttribute("aria-label", "Startpagina");
    this.element.innerHTML = `<div class="opening-top"><a class="opening-brand" href="#"><img src="./immunostudio-icon.svg" width="44" height="44" alt=""><strong>ImmunoStudio<span>SCIENTIFIC ILLUSTRATION</span></strong></a><div><button data-home="language">EN / NL</button><a href="./manual/en.html" target="_blank" rel="noopener">Handleiding</a><button data-home="resume">Open editor ↗</button></div></div><div class="opening-body"><div class="opening-hero"><div><p class="opening-eyebrow">VAN MOLECUUL TOT VERHAAL</p><h1>Wetenschap helder<br>in beeld.</h1><p class="opening-lead">Teken cellen, vorm membranen en bouw je immunologische verhaal. Van bewerkbare vectoren tot ruimtelijke modellen.</p><div class="opening-actions"><button class="opening-primary" data-home="resume">Verder met je project ↗</button><button data-home="open">Project openen</button></div><p class="opening-local">Je werk wordt lokaal op dit apparaat bewaard.</p></div><div class="opening-art" aria-hidden="true"></div></div><div class="opening-current"><div><small>JE WERKRUIMTE</small><strong data-current-name data-no-translate></strong><p><b data-current-count>0</b> <span>elementen lokaal bewaard</span></p></div><button data-home="resume">Open werkruimte →</button></div><div class="opening-section-title"><h2>Begin met een idee</h2><span>Volledig bewerkbaar in 2D</span></div><div class="opening-starts"><button data-home="blank"><span class="opening-card-icon">＋</span><strong>Leeg tekenblad</strong><span>Alle ruimte voor je eigen figuur.</span></button></div><div class="opening-bottom"><span>2D &amp; 3D · SVG · PNG · Office-export lokaal</span><span>UMC Utrecht · ImmunoStudio 0.2</span></div></div>`;
    document.body.append(this.element);
    this.element.addEventListener("click", (e) => {
      const kind = e.target.closest("[data-home]")?.dataset.home;
      if (!kind) return;
      if (kind === "language") {
        const input = document.querySelector("#interface-language");
        input.value = input.value === "en" ? "nl" : "en";
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      if (kind === "open") {
        this.open();
        return;
      }
      this.hide();
      if (kind === "resume") this.resume();
      else this.create(kind);
    });
    this.element
      .querySelector(".opening-brand")
      .addEventListener("click", (e) => e.preventDefault());
    this.show();
  }
  update(project) {
    this.element.querySelector("[data-current-name]").textContent =
      project.name;
    this.element.querySelector("[data-current-count]").textContent =
      (project.sheet?.items?.length || 0) + (project.items?.length || 0);
  }
  show() {
    this.element.hidden = false;
    document.documentElement.dataset.home = "true";
    document.querySelector("#app").inert = true;
    this.element.querySelector('[data-home="resume"]').focus();
  }
  hide() {
    this.element.hidden = true;
    delete document.documentElement.dataset.home;
    document.querySelector("#app").inert = false;
  }
}
