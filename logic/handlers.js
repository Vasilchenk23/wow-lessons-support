const fs = require("fs");
const sessionsFile = "./data/sessions.json";

function loadSessions() {
  if (!fs.existsSync(sessionsFile)) return {};

  const raw = fs.readFileSync(sessionsFile, "utf8");

  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("[❌] Помилка у sessions.json:", err.message);
    return {};
  }
}

function saveSessions(sessions) {
  fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
}

function assignClient(clientId, managerId) {
  const sessions = loadSessions();
  sessions[clientId] = managerId;
  saveSessions(sessions);
}

function getManagerByClient(clientId) {
  const sessions = loadSessions();
  return sessions[clientId];
}

function getClientByManager(managerId) {
  const sessions = loadSessions();
  return Object.keys(sessions).find((key) => sessions[key] == managerId);
}

function removeSession(clientId) {
  const sessions = loadSessions();
  delete sessions[clientId];
  saveSessions(sessions);
}

module.exports = {
  loadSessions,
  assignClient,
  getManagerByClient,
  getClientByManager,
  removeSession,
};
