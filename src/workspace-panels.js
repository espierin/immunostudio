export function installWorkspacePanels({
  doc = document,
  win = window,
  narrow = () => win.innerWidth <= 850,
} = {}) {
  const inspector = doc.querySelector(".inspector"),
    library = doc.querySelector(".library");
  inspector.id = "workspace-inspector";
  library.id = "workspace-library";
  if (win.innerWidth <= 600)
    doc.documentElement.classList.add("workspace-library-hidden");
  function sync() {
    inspector.inert = narrow() && !inspector.classList.contains("open");
    const toolbar = [...doc.querySelectorAll(".sheet-toolbar,.toolbar")].find(
      (el) => el.getClientRects().length,
    );
    if (toolbar)
      doc.documentElement.style.setProperty(
        "--workspace-tools-bottom",
        `${toolbar.getBoundingClientRect().bottom}px`,
      );
    for (const button of doc.querySelectorAll('[data-action="properties"]')) {
      button.setAttribute("aria-controls", inspector.id);
      button.setAttribute(
        "aria-expanded",
        String(!narrow() || inspector.classList.contains("open")),
      );
      button.setAttribute("aria-label", "Eigenschappen");
      button.title = "Eigenschappen openen of sluiten";
    }
    for (const button of doc.querySelectorAll(
      '[data-action="toggle-library"]',
    )) {
      button.setAttribute("aria-controls", library.id);
      button.setAttribute(
        "aria-expanded",
        String(
          !narrow() ||
            !doc.documentElement.classList.contains("workspace-library-hidden"),
        ),
      );
    }
  }
  function properties(open) {
    inspector.classList.toggle("open", open);
    sync();
  }
  function toggleLibrary() {
    doc.documentElement.classList.toggle("workspace-library-hidden");
    sync();
  }
  doc.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        narrow() &&
        inspector.classList.contains("open") &&
        !doc.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        properties(false);
        [...doc.querySelectorAll('[data-action="properties"]')]
          .find((b) => b.getClientRects().length)
          ?.focus();
      }
    },
    true,
  );
  win.addEventListener("resize", sync);
  if (win.ResizeObserver) {
    const observer = new win.ResizeObserver(sync);
    for (const toolbar of doc.querySelectorAll(".sheet-toolbar,.toolbar"))
      observer.observe(toolbar);
  }
  sync();
  return {
    properties,
    toggleProperties: () =>
      properties(!narrow() || !inspector.classList.contains("open")),
    toggleLibrary,
    sync,
  };
}
