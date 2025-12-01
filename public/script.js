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
let lastParsedJson = null;
let tableSources = []; // { id, label, rows }
let currentRows = [];
let currentHeaders = [];
let currentSectionId = null;

// Row edit mode state
let rowEditMode = false;
let selectedRowInfo = null; // { sectionId, kind: 'root'|'array'|'object', index?, key? }
let fullJsonBackup = null;  // string: full JSON text before entering row edit mode

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
// 1) Load JSON from server
// ----------------------

async function loadFromServer() {
  try {
    setMessage("Loading JSON from server...");

    const response = await fetch("/api/data");

    if (!response.ok) {
      throw new Error("Unexpected server response");
    }

    const data = await response.json();
    editor.value = JSON.stringify(data, null, 2);

    // We are back to full JSON mode
    rowEditMode = false;
    selectedRowInfo = null;
    fullJsonBackup = null;
    lastParsedJson = data;

    setMessage("JSON loaded from server.", "success");

    // Update table view based on the new JSON content
    updateTableViewFromEditor();
  } catch (error) {
    console.error("Error while loading JSON from server:", error);
    setMessage("Failed to load JSON from server.", "error");
  }
}

// ----------------------
// 2) Save JSON to server
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
// 3) Load JSON from a local file
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

      editor.value = JSON.stringify(parsed, null, 2);

      lastParsedJson = parsed;
      rowEditMode = false;
      selectedRowInfo = null;
      fullJsonBackup = null;

      setMessage(
        `JSON loaded from file "${file.name}". You can edit it and optionally save it to the server.`,
        "success"
      );

      // Update table view based on the new JSON content
      updateTableViewFromEditor();
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
// 4) Table view (JSON analysis)
// -----------------------------

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

// Determine possible table sources within the JSON
function computeTableSources(parsed) {
  const sources = [];

  if (!parsed) return sources;

  // Case 1: root is an array of objects
  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
    sources.push({
      id: "__root__",
      label: `Root (array with ${parsed.length} items)`,
      rows: parsed,
    });
  }

  // Case 2: root is an object, inspect its properties
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const [key, value] of Object.entries(parsed)) {
      // 2.a) property is an array of objects
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
        sources.push({
          id: key,
          label: `${key} (array with ${value.length} items)`,
          rows: value,
        });
      }
      // 2.b) property is an object whose values are objects (e.g. "Meshes")
      else if (value && typeof value === "object" && !Array.isArray(value)) {
        const rows = Object.entries(value).map(([k, v]) => {
          if (v && typeof v === "object") {
            return { _key: k, ...v };
          } else {
            return { _key: k, value: v };
          }
        });

        if (rows.length > 0 && typeof rows[0] === "object") {
          sources.push({
            id: key,
            label: `${key} (object with ${rows.length} entries)`,
            rows,
          });
        }
      }
    }
  }

  return sources;
}

// Update table sources based on the current editor JSON
function updateTableViewFromEditor() {
  // We assume here that the editor contains the full JSON, not a single row.
  const parsed = parseEditorJson();
  lastParsedJson = parsed;

  tableSources = computeTableSources(parsed);

  // Update the section selector
  fillTableSectionSelect();
  // Render the table for the selected section (or first available)
  renderTableForCurrentSelection();
}

// Fill the <select> with available table sources
function fillTableSectionSelect() {
  const previousSelection = tableSectionSelect.value;

  // Clear existing options
  tableSectionSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = tableSources.length
    ? "(Select a section)"
    : "(No table view available)";
  tableSectionSelect.appendChild(defaultOption);

  for (const source of tableSources) {
    const opt = document.createElement("option");
    opt.value = source.id;
    opt.textContent = source.label;
    tableSectionSelect.appendChild(opt);
  }

  // Restore previous selection if still valid
  if (
    previousSelection &&
    tableSources.some((s) => s.id === previousSelection)
  ) {
    tableSectionSelect.value = previousSelection;
  } else if (tableSources.length > 0) {
    // Otherwise select the first available section by default
    tableSectionSelect.value = tableSources[0].id;
  }
}

// Render table for the currently selected section
function renderTableForCurrentSelection() {
  const sectionId = tableSectionSelect.value;
  currentSectionId = sectionId || null;

  if (!sectionId) {
    tableContainer.innerHTML =
      '<p class="text-muted mb-0">No section selected.</p>';
    currentRows = [];
    currentHeaders = [];
    return;
  }

  const source = tableSources.find((s) => s.id === sectionId);
  if (!source) {
    tableContainer.innerHTML =
      '<p class="text-muted mb-0">Selected section not found.</p>';
    currentRows = [];
    currentHeaders = [];
    return;
  }

  const rows = source.rows || [];
  currentRows = rows;

  // Collect all keys used across rows to define the columns
  const headersSet = new Set();
  rows.forEach((row) => {
    if (row && typeof row === "object") {
      Object.keys(row).forEach((key) => headersSet.add(key));
    }
  });
  currentHeaders = Array.from(headersSet);

  // Fill key filter select
  fillKeyFilterSelect();

  // Render the table
  renderFilteredTable();
}

function fillKeyFilterSelect() {
  // Reset options
  tableKeySelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "All keys";
  tableKeySelect.appendChild(defaultOption);

  if (!currentRows.length) {
    return;
  }

  // Collect distinct _key values if present
  const keySet = new Set();
  currentRows.forEach((row) => {
    if (row && typeof row === "object" && "_key" in row) {
      keySet.add(row._key);
    }
  });

  Array.from(keySet).forEach((key) => {
    const opt = document.createElement("option");
    opt.value = String(key);
    opt.textContent = String(key);
    tableKeySelect.appendChild(opt);
  });
}

// Make a row selectable for editing in the main editor
function selectRowForEditing(row) {
  if (!lastParsedJson || !currentSectionId) {
    setMessage("Cannot determine context for the selected row.", "error");
    return;
  }

  fullJsonBackup = editor.value;
  rowEditMode = true;

  let kind = null;
  let info = { sectionId: currentSectionId, kind: null, index: null, key: null };

  if (currentSectionId === "__root__") {
    // Root is an array
    if (!Array.isArray(lastParsedJson)) {
      setMessage("Root is not an array; cannot map selected row.", "error");
      rowEditMode = false;
      return;
    }
    const index = currentRows.indexOf(row);
    if (index < 0) {
      setMessage("Unable to locate selected row in root array.", "error");
      rowEditMode = false;
      return;
    }
    kind = "root";
    info.kind = kind;
    info.index = index;
  } else {
    const section = lastParsedJson[currentSectionId];
    if (Array.isArray(section)) {
      const index = currentRows.indexOf(row);
      if (index < 0) {
        setMessage("Unable to locate selected row in section array.", "error");
        rowEditMode = false;
        return;
      }
      kind = "array";
      info.kind = kind;
      info.index = index;
    } else if (section && typeof section === "object") {
      const rowKey = row._key;
      if (!rowKey) {
        setMessage("Selected row has no _key field; cannot map it.", "error");
        rowEditMode = false;
        return;
      }
      if (!(rowKey in section)) {
        setMessage("Selected _key does not exist in the JSON object.", "error");
        rowEditMode = false;
        return;
      }
      kind = "object";
      info.kind = kind;
      info.key = rowKey;
    } else {
      setMessage("Current section is neither an array nor an object.", "error");
      rowEditMode = false;
      return;
    }
  }

  selectedRowInfo = info;

  // Show only the selected row JSON in the main editor
  editor.value = JSON.stringify(row, null, 2);
  setMessage(
    "You are now editing a single entry. Use 'Apply selected row to JSON' to merge it back, or 'Cancel' to go back.",
    "info"
  );
}

// Apply text filter and render the table HTML
function renderFilteredTable() {
  if (!currentRows.length || !currentHeaders.length) {
    tableContainer.innerHTML =
      '<p class="text-muted mb-0">No data to display.</p>';
    return;
  }

  const filterText = tableFilterInput.value.trim().toLowerCase();
  const selectedKey = tableKeySelect.value;

  // First filter on _key if selected
  let rowsToFilter = currentRows;
  if (selectedKey) {
    rowsToFilter = rowsToFilter.filter(
      (row) =>
        row &&
        row._key !== undefined &&
        String(row._key) === String(selectedKey)
    );
  }

  // Then apply text filter
  const filteredRows = rowsToFilter.filter((row) => {
    if (!filterText) return true;
    return currentHeaders.some((key) => {
      const value = row[key];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(filterText);
    });
  });

  const table = document.createElement("table");
  table.className = "table table-sm table-striped table-hover mb-0";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  currentHeaders.forEach((key) => {
    const th = document.createElement("th");
    th.textContent = key;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  filteredRows.forEach((row) => {
    const tr = document.createElement("tr");

    // Make the row clickable to load it into the main editor
    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => {
      selectRowForEditing(row);
    });

    currentHeaders.forEach((key) => {
      const td = document.createElement("td");
      const value = row[key];

      if (value === null || value === undefined) {
        td.textContent = "";
      } else if (typeof value === "object") {
        // For nested objects/arrays, show a compact JSON representation
        td.textContent = JSON.stringify(value);
      } else {
        td.textContent = String(value);
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableContainer.innerHTML = "";
  tableContainer.appendChild(table);
}

// -----------------------------
// 5) Row edit apply / cancel
// -----------------------------

function applySelectedRowChanges() {
  if (!rowEditMode || !selectedRowInfo || !lastParsedJson) {
    setMessage("No row edit in progress.", "error");
    return;
  }

  let updatedRow;
  try {
    updatedRow = JSON.parse(editor.value);
  } catch (error) {
    setMessage("Editor contains invalid JSON for the selected row.", "error");
    console.error("Error parsing row JSON:", error);
    return;
  }

  try {
    const { sectionId, kind, index, key } = selectedRowInfo;

    if (kind === "root") {
      if (!Array.isArray(lastParsedJson)) {
        throw new Error("Root is not an array.");
      }
      if (index == null || index < 0 || index >= lastParsedJson.length) {
        throw new Error("Invalid index for root array.");
      }
      lastParsedJson[index] = updatedRow;
    } else if (kind === "array") {
      const section = lastParsedJson[sectionId];
      if (!Array.isArray(section)) {
        throw new Error("Section is not an array.");
      }
      if (index == null || index < 0 || index >= section.length) {
        throw new Error("Invalid index for section array.");
      }
      section[index] = updatedRow;
    } else if (kind === "object") {
      const section = lastParsedJson[sectionId];
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        throw new Error("Section is not an object of entries.");
      }
      if (!key || !(key in section)) {
        throw new Error("Invalid key for object section.");
      }

      // Do not allow changing the key name via row editor: ignore updatedRow._key
      const { _key, ...rest } = updatedRow;
      section[key] = rest;
    } else {
      throw new Error("Unknown row kind.");
    }

    // Back to full JSON mode
    editor.value = JSON.stringify(lastParsedJson, null, 2);
    rowEditMode = false;
    selectedRowInfo = null;
    fullJsonBackup = null;

    updateTableViewFromEditor();
    setMessage("Row changes applied to the full JSON.", "success");
  } catch (error) {
    console.error("Error while applying row changes:", error);
    setMessage("Failed to apply row changes to the full JSON.", "error");
  }
}

function cancelRowEditing() {
  if (!rowEditMode) {
    setMessage("No row edit in progress.", "info");
    return;
  }

  if (fullJsonBackup) {
    editor.value = fullJsonBackup;
  } else if (lastParsedJson) {
    editor.value = JSON.stringify(lastParsedJson, null, 2);
  }

  rowEditMode = false;
  selectedRowInfo = null;
  fullJsonBackup = null;
  setMessage("Row editing cancelled. Full JSON restored.", "info");

  // Optional: refresh table view
  updateTableViewFromEditor();
}

// -----------------------------
// 6) Event listeners
// -----------------------------

loadBtn.addEventListener("click", loadFromServer);
saveBtn.addEventListener("click", saveToServer);
fileInput.addEventListener("change", handleFileChange);

refreshTableBtn.addEventListener("click", updateTableViewFromEditor);
tableSectionSelect.addEventListener("change", renderTableForCurrentSelection);
tableFilterInput.addEventListener("input", renderFilteredTable);
tableKeySelect.addEventListener("change", renderFilteredTable);

applyRowEditBtn.addEventListener("click", applySelectedRowChanges);
cancelRowEditBtn.addEventListener("click", cancelRowEditing);

// Load JSON from server when the page is ready
window.addEventListener("DOMContentLoaded", () => {
  loadFromServer();
});
