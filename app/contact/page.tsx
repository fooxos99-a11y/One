import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ContactSection } from "@/components/contact-section"

export default function ContactPage() {  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <Header />
      <main className="flex-1 bg-white py-12 md:py-20">
        <div className="container mx-auto px-3 md:px-4">
          <ContactSection />        </div>
      </main>
      <Footer />
    </div>
  )
}