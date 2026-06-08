import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { AboutSection } from "@/components/landing/AboutSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "SCENEIQ — AI-Powered FIR Scene Reconstruction" },
      { name: "description", content: "Upload any FIR narrative. Our AI extracts every actor, location, and event — and renders a 3D animated scene reconstruction in under 30 seconds." },
    ],
  }),
});

function LandingPage() {
  return (
    <div className="noise-overlay min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <PoliceStrip />
      <AboutSection />
      <FeaturesSection />
      <HowItWorksSection />
      <Footer />
    </div>
  );
}

import { POLICE_PROVINCES, PoliceShield } from "@/components/PoliceShield";

function PoliceStrip() {
  return (
    <div className="relative z-10 border-y border-subtle bg-[oklch(0.06_0.005_60)/0.7] py-10 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-6">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-gold/80">
          Processes FIR text from
        </p>
        <div className="mt-6 flex flex-wrap items-end justify-center gap-x-10 gap-y-6">
          {POLICE_PROVINCES.map((p) => (
            <div key={p.key} className="flex flex-col items-center gap-2">
              <PoliceShield province={p.key} size={56} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
                {p.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[11px] text-text-muted">
          and all provincial systems
        </p>
      </div>
    </div>
  );
}
