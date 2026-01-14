import { store } from "./store.js";
import { ui, setMessage } from "./ui.js";

let tableSections = [];
let tableRows = [];
let tableColumns = [];
let rowMapping = [];

export function computeTableSections(rootJson) {
  const sections = [];
  if (!rootJson) return sections;

  if (Array.isArray(rootJson) && rootJson.length > 0 && typeof rootJson[0] === "object") {
    sections.push({ id: "__root__", label: `Root (array with ${rootJson.length} items)`, path: [], json: rootJson });
  }

  if (rootJson && typeof rootJson === "object" && !Array.isArray(rootJson)) {
    for (const [key, value] of Object.entries(rootJson)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
        sections.push({ id: key, label: `${key} (array with ${value.length} items)`, path: [key], json: value });
      }

      if (value && typeof value === "object" && !Array.isArray(value)) {
        const hasObjectValues = Object.values(value).some((v) => v && typeof v === "object");
        if (hasObjectValues) {
          const count = Object.keys(value).length;
          sections.push({ id: key, label: `${key} (object with ${count} entries)`, path: [key], json: value });
        }
      }
    }
  }

  return sections;
}

export function buildTableProjection(json, sectionPath = []) {
  const rows = [];
  const mapping = [];

  if (Array.isArray(json)) {
    json.forEach((item, index) => {
      if (item && typeof item === "object") {
        rows.push(item);
        mapping.push({ parentPath: [...sectionPath], index, key: null });
      }
    });
    return { rows, mapping };
  }

  if (json && typeof json === "object") {
    Object.entries(json).forEach(([key, value]) => {
      if (value && typeof value === "object") {
        rows.push({ __key: key, ...value });
        mapping.push({ parentPath: [...sectionPath], index: null, key });
      }
    });
    return { rows, mapping };
  }

  return { rows: [], mapping: [] };
}

export function fillTableSectionSelect() {
  if (!ui.tableSectionSelect) return;

  const previousSelection = ui.tableSectionSelect.value;
  ui.tableSectionSelect.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = tableSections.length ? "(Select a section)" : "(No table view available)";
  ui.tableSectionSelect.appendChild(defaultOption);

  tableSections.forEach((section) => {
    const opt = document.createElement("option");
    opt.value = section.id;
    opt.textContent = section.label;
    ui.tableSectionSelect.appendChild(opt);
  });

  if (previousSelection && tableSections.some((s) => s.id === previousSelection)) ui.tableSectionSelect.value = previousSelection;
  else if (tableSections.length > 0) ui.tableSectionSelect.value = tableSections[0].id;
}

export function updateColumnFilterOptions() {
  if (!ui.tableKeySelect) return;

  const previous = ui.tableKeySelect.value;
  ui.tableKeySelect.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "(All columns)";
  ui.tableKeySelect.appendChild(optAll);

  tableColumns.forEach((col) => {
    const opt = document.createElement("option");
    opt.value = col;
    opt.textContent = col;
    ui.tableKeySelect.appendChild(opt);
  });

  if (previous && tableColumns.includes(previous)) ui.tableKeySelect.value = previous;
}

export function parseCellValue(value) {
  if (typeof value === "boolean") return value;

  const trimmed = String(value).trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed !== "") return num;

  return trimmed;
}

export function renameKeyPreserveOrder(obj, oldKey, newKey) {
  const keys = Object.keys(obj);
  const entries = keys.map((k) => [k === oldKey ? newKey : k, obj[k]]);
  for (const k of keys) delete obj[k];
  for (const [k, v] of entries) obj[k] = v;
}


export function applyCellUpdate(rowIndex, column, newValue) {
  const info = rowMapping[rowIndex];
  if (!info || !store.workingJson) return;

  let parent = store.workingJson;
  info.parentPath.forEach((k) => {
    parent = parent[k];
  });


  if (column === "__key") {
    if (info.key == null) {
      setMessage("__key can only be edited on object-based sections.", "warning");
      return;
    }

    const oldKey = info.key;
    const newKey = String(newValue).trim();
    if (!newKey || newKey === oldKey) return;

    if (Object.prototype.hasOwnProperty.call(parent, newKey)) {
      setMessage(`Key "${newKey}" already exists.`, "warning");
      return;
    }

    renameKeyPreserveOrder(parent, oldKey, newKey);

    // refresh table & raw editor
    renderCurrentSection();
    if (ui.editor) ui.editor.value = JSON.stringify(store.workingJson, null, 2);

    setMessage(`Key renamed: ${oldKey} → ${newKey}`, "info");
    return;
  }


  parent[newKey] = parent[oldKey];
  delete parent[oldKey];

  // refresh table & raw editor
  renderCurrentSection();
  if (ui.editor) ui.editor.value = JSON.stringify(store.workingJson, null, 2);

  setMessage(`Key renamed: ${oldKey} → ${newKey}`, "info");
  return;
}




export function renderCurrentSection() {
  const selectedId = ui.tableSectionSelect?.value;

  if (!selectedId) {
    if (ui.tableContainer) ui.tableContainer.innerHTML = '<p class="text-muted mb-0">No section selected.</p>';
    tableRows = [];
    tableColumns = [];
    rowMapping = [];
    return;
  }

  const section = tableSections.find((s) => s.id === selectedId);
  if (!section) {
    if (ui.tableContainer) ui.tableContainer.innerHTML = '<p class="text-muted mb-0">Selected section not found.</p>';
    tableRows = [];
    tableColumns = [];
    rowMapping = [];
    return;
  }

  const { rows, mapping } = buildTableProjection(section.json, section.path);
  tableRows = rows;
  rowMapping = mapping;

  const colSet = new Set();
  tableRows.forEach((row) => row && typeof row === "object" && Object.keys(row).forEach((k) => colSet.add(k)));
  tableColumns = Array.from(colSet);

  updateColumnFilterOptions();
  renderTable();
}

export function renderTable() {
  if (!ui.tableContainer) return;

  if (!tableRows.length || !tableColumns.length) {
    ui.tableContainer.innerHTML = '<p class="text-muted mb-0">No data to display.</p>';
    return;
  }

  const filterText = (ui.tableFilterInput?.value || "").trim().toLowerCase();
  const selectedColumn = ui.tableKeySelect?.value || "";

  const displayRows = [];
  const displayRowIndices = [];

  tableRows.forEach((row, idx) => {
    if (!selectedColumn && !filterText) {
      displayRows.push(row);
      displayRowIndices.push(idx);
      return;
    }

    let hasValueInColumn = true;
    if (selectedColumn) {
      const val = row[selectedColumn];
      hasValueInColumn = val !== null && val !== undefined && String(val).trim() !== "";
    }
    if (!hasValueInColumn) return;

    if (!filterText) {
      displayRows.push(row);
      displayRowIndices.push(idx);
      return;
    }

    let matches = false;
    if (selectedColumn) {
      const val = row[selectedColumn];
      if (val !== null && val !== undefined) matches = String(val).toLowerCase().includes(filterText);
    } else {
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
    ui.tableContainer.innerHTML = '<p class="text-muted mb-0">No data matching the filter.</p>';
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
        checkbox.addEventListener("change", () => applyCellUpdate(mappingIndex, col, checkbox.checked));
        td.appendChild(checkbox);
        td.title = String(value);
      } else {
        const text = value != null ? String(value) : "";
        td.contentEditable = true;
        td.textContent = text;
        td.title = text;
        td.addEventListener("blur", () => applyCellUpdate(mappingIndex, col, td.textContent));
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  ui.tableContainer.innerHTML = "";
  ui.tableContainer.appendChild(table);
}

export function resetTableFilters() {
  if (ui.tableFilterInput) ui.tableFilterInput.value = "";
  if (ui.tableKeySelect) ui.tableKeySelect.value = "";
  renderTable();
}

export function updateTableSectionsAndRender() {
  if (!store.workingJson) {
    tableSections = [];
    if (ui.tableContainer) ui.tableContainer.innerHTML = '<p class="text-muted mb-0">No data available.</p>';
    return;
  }

  tableSections = computeTableSections(store.workingJson);
  fillTableSectionSelect();
  renderCurrentSection();
}

export function bindTableEvents() {
  ui.tableSectionSelect?.addEventListener("change", renderCurrentSection);
  ui.tableKeySelect?.addEventListener("change", renderTable);
  ui.refreshTableBtn?.addEventListener("click", resetTableFilters);
}
