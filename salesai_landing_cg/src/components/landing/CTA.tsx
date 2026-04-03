import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-32 relative z-10 bg-background overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-panel p-12 md:p-20 rounded-[2.5rem] border border-white/10 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            Ready to transform <br/> your sales process?
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Step into the future of financial services sales. Access all six Capital Group AI agents today.
          </p>

          <a
            href="https://jolly-cliff-04bac391e.6.azurestaticapps.net"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-10 py-5 bg-white text-background rounded-2xl font-bold text-lg hover:scale-105 active:scale-95 hover:bg-blue-50 transition-all duration-200 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
