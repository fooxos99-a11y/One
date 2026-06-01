export function VisionSection() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-24">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#3453a7]/20 to-transparent" />
      <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-[#20335f]/8 blur-3xl" aria-hidden />
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-7 shadow-[0_22px_55px_rgba(19,39,89,0.09)] sm:p-10 lg:p-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#eaf1ff] px-4 py-1.5 text-sm font-semibold text-[#3453a7]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3453a7]" />
              رؤية المجمع
            </div>
            <h2 className="mb-5 text-3xl font-black leading-tight text-[#1a2332] sm:text-4xl md:text-5xl">
              صناعة جيل قرآني متميز علمًا وسلوكًا
            </h2>
            <p className="text-base leading-8 text-[#4d586c] sm:text-lg sm:leading-9 md:text-xl">              أن يكون المجمع بيئةً مثالية في تعليم كتاب الله تعالى، وتربية الطلاب على العلم والعمل والخلق، بما يسهم في
              صناعة جيل قرآني متميز علمًا وسلوكًا وعطاءً.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[1.75rem] border border-[#3453a7]/12 bg-white/80 p-6 shadow-[0_18px_45px_rgba(19,39,89,0.08)] backdrop-blur-sm">
              <div className="text-sm font-black text-[#3453a7]">تعليم متين</div>
              <p className="mt-3 text-sm leading-7 text-[#4d586c]">بناء أساس قوي في الحفظ والتلاوة والفهم من خلال متابعة منظمة ومستويات واضحة.</p>
            </div>
            <div className="rounded-[1.75rem] border border-[#3453a7]/12 bg-white/80 p-6 shadow-[0_18px_45px_rgba(19,39,89,0.08)] backdrop-blur-sm">
              <div className="text-sm font-black text-[#3453a7]">تربية وسلوك</div>
              <p className="mt-3 text-sm leading-7 text-[#4d586c]">غرس القيم والانضباط والمسؤولية ليظهر أثر القرآن في السلوك والعمل اليومي.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}