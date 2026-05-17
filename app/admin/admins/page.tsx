"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SiteLoader } from "@/components/ui/site-loader"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useConfirmDialog, useAlertDialog } from "@/hooks/use-confirm-dialog"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { Plus, ShieldCheck, Trash2, User, X } from "lucide-react"

const DEFAULT_ROLES = ["سكرتير", "مشرف تعليمي", "مشرف تربوي", "مشرف برامج"]

type PermissionsMap = Record<string, string[]>

type AdminUser = {
  id: string
  name: string
  account_number: number | string
  phone_number?: string | null
  id_number?: string | null
  role: string
}

type AdminUserForm = {
  name: string
  account_number: string
  phone_number: string
  id_number: string
  role: string
}

const EMPTY_FORM: AdminUserForm = {
  name: "",
  account_number: "",
  phone_number: "",
  id_number: "",
  role: DEFAULT_ROLES[0],
}

export default function AdminsManagementPage() {
  return <AdminsManagementContent displayMode="page" />
}

export function AdminsManagementContent({
  displayMode = "page",
  onInlineActionsChange,
}: {
  displayMode?: "page" | "inline"
  onInlineActionsChange?: (actions: { openRoleForm: () => void; openAdminForm: () => void }) => void
}) {
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("الهيكل الإداري")
  const confirmDialog = useConfirmDialog()
  const showAlert = useAlertDialog()

  const [isBootLoading, setIsBootLoading] = useState(true)
  const [isSubmittingUser, setIsSubmittingUser] = useState(false)
  const [isSubmittingRole, setIsSubmittingRole] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES)
  const [permissions, setPermissions] = useState<PermissionsMap>({})
  const [form, setForm] = useState<AdminUserForm>(EMPTY_FORM)
  const [newRoleName, setNewRoleName] = useState("")
  const [activeInlineView, setActiveInlineView] = useState<"role" | "admin" | null>(null)

  const fetchData = async () => {
    setIsBootLoading(true)
    try {
      const [usersResponse, rolesResponse] = await Promise.all([
        fetch("/api/admin-users", { cache: "no-store" }),
        fetch("/api/roles", { cache: "no-store" }),
      ])

      const [usersPayload, rolesPayload] = await Promise.all([
        usersResponse.json().catch(() => ({})),
        rolesResponse.json().catch(() => ({})),
      ])

      const nextUsers = Array.isArray(usersPayload.users) ? usersPayload.users : []
      const nextRoles = Array.isArray(rolesPayload.roles)
        ? rolesPayload.roles.filter((role: string) => role !== "مدير")
        : DEFAULT_ROLES
      const nextPermissions = (rolesPayload.permissions || {}) as PermissionsMap
      const normalizedPermissions: PermissionsMap = {}

      nextRoles.forEach((role: string) => {
        normalizedPermissions[role] = Array.isArray(nextPermissions[role]) ? nextPermissions[role] : []
      })

      setUsers(nextUsers)
      setRoles(nextRoles)
      setPermissions(normalizedPermissions)
      setForm((current) => ({
        ...current,
        role: nextRoles.includes(current.role) ? current.role : nextRoles[0] || DEFAULT_ROLES[0],
      }))
    } catch (error) {
      console.error("[admins] fetchData:", error)
      await showAlert("تعذر تحميل بيانات الهيكل الإداري", "خطأ")
    } finally {
      setIsBootLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && authVerified) {
      void fetchData()
    }
  }, [authLoading, authVerified])

  useEffect(() => {
    if (!onInlineActionsChange) {
      return
    }

    onInlineActionsChange({
      openRoleForm: () => setActiveInlineView("role"),
      openAdminForm: () => setActiveInlineView("admin"),
    })
  }, [onInlineActionsChange])

  const handleFormChange = (key: keyof AdminUserForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const resetAdminForm = () => {
    setForm({ ...EMPTY_FORM, role: roles[0] || DEFAULT_ROLES[0] })
  }

  const closeInlineView = () => {
    setActiveInlineView(null)
  }

  const handleSaveUser = async () => {
    if (!form.name.trim() || !form.account_number.trim() || !form.role.trim()) {
      await showAlert("الاسم ورقم الحساب والمسمى الوظيفي مطلوبة", "تنبيه")
      return
    }

    setIsSubmittingUser(true)
    try {
      const response = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          account_number: form.account_number,
          phone_number: form.phone_number,
          id_number: form.id_number,
          role: form.role,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        await showAlert(payload?.error || "تعذر حفظ بيانات المستخدم", "خطأ")
        return
      }

      resetAdminForm()
      closeInlineView()
      await fetchData()
    } catch (error) {
      console.error("[admins] handleSaveUser:", error)
      await showAlert("حدث خطأ أثناء حفظ المستخدم", "خطأ")
    } finally {
      setIsSubmittingUser(false)
    }
  }

  const persistRoles = async (nextRoles: string[], nextPermissions: PermissionsMap) => {
    const response = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roles: ["مدير", ...nextRoles],
        permissions: { مدير: ["all"], ...nextPermissions },
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.error || "تعذر حفظ المسميات")
    }
  }

  const handleAddRole = async () => {
    const normalizedRole = newRoleName.trim()
    if (!normalizedRole) {
      await showAlert("اكتب اسم المسمى أولاً", "تنبيه")
      return
    }

    if (roles.includes(normalizedRole)) {
      await showAlert("هذا المسمى موجود بالفعل", "تنبيه")
      return
    }

    setIsSubmittingRole(true)
    try {
      const nextRoles = [...roles, normalizedRole]
      const nextPermissions = { ...permissions, [normalizedRole]: [] }
      await persistRoles(nextRoles, nextPermissions)
      setNewRoleName("")
      closeInlineView()
      await fetchData()
    } catch (error) {
      console.error("[admins] handleAddRole:", error)
      await showAlert(error instanceof Error ? error.message : "تعذر إضافة المسمى", "خطأ")
    } finally {
      setIsSubmittingRole(false)
    }
  }

  const handleDeleteRole = async (role: string) => {
    if (users.some((user) => user.role === role)) {
      await showAlert("لا يمكن حذف هذا المسمى لأنه مستخدم في حسابات حالية", "تنبيه")
      return
    }

    const confirmed = await confirmDialog({
      title: "حذف المسمى",
      description: `سيتم حذف المسمى الوظيفي "${role}" من القائمة.`,
      confirmText: "حذف المسمى",
      cancelText: "إلغاء",
    })

    if (!confirmed) {
      return
    }

    setIsSubmittingRole(true)
    try {
      const nextRoles = roles.filter((item) => item !== role)
      const nextPermissions = { ...permissions }
      delete nextPermissions[role]
      await persistRoles(nextRoles, nextPermissions)
      await fetchData()
    } catch (error) {
      console.error("[admins] handleDeleteRole:", error)
      await showAlert(error instanceof Error ? error.message : "تعذر حذف المسمى", "خطأ")
    } finally {
      setIsSubmittingRole(false)
    }
  }

  const handleDeleteUser = async (user: AdminUser) => {
    const confirmed = await confirmDialog({
      title: "حذف الإداري",
      description: `سيتم حذف ${user.name} من الهيكل الإداري نهائياً.`,
      confirmText: "حذف الإداري",
      cancelText: "إلغاء",
    })

    if (!confirmed) return

    try {
      const response = await fetch(`/api/admin-users?id=${encodeURIComponent(user.id)}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        await showAlert(payload?.error || "تعذر حذف الإداري", "خطأ")
        return
      }

      await fetchData()
    } catch (error) {
      console.error("[admins] handleDeleteUser:", error)
      await showAlert("حدث خطأ أثناء حذف الإداري", "خطأ")
    }
  }

  if (authLoading || !authVerified || isBootLoading) {
    return (
      <div className={`${displayMode === "inline" ? "min-h-[320px]" : "min-h-screen"} flex items-center justify-center bg-[#fafaf9]`}>
        <SiteLoader size="md" />
      </div>
    )
  }

  return (
    <div className={`${displayMode === "inline" ? "bg-transparent" : "min-h-screen bg-[#fafaf9]"} flex flex-col`} dir="rtl">
      {displayMode === "inline" ? null : <Header />}
      <main className={`flex-1 ${displayMode === "inline" ? "px-0 py-0" : "px-4 py-10"}`}>
        <div className="mx-auto max-w-5xl space-y-8">
          <div className={`flex items-center justify-between ${displayMode === "inline" ? "pb-0" : "border-b border-[#3453a7]/40 pb-6"}`}>
            {displayMode === "inline" ? <div /> : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3453a7]/10 border border-[#3453a7]/40 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#3453a7]" />
                </div>
                <h1 className="text-2xl font-bold text-[#1a2332]">الهيكل الإداري</h1>
              </div>
            )}

            {displayMode === "inline" ? <div /> : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-[#d8e5fb] bg-white px-5 text-sm font-bold text-[#3453a7] shadow-[0_10px_30px_rgba(52,83,167,0.08)] transition-all hover:bg-[#f6f9ff]"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[220px] rounded-[1.25rem] border border-[#dfe7f5] bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                  <DropdownMenuItem onClick={() => setActiveInlineView("role")} className="cursor-pointer justify-end rounded-[1rem] px-4 py-3 text-right font-bold text-[#1f2a3d] focus:bg-[#f5f8fd] focus:text-[#20335f]">
                    إضافة مسمى
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveInlineView("admin")} className="cursor-pointer justify-end rounded-[1rem] px-4 py-3 text-right font-bold text-[#1f2a3d] focus:bg-[#f5f8fd] focus:text-[#20335f]">
                    إضافة إداري
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {activeInlineView === "role" ? (
            <div className="min-h-[720px] bg-[radial-gradient(circle_at_top,rgba(143,176,255,0.16),transparent_42%),linear-gradient(180deg,#f7faff_0%,#eef5ff_100%)] px-5 py-3 md:px-8 md:py-4">
              <div className="mx-auto max-w-[820px] overflow-hidden rounded-[2rem] border border-[#e5edf8] bg-white shadow-[0_20px_55px_rgba(15,23,42,0.06)]">
                <div className="space-y-5 px-6 py-8 md:px-10">
                  <div className="space-y-1.5">
                    <label className="text-lg font-semibold text-[#1a2332]">اسم المسمى</label>
                    <Input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="مثال: مشرف تقني" className="h-14 rounded-[1.25rem] border-[#d8e3f2] bg-white px-5 text-lg focus-visible:border-[#bfd0ea] focus-visible:ring-[#3453a7]/20" />
                  </div>

                  <div className="space-y-3">
                    <label className="text-lg font-semibold text-[#1a2332]">المسميات الحالية</label>
                    <div className="flex flex-wrap gap-2">
                      {roles.map((role) => (
                        <div key={role} className="inline-flex items-center gap-2 rounded-full border border-[#d8e5fb] bg-white px-4 py-2 text-sm font-bold text-[#3453a7] shadow-[0_8px_22px_rgba(52,83,167,0.06)]">
                          <span>{role}</span>
                          <button type="button" onClick={() => void handleDeleteRole(role)} className="rounded-full p-1 text-red-500 transition-colors hover:bg-red-50" aria-label={`حذف ${role}`}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 pt-4 md:px-10 md:pb-8">
                  <Button onClick={handleAddRole} disabled={!newRoleName.trim() || isSubmittingRole} className="h-14 w-full rounded-[1.25rem] border-none bg-[#3453a7] text-xl font-bold text-white hover:bg-[#24428f] disabled:cursor-not-allowed disabled:bg-[#dbe3f3] disabled:text-[#8a97b5] disabled:shadow-none disabled:hover:bg-[#dbe3f3] disabled:opacity-100">
                    {isSubmittingRole ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                  <button type="button" onClick={closeInlineView} className="mt-4 w-full text-center text-sm font-semibold text-[#6c7d95] transition-colors hover:text-[#3453a7]">
                    رجوع
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeInlineView === "admin" ? (
            <div className="min-h-[720px] bg-[radial-gradient(circle_at_top,rgba(143,176,255,0.16),transparent_42%),linear-gradient(180deg,#f7faff_0%,#eef5ff_100%)] px-5 py-3 md:px-8 md:py-4">
              <div className="mx-auto max-w-[820px] overflow-hidden rounded-[2rem] border border-[#e5edf8] bg-white shadow-[0_20px_55px_rgba(15,23,42,0.06)]">
                <div className="space-y-5 px-6 py-8 md:px-10">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-lg font-semibold text-[#1a2332]">اسم الإداري</label>
                      <Input value={form.name} onChange={(event) => handleFormChange("name", event.target.value)} placeholder="الاسم الكامل" className="h-14 rounded-[1.25rem] border-[#d8e3f2] bg-white px-5 text-lg focus-visible:border-[#bfd0ea] focus-visible:ring-[#3453a7]/20" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-lg font-semibold text-[#1a2332]">رقم الحساب</label>
                      <Input value={form.account_number} onChange={(event) => handleFormChange("account_number", event.target.value)} placeholder="00000" className="h-14 rounded-[1.25rem] border-[#d8e3f2] bg-white px-5 text-lg focus-visible:border-[#bfd0ea] focus-visible:ring-[#3453a7]/20" dir="ltr" inputMode="numeric" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-lg font-semibold text-[#1a2332]">رقم الهوية</label>
                      <Input value={form.id_number} onChange={(event) => handleFormChange("id_number", event.target.value)} placeholder="1xxxxxxxxx" className="h-14 rounded-[1.25rem] border-[#d8e3f2] bg-white px-5 text-lg focus-visible:border-[#bfd0ea] focus-visible:ring-[#3453a7]/20" dir="ltr" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-lg font-semibold text-[#1a2332]">رقم الجوال</label>
                      <Input value={form.phone_number} onChange={(event) => handleFormChange("phone_number", event.target.value)} placeholder="اختياري" className="h-14 rounded-[1.25rem] border-[#d8e3f2] bg-white px-5 text-lg focus-visible:border-[#bfd0ea] focus-visible:ring-[#3453a7]/20" dir="ltr" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-lg font-semibold text-[#1a2332]">المسمى الوظيفي</label>
                    <Select value={form.role} onValueChange={(value) => handleFormChange("role", value)}>
                      <SelectTrigger className="h-14 rounded-[1.25rem] border-[#d8e3f2] bg-white px-5 text-lg focus:border-[#bfd0ea]">
                        <SelectValue placeholder="اختر المسمى" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="px-6 py-4 pt-4 md:px-10 md:pb-8">
                  <Button onClick={handleSaveUser} disabled={!form.name.trim() || !form.account_number.trim() || !form.role.trim() || isSubmittingUser} className="h-14 w-full rounded-[1.25rem] border-none bg-[#3453a7] text-xl font-bold text-white hover:bg-[#24428f] disabled:cursor-not-allowed disabled:bg-[#dbe3f3] disabled:text-[#8a97b5] disabled:shadow-none disabled:hover:bg-[#dbe3f3] disabled:opacity-100">
                    {isSubmittingUser ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                  <button type="button" onClick={() => { resetAdminForm(); closeInlineView() }} className="mt-4 w-full text-center text-sm font-semibold text-[#6c7d95] transition-colors hover:text-[#3453a7]">
                    رجوع
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeInlineView ? null : users.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#3453a7]/40 shadow-sm p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#3453a7]/10 border border-[#3453a7]/30 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-[#3453a7]" />
              </div>
              <p className="text-lg font-semibold text-neutral-500">لا يوجد إداريون حالياً</p>
              <p className="text-sm text-neutral-400 mt-1">قم بإضافة إداري جديد للبدء</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#3453a7]/40 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-[#3453a7]/40 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#3453a7]/10 border border-[#3453a7]/30 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-[#3453a7]" />
                </div>
                <h2 className="text-base font-bold text-[#1a2332]">قائمة الإداريين</h2>
              </div>
              <div className="divide-y divide-[#3453a7]/20">
                {users.map((user) => (
                  <div key={user.id} className="px-6 py-5 hover:bg-[#3453a7]/3 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-[#3453a7]/15 border border-[#3453a7]/40 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-[#3453a7]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-bold text-[#1a2332] truncate">{user.name}</p>
                            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#3453a7]/15 text-[#4f73d1]">
                              {user.role}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => void handleDeleteUser(user)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 text-sm font-medium transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          إزالة
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      {displayMode === "inline" ? null : <Footer />}
    </div>
  )
}
