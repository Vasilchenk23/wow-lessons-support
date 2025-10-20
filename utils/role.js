const fs = require("fs");
const path = require("path");

const MANAGERS_FILE = path.join(__dirname, "../data/managers.json");

function loadManagers() {
  try {
    const data = fs.readFileSync(MANAGERS_FILE, "utf8");
    return JSON.parse(data).managers || [];
  } catch {
    return [];
  }
}

function saveManagers(managers) {
  fs.writeFileSync(MANAGERS_FILE, JSON.stringify({ managers }, null, 2));
}

function isManager(id) {
  return loadManagers().some((m) => m.id === id);
}

function addManager(id, name = "Без імені") {
  const list = loadManagers();
  if (!list.some((m) => m.id === id)) {
    list.push({ id, name });
    saveManagers(list);
  }
}

function removeManager(id) {
  const updated = loadManagers().filter((m) => m.id !== id);
  saveManagers(updated);
}

function listManagers() {
  return loadManagers();
}
module.exports = {
  isManager,
  addManager,
  removeManager,
  listManagers,
};
