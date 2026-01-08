import { ui } from "./ui.js";
import { loadFromServer, saveToServer, handleFileChange, downloadJsonFile } from "./api.js";
import { updateTableSectionsAndRender, renderTable, bindTableEvents } from "./table.js";
import { isRawModeActive, buildRawMatches, bindRawFinderEvents } from "./rawFinder.js";
import { initTheme } from "./theme.js";

bindTableEvents();
bindRawFinderEvents();
initTheme();

ui.loadBtn?.addEventListener("click", async () => {
  await loadFromServer();
  updateTableSectionsAndRender();
});

ui.saveBtn?.addEventListener("click", async () => {
  await saveToServer();
});

ui.fileInput?.addEventListener("change", (e) => {
  handleFileChange(e);
  // FileReader is async
  setTimeout(() => updateTableSectionsAndRender(), 0);
});

ui.downloadBtn?.addEventListener("click", downloadJsonFile);

// Shared filter: table OR raw depending on current view
ui.tableFilterInput?.addEventListener("input", () => {
  if (isRawModeActive()) buildRawMatches();
  else renderTable();
});

// View switch (table/raw)
if (ui.tableViewWrapper && ui.rawViewWrapper && ui.viewToggleButtons?.length) {
  ui.viewToggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      ui.viewToggleButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const view = btn.dataset.view;
      if (view === "table") {
        ui.tableViewWrapper.classList.remove("d-none");
        ui.rawViewWrapper.classList.add("d-none");
      } else {
        ui.rawViewWrapper.classList.remove("d-none");
        ui.tableViewWrapper.classList.add("d-none");
      }
    });
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadFromServer();
  updateTableSectionsAndRender();
});
