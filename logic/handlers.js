const fs = require('fs');
const sessionsFile = './data/sessions.json';

function loadSessions() {
  if (!fs.existsSync(sessionsFile)) return {};
  return JSON.parse(fs.readFileSync(sessionsFile));
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
  return Object.keys(sessions).find(key => sessions[key] == managerId);
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
  removeSession
};
