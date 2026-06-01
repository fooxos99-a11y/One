import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { GoalsSection } from "@/components/goals-section"
import { ContactSection } from "@/components/contact-section"
import { AboutSection } from "@/components/about-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="landing-page-surface min-h-screen overflow-x-hidden" dir="rtl">
      <Header />
      <main>
        <HeroSection />
        <div className="min-h-screen bg-transparent">
          <AboutSection />
          <GoalsSection />
          <ContactSection />
        </div>
      </main>
      <Footer />
    </div>
  )
}
