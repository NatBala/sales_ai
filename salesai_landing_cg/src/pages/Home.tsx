import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { AgentPipeline } from "@/components/landing/AgentPipeline";
import { Features } from "@/components/landing/Features";
import { EngageSpotlight } from "@/components/landing/EngageSpotlight";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { StatsBar } from "@/components/landing/StatsBar";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-white">
      <Navbar />
      <Hero />
      <AgentPipeline />
      <Features />
      <EngageSpotlight />
      <HowItWorks />
      <StatsBar />
      <CTA />
      <Footer />
    </main>
  );
}
