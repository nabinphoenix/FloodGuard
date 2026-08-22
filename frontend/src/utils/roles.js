export const VIEW_MODES = ["admin", "authority", "field_officer", "citizen"];

export const VIEW_MODE_LABELS = {
  admin: "Admin",
  authority: "Authority",
  field_officer: "Field Officer",
  citizen: "Citizen",
};

export function canAccess(realRole, allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (realRole === "admin") return true;
  return roles.includes(realRole);
}

export function viewModePath(viewMode) {
  switch (viewMode) {
    case "authority":
      return "/authority";
    case "field_officer":
      return "/sensors";
    case "citizen":
      return "/dashboard";
    case "admin":
    default:
      return "/admin";
  }
}
