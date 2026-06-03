import { getSiteSetting } from "@/lib/site-settings"
import { DEFAULT_GOALS_SECTION_SETTINGS, GOALS_SECTION_SETTINGS_ID } from "@/lib/site-settings-constants"
import { ICON_MAP, normalizeGoalItems } from "@/components/goals-section-config"
import { GoalsSectionEditor } from "@/components/goals-section-editor"

export async function GoalsSection() {
  const items = normalizeGoalItems(await getSiteSetting(GOALS_SECTION_SETTINGS_ID, DEFAULT_GOALS_SECTION_SETTINGS))

  return (
    <section id="achievements" className="relative overflow-hidden py-20 sm:py-24">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#0f2f6d_0%,#1f4d9a_58%,#2e7fb6_100%)]" aria-hidden />
      <div className="absolute inset-0 opacity-[0.08]" aria-hidden style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)', backgroundSize: '28px 28px' }} />
      <div className="absolute -right-24 top-10 h-72 w-72 rounded-full border border-white/10" aria-hidden />
      <div className="absolute -left-20 bottom-10 h-56 w-56 rounded-full border border-white/10" aria-hidden />

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-3xl text-center text-white sm:mb-16">
          <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl md:text-5xl">
            إنجازتنا
          </h2>
        </div>

        <GoalsSectionEditor initialItems={items} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {items.map((item, index) => {
            const Icon = ICON_MAP[item.icon] || ICON_MAP.users

            return (
            <div
              key={`${item.label}-${index}`}
              className="rounded-[2rem] border border-white/12 bg-white/10 px-6 py-8 text-center shadow-[0_24px_60px_rgba(3,16,46,0.14)] backdrop-blur-md transition-transform duration-300 hover:-translate-y-1.5 hover:bg-white/[0.14] sm:px-7"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]">
                <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>

              <p className="mb-4 text-sm font-bold text-white/80 sm:text-base">{item.label}</p>
              <p className="text-4xl font-black tracking-[0.04em] text-white sm:text-5xl">{item.value}</p>
              <p className="mt-3 text-sm font-medium text-white/60">{item.caption}</p>
            </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}