import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export function Navbar() {
  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 pt-6 pb-4"
    >
      <div className="max-w-7xl mx-auto">
        <div className="glass-panel rounded-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shadow-glow">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-white">
              Sales AI Hub
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#agents" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Agents</a>
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">How it Works</a>
          </div>

          <a
            href="https://calm-grass-06c54321e.6.azurestaticapps.net"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 rounded-xl bg-white text-background font-semibold text-sm hover:bg-blue-50 hover:scale-105 active:scale-95 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          >
            Launch App
          </a>
        </div>
      </div>
    </motion.nav>
  );
}
