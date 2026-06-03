import { ContactForm } from "@/components/contact-form"

export function ContactSection() {
  return (
    <section id="contact" className="relative overflow-hidden py-20 sm:py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3453a7]/15 to-transparent" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-14">
          <h2 className="text-3xl font-black leading-tight text-[#1a2332] sm:text-4xl md:text-5xl">
            تواصل معنا
          </h2>
        </div>

        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_14px_36px_rgba(19,39,89,0.08)] sm:p-10 lg:p-12">
          <ContactForm />
        </div>
      </div>
    </section>
  )
}