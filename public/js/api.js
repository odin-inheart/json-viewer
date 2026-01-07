import { store } from "./store.js";
import { ui, setMessage } from "./ui.js";

export async function loadFromServer() {
  try {
    setMessage("Loading JSON from server...");

    const response = await fetch("/api/data");
    if (!response.ok) throw new Error("Unexpected server response");

    const data = await response.json();

    store.workingJson = JSON.parse(JSON.stringify(data));
    if (ui.editor) ui.editor.value = JSON.stringify(store.workingJson, null, 2);

    setMessage("JSON loaded from server.", "success");
  } catch (error) {
    console.error("Error while loading JSON from server:", error);
    setMessage("Failed to load JSON from server.", "error");
  }
}

export async function saveToServer() {
  try {
    setMessage("Validating JSON...");

    let parsed;
    try {
      parsed = JSON.parse(ui.editor?.value ?? "");
    } catch {
      setMessage("Invalid JSON format.", "error");
      return;
    }

    setMessage("Sending data to server...");

    const response = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    if (!response.ok) throw new Error("Unexpected server error while saving");

    const result = await response.json();

    if (result.success) {
      store.workingJson = parsed;
      setMessage("JSON successfully saved on the server.", "success");
    } else {
      setMessage("The server returned an error while saving JSON.", "error");
    }
  } catch (error) {
    console.error("Error while saving JSON:", error);
    setMessage("Failed to save JSON on the server.", "error");
  }
}

export function handleFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith(".json")) {
    setMessage("Please select a .json file.", "error");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);

      store.workingJson = JSON.parse(JSON.stringify(parsed));
      if (ui.editor) ui.editor.value = JSON.stringify(store.workingJson, null, 2);

      setMessage(`JSON loaded from file "${file.name}".`, "success");
    } catch (error) {
      console.error("Error while parsing JSON file:", error);
      setMessage("Invalid JSON file.", "error");
    }
  };

  reader.readAsText(file);
}

export function downloadJsonFile() {
  let parsed;
  try {
    parsed = JSON.parse(ui.editor?.value ?? "");
  } catch {
    setMessage("Cannot download: JSON is invalid.", "error");
    return;
  }

  const jsonText = JSON.stringify(parsed, null, 2);
  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "data.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
  setMessage("JSON downloaded.", "success");
}
