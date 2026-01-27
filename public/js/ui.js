export const ui = {
    editor: document.getElementById("json-editor"),
    message: document.getElementById("message"),

    //buttons
    loadBtn: document.getElementById("load-from-server"),
    saveBtn: document.getElementById("save-to-server"),
    fileInput: document.getElementById("json-file-input"),
    downloadBtn: document.getElementById("download-json"),

    //table view
    tableFilterInput: document.getElementById("table-filter-input"),
    tableSectionSelect: document.getElementById("table-section-select"),
    refreshTableBtn: document.getElementById("refresh-table"),
    tableContainer: document.getElementById("table-container"),
    tableKeySelect: document.getElementById("table-key-select"),

    //raw view
    rawViewWrapper: document.getElementById("raw-view-wrapper"),
    rawFindNextBtn: document.getElementById("raw-find-next"),
    rawFindPrevBtn: document.getElementById("raw-find-prev"),

    //view switch
    tableViewWrapper: document.getElementById("table-view-wrapper"),
    viewToggleButtons: document.querySelectorAll("#view-toggle [data-view]"),

    //theme
    toggleThemeBtn: document.getElementById("toggle-theme-btn"),
};

export function setMessage(text, type = "info") {
    if (!ui.message) return;
    
    ui.message.textContent = text;
    if (type === "error") {
        ui.message.className = "small text-danger";
    } else if (type === "success") {
        ui.message.className = "small text-success";
    } else {
        ui.message.className = "small text-muted";
    }
}