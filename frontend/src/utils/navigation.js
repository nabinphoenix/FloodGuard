export function dashboardPathForRole(role) {
  switch (role) {
    case "admin":
      return "/admin";
    case "authority":
      return "/authority";
    case "field_officer":
      return "/sensors";
    case "public":
    default:
      return "/dashboard";
  }
}
