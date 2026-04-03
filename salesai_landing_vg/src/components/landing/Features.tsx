import { motion } from "framer-motion";
import { MessageSquare, Phone, Zap, Target, Award, ListChecks } from "lucide-react";

const features = [
  {
    title: "Natural Language Search",
    description: "Find your ideal prospects instantly. Just type 'RIA firms over $200M with a fixed income gap' and let AI do the rest.",
    icon: SearchIcon,
  },
  {
    title: "AI Voice Calls (Maya)",
    description: "Meet Maya, your digital rep. She runs live outbound phone calls, handles objections, and books meetings directly to your calendar.",
    icon: Phone,
  },
  {
    title: "Real-Time ETF Detection",
    description: "Hold to capture during live meetings. When VTI, BND, or other core ETFs are mentioned, deep data panels appear instantly.",
    icon: Zap,
  },
  {
    title: "Live Roleplay Training",
    description: "Practice your pitch against a dynamically generated AI advisor persona that mimics real-world skepticism and firm types.",
    icon: Target,
  },
  {
    title: "Capital Way Scoring",
    description: "After every roleplay, get rigorously graded against the Capital Group Professional Engagement Framework with exact transcript feedback.",
    icon: Award,
  },
  {
    title: "Automated Follow-Up",
    description: "Dictate your post-meeting notes. The AI extracts actionable tasks, categorizes urgency, and drafts a warm, personalized email.",
    icon: ListChecks,
  },
];

// Helper for the first icon
function SearchIcon(props: any) {
  return <MessageSquare {...props} />;
}

export function Features() {
  return (
    <section id="features" className="py-24 relative z-10 bg-background overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <h2 className="text-sm font-semibold text-primary tracking-widest uppercase mb-3">Enterprise Capabilities</h2>
            <h3 className="text-3xl md:text-5xl font-bold mb-6">Intelligence at every<br/>touchpoint.</h3>
            <p className="text-muted-foreground text-lg">We didn't just build a CRM. We built a proactive sales partner that listens, analyzes, and helps you execute at the highest level.</p>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <div className="relative z-10 rounded-2xl border border-white/10 shadow-2xl h-[300px] w-full overflow-hidden bg-card/40 backdrop-blur-xl flex items-center justify-center">
              <svg viewBox="0 0 400 300" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                {/* Grid lines */}
                {[1,2,3,4,5].map(i => (
                  <line key={`h${i}`} x1="40" y1={i*45} x2="380" y2={i*45} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                ))}
                {[1,2,3,4,5,6,7].map(i => (
                  <line key={`v${i}`} x1={40+i*48} y1="20" x2={40+i*48} y2="270" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                ))}
                {/* Area chart fill */}
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(217,91%,60%)" stopOpacity="0.35"/>
                    <stop offset="100%" stopColor="hsl(217,91%,60%)" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M40,220 L88,180 L136,195 L184,130 L232,150 L280,90 L328,110 L376,60 L376,270 L40,270 Z" fill="url(#areaGrad)"/>
                {/* Line */}
                <polyline points="40,220 88,180 136,195 184,130 232,150 280,90 328,110 376,60" fill="none" stroke="hsl(217,91%,60%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Dots */}
                {[[40,220],[88,180],[136,195],[184,130],[232,150],[280,90],[328,110],[376,60]].map(([x,y],i) => (
                  <circle key={i} cx={x} cy={y} r="4" fill="hsl(217,91%,60%)" stroke="rgba(7,9,26,0.8)" strokeWidth="2"/>
                ))}
                {/* Bar chart (secondary) */}
                {[[60,240,50],[108,220,40],[156,200,60],[204,240,30],[252,210,55],[300,240,20],[348,225,45]].map(([x,y,h],i) => (
                  <rect key={i} x={x-10} y={y} width="20" height={h} rx="3" fill="rgba(99,179,237,0.15)" stroke="rgba(99,179,237,0.3)" strokeWidth="1"/>
                ))}
                {/* Labels */}
                <text x="40" y="290" fontSize="10" fill="rgba(255,255,255,0.3)" fontFamily="Inter,sans-serif">Q1</text>
                <text x="136" y="290" fontSize="10" fill="rgba(255,255,255,0.3)" fontFamily="Inter,sans-serif">Q2</text>
                <text x="232" y="290" fontSize="10" fill="rgba(255,255,255,0.3)" fontFamily="Inter,sans-serif">Q3</text>
                <text x="328" y="290" fontSize="10" fill="rgba(255,255,255,0.3)" fontFamily="Inter,sans-serif">Q4</text>
                {/* Top badge */}
                <rect x="270" y="25" width="110" height="28" rx="8" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.3)" strokeWidth="1"/>
                <circle cx="285" cy="39" r="4" fill="#4ade80"/>
                <text x="295" y="43" fontSize="10" fill="rgba(255,255,255,0.8)" fontFamily="Inter,sans-serif">+24% growth</text>
              </svg>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-panel p-8 rounded-2xl glass-panel-hover"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h4 className="text-xl font-bold text-white mb-3">{feature.title}</h4>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
