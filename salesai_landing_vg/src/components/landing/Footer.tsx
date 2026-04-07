import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-12 border-t border-white/10 bg-background relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <span className="font-display font-bold text-lg text-white">Sales AI Hub</span>
        </div>

        <div className="text-sm text-muted-foreground text-center md:text-left">
          &copy; 2026 Vanguard. Built exclusively for internal sales teams.
        </div>

        <div className="flex gap-6">
          <a href="#" className="text-sm text-muted-foreground hover:text-white transition-colors">Privacy</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-white transition-colors">Terms</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-white transition-colors">Support</a>
        </div>
      </div>
    </footer>
  );
}
