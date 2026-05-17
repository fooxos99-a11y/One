export const ROLES_SETTINGS_ID = "00000000-0000-0000-0000-000000000001"

export type AdminRoleSettings = {
  roles: string[]
  permissions: Record<string, string[]>
}

export const DEFAULT_ADMIN_ROLE_SETTINGS: AdminRoleSettings = {
  roles: ["مدير", "سكرتير", "مشرف تعليمي", "مشرف تربوي", "مشرف برامج"],
  permissions: {
    "مدير": ["all"],
    "سكرتير": [],
    "مشرف تعليمي": [],
    "مشرف تربوي": [],
    "مشرف برامج": [],
  },
}

export function normalizeAdminRoleSettings(value: unknown): AdminRoleSettings {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const roles = Array.isArray(candidate.roles)
    ? candidate.roles.map((role) => String(role || "").trim()).filter(Boolean)
    : DEFAULT_ADMIN_ROLE_SETTINGS.roles

  const rawPermissions = candidate.permissions && typeof candidate.permissions === "object"
    ? (candidate.permissions as Record<string, unknown>)
    : DEFAULT_ADMIN_ROLE_SETTINGS.permissions

  const permissions = Object.fromEntries(
    Object.entries(rawPermissions).map(([role, granted]) => [
      String(role || "").trim(),
      Array.isArray(granted)
        ? granted.map((permission) => String(permission || "").trim()).filter(Boolean)
        : [],
    ]),
  )

  return {
    roles: roles.length > 0 ? roles : DEFAULT_ADMIN_ROLE_SETTINGS.roles,
    permissions: Object.keys(permissions).length > 0 ? permissions : DEFAULT_ADMIN_ROLE_SETTINGS.permissions,
  }
}