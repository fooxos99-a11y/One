import { cookies } from "next/headers"

import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { GoalsSection } from "@/components/goals-section"
import { ContactSection } from "@/components/contact-section"
import { AboutSection } from "@/components/about-section"
import { Footer } from "@/components/footer"
import { SESSION_COOKIE_NAME, verifySignedSessionToken } from "@/lib/auth/session"

export default async function Home() {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  await verifySignedSessionToken(sessionCookie)

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
