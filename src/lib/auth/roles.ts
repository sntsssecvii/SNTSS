import { ROLES, type UserRole } from "@/types/roles";

export function normalizeUserRole(role?: string | null): string {
  return (role || "").trim().toUpperCase();
}

export function isSuperAdminRole(role?: string | null): boolean {
  return normalizeUserRole(role) === ROLES.SUPER_ADMIN;
}

export function isAdminRole(role?: string | null): boolean {
  const normalized = normalizeUserRole(role);
  return (
    normalized === ROLES.ADMIN ||
    normalized === ROLES.SUPER_ADMIN ||
    normalized === ROLES.BOLSA ||
    normalized === ROLES.ESCALAFON
  );
}

export function isBolsaRole(role?: string | null): boolean {
  return normalizeUserRole(role) === ROLES.BOLSA;
}

export function getHomeRouteForRole(role?: string | null): string | null {
  const normalized = normalizeUserRole(role);

  if (normalized === ROLES.SUPER_ADMIN) {
    return "/admin/global";
  }

  if (normalized === ROLES.ADMIN) {
    return "/admin";
  }

  if (normalized === ROLES.USER) {
    return "/dashboard";
  }

  if (normalized === ROLES.BOLSA) {
    return "/admin/bolsa-de-trabajo/dashboard";
  }

  if (normalized === ROLES.ESCALAFON) {
    return "/admin/escalafon";
  }

  return null;
}

export function getRoleLabel(role?: UserRole | string | null): string {
  const normalized = normalizeUserRole(role);

  switch (normalized) {
    case ROLES.SUPER_ADMIN:
      return "Admin Global";
    case ROLES.ADMIN:
      return "Administrador";
    case ROLES.REVISOR:
      return "Revisor";
    case ROLES.CAPTURISTA:
      return "Capturista";
    case ROLES.CONSULTA:
      return "Consulta";
    case ROLES.USER:
      return "Usuario";
    case ROLES.BOLSA:
      return "Bolsa de Trabajo";
    case ROLES.ESCALAFON:
      return "Escalafón";
    default:
      return normalized || "Sin rol";
  }
}
