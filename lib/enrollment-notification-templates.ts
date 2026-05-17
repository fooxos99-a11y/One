export const ENROLLMENT_NOTIFICATION_SETTINGS_ID = "enrollment_guardian_notification_templates"

export type EnrollmentNotificationTemplates = {
  finalAccept: string
  provisionalAccept: string
  reject: string
}

type SupabaseLike = {
  from: (table: string) => any
}

export const DEFAULT_ENROLLMENT_NOTIFICATION_TEMPLATES: EnrollmentNotificationTemplates = {
  finalAccept: "نفيدكم بقبول الطالب {student_name} نهائيًا في المجمع، وتم تسجيله في حلقة {circle_name}.",
  provisionalAccept: "نفيدكم بقبول الطالب {student_name} قبولًا مبدئيًا في المجمع، وسيتم التواصل معكم لاحقًا لاستكمال الإجراءات.",
  reject: "نفيدكم بعدم قبول الطالب {student_name} في طلب الالتحاق بالمجمع. نسأل الله له التوفيق.",
}

export function normalizeEnrollmentNotificationTemplates(value: unknown): EnrollmentNotificationTemplates {
  const candidate = value && typeof value === "object" ? value as Partial<EnrollmentNotificationTemplates> & { accept?: string } : {}

  return {
    finalAccept:
      typeof candidate.finalAccept === "string" && candidate.finalAccept.trim()
        ? candidate.finalAccept.trim()
        : typeof candidate.accept === "string" && candidate.accept.trim()
          ? candidate.accept.trim()
          : DEFAULT_ENROLLMENT_NOTIFICATION_TEMPLATES.finalAccept,
    provisionalAccept:
      typeof candidate.provisionalAccept === "string" && candidate.provisionalAccept.trim()
        ? candidate.provisionalAccept.trim()
        : DEFAULT_ENROLLMENT_NOTIFICATION_TEMPLATES.provisionalAccept,
    reject:
      typeof candidate.reject === "string" && candidate.reject.trim()
        ? candidate.reject.trim()
        : DEFAULT_ENROLLMENT_NOTIFICATION_TEMPLATES.reject,
  }
}

export async function getEnrollmentNotificationTemplates(supabase: SupabaseLike) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("id", ENROLLMENT_NOTIFICATION_SETTINGS_ID)
    .maybeSingle()

  if (error) {
    if (`${error.message || ""}`.includes("site_settings") || error.code === "42P01") {
      return DEFAULT_ENROLLMENT_NOTIFICATION_TEMPLATES
    }

    throw error
  }

  if (data?.value == null) {
    return DEFAULT_ENROLLMENT_NOTIFICATION_TEMPLATES
  }

  return normalizeEnrollmentNotificationTemplates(data.value)
}

export async function saveEnrollmentNotificationTemplates(
  supabase: SupabaseLike,
  templates: EnrollmentNotificationTemplates,
) {
  const normalizedTemplates = normalizeEnrollmentNotificationTemplates(templates)

  const { error } = await supabase
    .from("site_settings")
    .upsert({ id: ENROLLMENT_NOTIFICATION_SETTINGS_ID, value: normalizedTemplates }, { onConflict: "id" })

  if (error) throw error

  return normalizedTemplates
}

export function fillEnrollmentNotificationTemplate(
  template: string,
  params: {
    studentName: string
    circleName?: string | null
  },
) {
  return template
    .replaceAll("{student_name}", params.studentName)
    .replaceAll("{circle_name}", params.circleName || "")
}