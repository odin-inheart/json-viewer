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
// Table view (JSON analysis)
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












// -----------------------------
//  Event listeners
// -----------------------------

loadBtn.addEventListener("click", loadFromServer);
saveBtn.addEventListener("click", saveToServer);
fileInput.addEventListener("change", handleFileChange);



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

