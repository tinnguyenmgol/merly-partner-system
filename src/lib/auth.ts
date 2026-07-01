export type SessionRole = "partner" | "admin";
export async function requireRole(_role: SessionRole) { return { userId: "placeholder", role: _role }; }
