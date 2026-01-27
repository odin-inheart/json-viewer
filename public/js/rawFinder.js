import { ui, setMessage } from "./ui.js";

let rawFindState = { query: "", matches: [], index: -1 };

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isRawModeActive() {
  return ui.rawViewWrapper && !ui.rawViewWrapper.classList.contains("d-none");
}

export function buildRawMatches() {
  if (!isRawModeActive()) return;

  const query = (ui.tableFilterInput?.value || "").trim();
  rawFindState.query = query;
  rawFindState.matches = [];
  rawFindState.index = -1;

  if (!query) {
    setMessage("Type something to search in Raw JSON.", "info");
    return;
  }

  const text = ui.editor?.value || "";
  const regex = new RegExp(escapeRegExp(query), "gi");

  let m;
  while ((m = regex.exec(text)) !== null) {
    rawFindState.matches.push({ start: m.index, end: m.index + m[0].length });
    if (m.index === regex.lastIndex) regex.lastIndex++;
  }

  if (rawFindState.matches.length === 0) {
    setMessage(`No matches for "${query}".`, "error");
  } else {
    setMessage(`${rawFindState.matches.length} match(es) for "${query}". Use Next/Previous.`, "success");
  }
}

function jumpToRawMatch(direction) {
  if (!isRawModeActive()) return;

  if (!rawFindState.query || rawFindState.matches.length === 0) {
    buildRawMatches();
    if (rawFindState.matches.length === 0) return;
  }

  const total = rawFindState.matches.length;
  rawFindState.index = (rawFindState.index + direction + total) % total;

  const { start, end } = rawFindState.matches[rawFindState.index];

  ui.editor?.focus();
  ui.editor?.setSelectionRange(start, end);

  const before = (ui.editor?.value || "").slice(0, start);
  const line = before.split("\n").length;
  const approxLineHeight = 18;
  if (ui.editor) ui.editor.scrollTop = Math.max(0, (line - 3) * approxLineHeight);

  setMessage(`Match ${rawFindState.index + 1}/${total}`, "info");
}

export function bindRawFinderEvents() {
  ui.rawFindNextBtn?.addEventListener("click", () => jumpToRawMatch(+1));
  ui.rawFindPrevBtn?.addEventListener("click", () => jumpToRawMatch(-1));
}
