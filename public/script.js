const editor = document.getElementById("json-editor");
const loadBtn = document.getElementById("load-from-server");
const saveBtn = document.getElementById("save-to-server");
const fileInput = document.getElementById("json-file-input");
const message = document.getElementById("message");

// Affichage des messages utilisateur
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

// load json from server
async function loadFromServer() {
  try {
    setMessage("Chargement du JSON depuis le serveur...");

    const response = await fetch("/api/data");

    if (!response.ok) {
      throw new Error("Réponse serveur non valide");
    }

    const data = await response.json();

    // 
    editor.value = JSON.stringify(data, null, 2);

    setMessage("JSON chargé depuis le serveur", "success");
  } catch (error) {
    console.error("Erreur lors du chargement du JSON :", error);
    setMessage("Erreur lors du chargement du JSON serveur ❌", "error");
  }
}

// Save Json to server - in progress
async function saveToServer() {
  try {
    setMessage("Vérification du JSON...");

    let parsed;
    try {
      parsed = JSON.parse(editor.value);
    } catch (error) {
      setMessage("JSON invalide ❌", "error");
      return;
    }

    setMessage("Envoi au serveur...");

    const response = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    if (!response.ok) throw new Error("Erreur serveur");

    const result = await response.json();

    if (result.success) {
      setMessage("JSON sauvegardé avec succès 💾✅", "success");
    } else {
      setMessage("Le serveur a renvoyé une erreur ❌", "error");
    }
  } catch (error) {
    console.error(error);
    setMessage("Impossible de sauvegarder le JSON ❌", "error");
  }
}



// Load a local JSON - in progess
function handleFileChange(event) {
  const file = event.target.files[0];
  if (!file) {
    setMessage("Aucun fichier sélectionné.", "info");
    return;
  }

  // Vérification de l’extension (basique mais utile)
  if (!file.name.endsWith(".json")) {
    setMessage("Merci de choisir un fichier .json", "error");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const content = reader.result;

      // On vérifie que le contenu est un JSON valide
      const parsed = JSON.parse(content);

      // Si OK, on l'affiche formaté dans le textarea
      editor.value = JSON.stringify(parsed, null, 2);

      setMessage(
        `JSON chargé depuis le fichier "${file.name}". Tu peux maintenant l'éditer et, si tu veux, le sauvegarder sur le serveur.`,
        "success"
      );
    } catch (error) {
      console.error("Erreur lors de la lecture du fichier JSON :", error);
      setMessage("Le fichier sélectionné ne contient pas un JSON valide ❌", "error");
    }
  };

  reader.onerror = () => {
    console.error("Erreur de lecture du fichier :", reader.error);
    setMessage("Erreur lors de la lecture du fichier ❌", "error");
  };

  reader.readAsText(file, "utf-8");
}


// Event listeners
loadBtn.addEventListener("click", loadFromServer);
saveBtn.addEventListener("click", saveToServer);
fileInput.addEventListener("change", handleFileChange);

// Load JSON when page loads
window.addEventListener("DOMContentLoaded", () => {
  loadFromServer();
});