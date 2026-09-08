/**
 * Keep in sync with hr-app/src/lib/greeting.ts
 */

function firstNameFromFullName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts[0] || "";
}

function successGreeting(fullName) {
  const first = firstNameFromFullName(fullName);
  if (!first) return "Bonne journée !";
  return `Bonjour ${first}, bonne journée !`;
}

function isNetworkErrorMessage(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("connexion impossible") ||
    m.includes("réseau") ||
    m.includes("network") ||
    m.includes("failed to fetch")
  );
}

module.exports = {
  firstNameFromFullName,
  successGreeting,
  isNetworkErrorMessage,
};
