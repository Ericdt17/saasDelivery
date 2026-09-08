/** Keep in sync with server/src/lib/hrGreeting.js */

export function firstNameFromFullName(fullName: string): string {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts[0] || "";
}

export function successGreeting(fullName: string): string {
  const first = firstNameFromFullName(fullName);
  if (!first) return "Bonne journée !";
  return `Bonjour ${first}, bonne journée !`;
}

export function isNetworkErrorMessage(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("connexion impossible") ||
    m.includes("réseau") ||
    m.includes("network") ||
    m.includes("failed to fetch")
  );
}
