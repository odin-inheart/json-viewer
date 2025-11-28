const express = require("express");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = 8888;

// main json
const DATA_FILE = path.join(__dirname, "data.json");

// Middleware to parse json sent by front
app.use(express.json({ limit: "50mb" }));

// use statics from /public
app.use(express.static(path.join(__dirname, "public")));

// endpoint for json
app.get("/api/data", async (req, res) => {
  try {
    const fileContent = await fs.readFile(DATA_FILE, "utf-8");
    const jsonData = JSON.parse(fileContent);
    res.json(jsonData);
  } catch (err) {
    console.error("Erreur lecture JSON:", err);
    res.status(500).json({ error: "Impossible de lire le fichier JSON" });
  }
});

// endpoint for saving modified json
app.post("/api/data", async (req, res) => {
  try {
    const newData = req.body;
    console.log("Données reçues côté backend :", typeof newData);

    if (typeof newData !== "object" || newData === null) {
      return res.status(400).json({ error: "Données JSON invalides" });
    }

    await fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2), "utf-8");
    console.log("Écriture réussie dans data.json");

    res.json({ success: true, message: "JSON sauvegardé avec succès" });
  } catch (err) {
    console.error("Erreur écriture JSON:", err);
    res.status(500).json({ error: "Impossible de sauvegarder le fichier JSON" });
  }
});

// starting server
app.listen(PORT, () => {
  console.log(`Server launched on http://localhost:${PORT}`);
});
