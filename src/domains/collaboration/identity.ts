const IDENTITY_KEY = "ascii-canvas-collaboration-identity";
const COLORS = ["#e5484d", "#30a46c", "#3e63dd", "#ab4aba", "#f76b15", "#0d9488"];

export type CollaborationIdentity = { id: string; name: string; color: string };

export const getCollaborationIdentity = (): CollaborationIdentity => {
  try {
    const stored = JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? "null") as Partial<CollaborationIdentity> | null;
    if (stored?.id && stored.name && stored.color) return stored as CollaborationIdentity;
  } catch { /* regenerate malformed local state */ }
  const id = crypto.randomUUID();
  const identity = {
    id,
    name: `Guest ${id.slice(0, 4).toUpperCase()}`,
    color: COLORS[Math.abs(id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % COLORS.length],
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
};

