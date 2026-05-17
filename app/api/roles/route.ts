import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminPermission, requireRoles } from "@/lib/auth/guards"
import { DEFAULT_ADMIN_ROLE_SETTINGS, ROLES_SETTINGS_ID, normalizeAdminRoleSettings } from "@/lib/admin-role-settings"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const auth = await requireRoles(request, ["admin", "supervisor"])
    if ("response" in auth) {
      return auth.response
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("programs")
      .select("description")
      .eq("id", ROLES_SETTINGS_ID)
      .maybeSingle()

    if (error) {
      return NextResponse.json(DEFAULT_ADMIN_ROLE_SETTINGS)
    }

    if (data && data.description) {
      try {
        return NextResponse.json(normalizeAdminRoleSettings(JSON.parse(data.description)))
      } catch {
        return NextResponse.json(DEFAULT_ADMIN_ROLE_SETTINGS)
      }
    }

    return NextResponse.json(DEFAULT_ADMIN_ROLE_SETTINGS)
  } catch {
    return NextResponse.json(DEFAULT_ADMIN_ROLE_SETTINGS)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermission(request, "الصلاحيات")
    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminClient()
    const body = await request.json()
    
    // Upsert into programs
    const { error } = await supabase
      .from("programs")
      .upsert({
        id: ROLES_SETTINGS_ID,
        name: 'ROLES_SETTINGS',
        is_active: true,
        date: 'settings',
        duration: 'settings',
        points: 0,
        description: JSON.stringify(body)
      })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdminPermission(request, "الصلاحيات")
    if ("response" in auth) {
      return auth.response
    }

    const body = await request.json()
    const oldRole = String(body.oldRole || "").trim()
    const newRole = String(body.newRole || "").trim()

    if (!oldRole || !newRole) {
      return NextResponse.json({ error: "المسمى القديم والجديد مطلوبان" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("programs")
      .select("description")
      .eq("id", ROLES_SETTINGS_ID)
      .maybeSingle()

    if (error) {
      throw error
    }

    const parsed = data?.description ? normalizeAdminRoleSettings(JSON.parse(data.description)) : DEFAULT_ADMIN_ROLE_SETTINGS
    const currentRoles = parsed.roles
    const currentPermissions = parsed.permissions

    if (!currentRoles.includes(oldRole)) {
      return NextResponse.json({ error: "المسمى القديم غير موجود" }, { status: 404 })
    }

    if (oldRole !== newRole && currentRoles.includes(newRole)) {
      return NextResponse.json({ error: "المسمى الجديد موجود مسبقاً" }, { status: 400 })
    }

    const updatedRoles = currentRoles.map((role: string) => (role === oldRole ? newRole : role))
    const updatedPermissions = { ...currentPermissions }
    updatedPermissions[newRole] = updatedPermissions[oldRole] || []
    if (oldRole !== newRole) {
      delete updatedPermissions[oldRole]
    }

    const { error: settingsError } = await supabase
      .from("programs")
      .upsert({
        id: ROLES_SETTINGS_ID,
        name: "ROLES_SETTINGS",
        is_active: true,
        date: "settings",
        duration: "settings",
        points: 0,
        description: JSON.stringify({ roles: updatedRoles, permissions: updatedPermissions }),
      })

    if (settingsError) {
      throw settingsError
    }

    if (oldRole !== newRole) {
      const { error: usersError } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("role", oldRole)

      if (usersError) {
        throw usersError
      }
    }

    return NextResponse.json({ success: true, roles: updatedRoles, permissions: updatedPermissions })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
