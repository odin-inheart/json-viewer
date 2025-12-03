const editor = document.getElementById("json-editor");
const loadBtn = document.getElementById("load-from-server");
const saveBtn = document.getElementById("save-to-server");
const fileInput = document.getElementById("json-file-input");
const message = document.getElementById("message");

// Elements for the table view
const refreshTableBtn = document.getElementById("refresh-table");
const tableSectionSelect = document.getElementById("table-section-select");
const tableFilterInput = document.getElementById("table-filter-input");
const tableContainer = document.getElementById("table-container");
const tableKeySelect = document.getElementById("table-key-select");

// Row editing controls (Option 2)
const applyRowEditBtn = document.getElementById("apply-row-edit");
const cancelRowEditBtn = document.getElementById("cancel-row-edit");

// In-memory state
// In-memory state
let originalJson = null;       // JSON as loaded from server/file (reference)
let workingJson = null;        // JSON that user edits (we send back to server)
let tableSections = [];        // sections for the <select> (root, Meshes, etc.)
let currentSection = null;     // currently selected section

let tableRows = [];            // rows to display in table
let tableColumns = [];         // columns (keys)
let rowMapping = [];           // mapping row -> where it lives in workingJson



// Display status messages to the user
function setMessage(text, type = "info") {
  message.textContent = text;

  if (type === "error") {
    message.className = "small text-danger";
  } else if (type === "success") {
    message.className = "small text-success";
  } else {
    message.className = "small text-muted";
  }
}


// ----------------------
//  Load JSON from server
// ----------------------

async function loadFromServer() {
  try {
    setMessage("Loading JSON from server...");

    const response = await fetch("/api/data");

    if (!response.ok) {
      throw new Error("Unexpected server response");
    }

    const data = await response.json();

    // Store JSON
    originalJson = data;
    // Deep copy for working version
    workingJson = JSON.parse(JSON.stringify(data));

    editor.value = JSON.stringify(workingJson, null, 2);

    setMessage("JSON loaded from server.", "success");

    // Rebuild sections & table from workingJson
    updateTableSectionsAndRender();

  } catch (error) {
    console.error("Error while loading JSON from server:", error);
    setMessage("Failed to load JSON from server.", "error");
  }
}

// ----------------------
//  Save JSON to server
// ----------------------

async function saveToServer() {
  // Do not allow saving while only a single row is being edited
  if (rowEditMode) {
    setMessage(
      "You are currently editing a single entry. Apply or cancel the row edit before saving the full JSON.",
      "error"
    );
    return;
  }

  try {
    setMessage("Validating JSON...");

    let parsed;
    try {
      parsed = JSON.parse(editor.value);
    } catch (error) {
      setMessage(
        "Invalid JSON: please check commas, quotes and structure.",
        "error"
      );
      return;
    }

    setMessage("Sending data to server...");

    const response = await fetch("/api/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed),
    });

    if (!response.ok) {
      throw new Error("Unexpected server error while saving");
    }

    const result = await response.json();

    if (result.success) {
      lastParsedJson = parsed;
      setMessage("JSON successfully saved on the server.", "success");
    } else {
      setMessage("The server returned an error while saving JSON.", "error");
    }
  } catch (error) {
    console.error("Error while saving JSON:", error);
    setMessage("Failed to save JSON on the server.", "error");
  }
}

// -----------------------------
//  Load JSON from a local file
// -----------------------------

function handleFileChange(event) {
  const file = event.target.files[0];
  if (!file) {
    setMessage("No file selected.", "info");
    return;
  }

  if (!file.name.endsWith(".json")) {
    setMessage("Please select a .json file.", "error");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const content = reader.result;
      const parsed = JSON.parse(content);

      originalJson = parsed;
      workingJson = JSON.parse(JSON.stringify(parsed));

      editor.value = JSON.stringify(workingJson, null, 2);

      setMessage(
        `JSON loaded from file "${file.name}". You can edit it and optionally save it to the server.`,
        "success"
      );

      // Rebuild sections & table
      updateTableSectionsAndRender();

    } catch (error) {
      console.error("Error while parsing JSON file:", error);
      setMessage("The selected file does not contain valid JSON.", "error");
    }
  };

  reader.onerror = () => {
    console.error("File read error:", reader.error);
    setMessage("An error occurred while reading the file.", "error");
  };

  reader.readAsText(file, "utf-8");
}

// -----------------------------
// Table view (JSON analysis)
// -----------------------------

// -----------------------------
// Table view (projection + mapping)
// -----------------------------

// 1) Compute table sections (root, top-level arrays/objects)
function computeTableSections(rootJson) {
  const sections = [];
  if (!rootJson) return sections;

  // Case 1: root is an array of objects -> "__root__"
  if (Array.isArray(rootJson) && rootJson.length > 0 && typeof rootJson[0] === "object") {
    sections.push({
      id: "__root__",
      label: `Root (array with ${rootJson.length} items)`,
      path: [],         // root path
      json: rootJson,   // reference to that array in workingJson
    });
  }

  // Case 2: root is an object -> inspect properties
  if (rootJson && typeof rootJson === "object" && !Array.isArray(rootJson)) {
    for (const [key, value] of Object.entries(rootJson)) {
      // 2.a) property = array of objects
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
        sections.push({
          id: key,
          label: `${key} (array with ${value.length} items)`,
          path: [key],
          json: value,
        });
      }
      // 2.b) property = object with object values (e.g. Meshes)
      else if (value && typeof value === "object" && !Array.isArray(value)) {
        const hasObjectValues = Object.values(value).some(
          (v) => v && typeof v === "object"
        );
        if (hasObjectValues) {
          const count = Object.keys(value).length;
          sections.push({
            id: key,
            label: `${key} (object with ${count} entries)`,
            path: [key],
            json: value,
          });
        }
      }
    }
  }

  return sections;
}

// 2) Build table projection + mapping from a given section
function buildTableProjection(json, sectionPath = []) {
  const rows = [];
  const mapping = [];

  // Case A: array of objects
  if (Array.isArray(json)) {
    json.forEach((item, index) => {
      if (item && typeof item === "object") {
        rows.push(item);
        mapping.push({
          parentPath: [...sectionPath],
          index: index,
          key: null,
        });
      }
    });
    return { rows, mapping };
  }

  // Case B: object whose values are objects (e.g. Meshes)
  if (json && typeof json === "object") {
    Object.entries(json).forEach(([key, value]) => {
      if (value && typeof value === "object") {
        rows.push({
          __key: key,       // colonne d’affichage
          ...value          // les champs d’origine
        });
        mapping.push({
          parentPath: [...sectionPath],
          index: null,
          key: key,
        });
      }
    });
    return { rows, mapping };
  }

  // Not a supported structure for table view
  return { rows: [], mapping: [] };
}

// 3) Rebuild sections and render the current selection
function updateTableSectionsAndRender() {
  if (!workingJson) {
    tableSections = [];
    currentSection = null;
    tableContainer.innerHTML =
      '<p class="text-muted mb-0">No data available.</p>';
    return;
  }

  tableSections = computeTableSections(workingJson);
  fillTableSectionSelect();
  renderCurrentSection();
}

// 4) Fill <select> with sections
function fillTableSectionSelect() {
  const previousSelection = tableSectionSelect.value;

  tableSectionSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = tableSections.length
    ? "(Select a section)"
    : "(No table view available)";
  tableSectionSelect.appendChild(defaultOption);

  tableSections.forEach((section) => {
    const opt = document.createElement("option");
    opt.value = section.id;
    opt.textContent = section.label;
    tableSectionSelect.appendChild(opt);
  });

  // Restore previous selection if possible
  if (previousSelection && tableSections.some((s) => s.id === previousSelection)) {
    tableSectionSelect.value = previousSelection;
    currentSection = tableSections.find((s) => s.id === previousSelection) || null;
  } else if (tableSections.length > 0) {
    tableSectionSelect.value = tableSections[0].id;
    currentSection = tableSections[0];
  } else {
    currentSection = null;
  }
}

// 5) Render the currently selected section as a table
function renderCurrentSection() {
  const selectedId = tableSectionSelect.value;

  if (!selectedId) {
    tableContainer.innerHTML =
      '<p class="text-muted mb-0">No section selected.</p>';
    tableRows = [];
    tableColumns = [];
    rowMapping = [];
    return;
  }

  const section = tableSections.find((s) => s.id === selectedId);
  if (!section) {
    tableContainer.innerHTML =
      '<p class="text-muted mb-0">Selected section not found.</p>';
    tableRows = [];
    tableColumns = [];
    rowMapping = [];
    return;
  }

  currentSection = section;

  const { rows, mapping } = buildTableProjection(section.json, section.path);
  tableRows = rows;
  rowMapping = mapping;

  // Collect all column names
  const colSet = new Set();
  tableRows.forEach((row) => {
    if (row && typeof row === "object") {
      Object.keys(row).forEach((k) => colSet.add(k));
    }
  });
  tableColumns = Array.from(colSet);

  updateColumnFilterOptions();
  renderTable();
}

// 6) Render table with editable cells
function renderTable() {
  if (!tableRows.length || !tableColumns.length) {
    tableContainer.innerHTML =
      '<p class="text-muted mb-0">No data to display.</p>';
    return;
  }

  // Texte du filtre
  let filterText = "";
  if (tableFilterInput) {
    filterText = tableFilterInput.value.trim().toLowerCase();
  }

  // Colonne choisie dans le menu déroulant
  let selectedColumn = "";
  if (tableKeySelect) {
    selectedColumn = tableKeySelect.value;
  }

  const displayRows = [];
  const displayRowIndices = [];

  tableRows.forEach((row, idx) => {
    // 1) Si aucune colonne choisie ET pas de texte -> on affiche tout
    if (!selectedColumn && !filterText) {
      displayRows.push(row);
      displayRowIndices.push(idx);
      return;
    }

    // 2) Si une colonne est choisie, check si la ligne a une valeur dans cette colonne
    let hasValueInColumn = true;
    if (selectedColumn) {
      const val = row[selectedColumn];
      hasValueInColumn =
        val !== null &&
        val !== undefined &&
        String(val).trim() !== "";
    }

    if (!hasValueInColumn) {
      // Si on veut filtrer sur une colonne mais que la ligne n'a rien dans cette colonne, on la skip
      return;
    }

    // 3) Gestion du filtre texte
    if (!filterText) {
      // colonne sélectionnée mais pas de texte -> juste "présence de valeur" dans cette colonne
      displayRows.push(row);
      displayRowIndices.push(idx);
      return;
    }

    let matches = false;

    if (selectedColumn) {
      // texte + colonne sélectionnée -> on cherche dans CETTE colonne uniquement
      const val = row[selectedColumn];
      if (val !== null && val !== undefined) {
        matches = String(val).toLowerCase().includes(filterText);
      }
    } else {
      // texte mais aucune colonne sélectionnée -> on cherche dans TOUTES les colonnes
      matches = tableColumns.some((col) => {
        const val = row[col];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(filterText);
      });
    }

    if (matches) {
      displayRows.push(row);
      displayRowIndices.push(idx);
    }
  });

  if (!displayRows.length) {
    tableContainer.innerHTML =
      '<p class="text-muted mb-0">No data matching the filter.</p>';
    return;
  }

  const table = document.createElement("table");
  table.className = "table table-sm table-striped table-hover mb-0 excel-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  tableColumns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  displayRows.forEach((row, displayIndex) => {
    const tr = document.createElement("tr");
    const mappingIndex = displayRowIndices[displayIndex];

    tableColumns.forEach((col) => {
      const td = document.createElement("td");
      td.className = "excel-cell";

      const value = row[col];

      if (typeof value === "boolean") {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = value;

        checkbox.addEventListener("change", () => {
          applyCellUpdate(mappingIndex, col, checkbox.checked);
        });

        td.appendChild(checkbox);
        td.title = String(value);
      } else {
        const text = value != null ? String(value) : "";
        td.contentEditable = true;
        td.textContent = text;
        td.title = text;

        td.addEventListener("blur", () => {
          applyCellUpdate(mappingIndex, col, td.textContent);
        });
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableContainer.innerHTML = "";
  tableContainer.appendChild(table);
}


function updateColumnFilterOptions() {
  if (!tableKeySelect) return;

  const previous = tableKeySelect.value;

  tableKeySelect.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "(All columns)";
  tableKeySelect.appendChild(optAll);

  tableColumns.forEach((col) => {
    const opt = document.createElement("option");
    opt.value = col;
    opt.textContent = col;
    tableKeySelect.appendChild(opt);
  });

  // Restaure la sélection si la colonne existe toujours
  if (previous && tableColumns.includes(previous)) {
    tableKeySelect.value = previous;
  }
}



// 7) Apply a cell update into workingJson using the mapping
function applyCellUpdate(rowIndex, column, newValue) {
  const info = rowMapping[rowIndex];
  if (!info || !workingJson) return;

  // Traverse workingJson using parentPath
  let parent = workingJson;
  info.parentPath.forEach((key) => {
    parent = parent[key];
  });

  if (info.index != null) {
    // Array case
    parent[info.index][column] = parseCellValue(newValue);
  } else if (info.key != null) {
    // Object case (e.g. Meshes)
    parent[info.key][column] = parseCellValue(newValue);
  }

  // Reflect in editor (full JSON text)
  editor.value = JSON.stringify(workingJson, null, 2);
  setMessage("Change applied (not saved to server yet).", "info");
}

// 8) Try to preserve types (boolean / number / string)
function parseCellValue(value) {
  // Value can already be boolean (checkbox case)
  if (typeof value === "boolean") return value;

  const trimmed = String(value).trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed !== "") {
    return num;
  }

  return trimmed;
}


// Parse the editor content as JSON
function parseEditorJson() {
  try {
    const text = editor.value;
    const parsed = JSON.parse(text);
    return parsed;
  } catch (error) {
    console.warn("Unable to parse JSON from editor:", error);
    return null;
  }
}


// -----------------------------
//  Event listeners
// -----------------------------

loadBtn.addEventListener("click", loadFromServer);
saveBtn.addEventListener("click", saveToServer);
fileInput.addEventListener("change", handleFileChange);
refreshTableBtn.addEventListener("click", updateTableSectionsAndRender);
tableSectionSelect.addEventListener("change", renderCurrentSection);


if (tableFilterInput) {
  tableFilterInput.addEventListener("input", renderTable);
}

if (tableKeySelect) {
  tableKeySelect.addEventListener("change", renderTable);
}



// Load JSON from server when the page is ready
window.addEventListener("DOMContentLoaded", () => {
  loadFromServer();
});

// -----------------------------
// Download JSON as file
// -----------------------------

function downloadJsonFile() {
  // Ensure current editor content is valid JSON before generating the file
  let parsed;
  try {
    parsed = JSON.parse(editor.value);
  } catch (err) {
    setMessage("Cannot download: JSON is invalid.", "error");
    return;
  }

  // Convert object to pretty JSON text
  const jsonText = JSON.stringify(parsed, null, 2);

  // Create a Blob (file-like object in memory)
  const blob = new Blob([jsonText], { type: "application/json" });

  // Create a temporary URL for the Blob
  const url = URL.createObjectURL(blob);

  // Create a temporary <a> element to trigger download
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.json"; // Name of the file the user will download
  document.body.appendChild(a);
  a.click();

  // Clean up
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  setMessage("JSON downloaded.", "success");
}

// Attach listener
const downloadBtn = document.getElementById("download-json");
if (downloadBtn) {
  downloadBtn.addEventListener("click", downloadJsonFile);
}

// -----------------------------
// Theme toggle (light / dark)
// -----------------------------

const toggleThemeBtn = document.getElementById("toggle-theme-btn");

function applyTheme(mode) {
  // Set Bootstrap theme attribute on <html>
  document.documentElement.setAttribute("data-bs-theme", mode);

  // Basic body background / text color
  document.body.classList.toggle("bg-light", mode === "light");
  document.body.classList.toggle("bg-dark", mode === "dark");
  document.body.classList.toggle("text-light", mode === "dark");

  // NAVBAR
  applyNavbarTheme(mode);

  // Persist choice
  localStorage.setItem("theme", mode);
}

function applyNavbarTheme(mode) {
  const navbar = document.getElementById("main-navbar");
  if (!navbar) return;

  if (mode === "dark") {
    navbar.classList.remove("navbar-light", "bg-white");
    navbar.classList.add("navbar-dark", "bg-dark");
  } else {
    navbar.classList.remove("navbar-dark", "bg-dark");
    navbar.classList.add("navbar-light", "bg-white");
  }
}


function initTheme() {
  const saved = localStorage.getItem("theme");
  let mode;

  if (saved === "light" || saved === "dark") {
    mode = saved;
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    mode = prefersDark ? "dark" : "light";
  }

  applyTheme(mode);
}

if (toggleThemeBtn) {
  toggleThemeBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-bs-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
  });
}

// Initialize on page load
initTheme();

