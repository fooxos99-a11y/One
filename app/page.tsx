import dynamic from "next/dynamic"
import { HeroSection } from "@/components/hero-section"
import { LandingFooter } from "@/components/landing-footer"
import { LandingHeader } from "@/components/landing-header"

const GoalsSection = dynamic(() => import("@/components/goals-section").then((module) => module.GoalsSection))
const ContactSection = dynamic(() => import("@/components/contact-section").then((module) => module.ContactSection))

export default function Home() {
  return (
    <div className="landing-page-surface min-h-screen overflow-x-hidden" dir="rtl">
      <LandingHeader />
      <main>
        <HeroSection />
        <div className="min-h-screen bg-transparent">
          <GoalsSection />
          <ContactSection />
        </div>
      </main>
      <LandingFooter />
    </div>
  )
}
