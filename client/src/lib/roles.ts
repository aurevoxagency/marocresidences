export const ROLE_IDS = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  CLIENT: 3,
  RECEPTIONNISTE: 4,
} as const;

export const ROLE_LABELS: Record<number, string> = {
  1: "Super admin",
  2: "Admin",
  3: "Client",
  4: "Réceptionniste",
};

export function isAdminRole(roleId: number | null | undefined) {
  return roleId === ROLE_IDS.SUPER_ADMIN || roleId === ROLE_IDS.ADMIN;
}

export function canManageMaisons(roleId: number | null | undefined) {
  return (
    roleId === ROLE_IDS.SUPER_ADMIN ||
    roleId === ROLE_IDS.ADMIN ||
    roleId === ROLE_IDS.RECEPTIONNISTE
  );
}

export function getRoleLabel(roleId: number | null | undefined) {
  if (!roleId) {
    return "—";
  }

  return ROLE_LABELS[roleId] || `Rôle ${roleId}`;
}
