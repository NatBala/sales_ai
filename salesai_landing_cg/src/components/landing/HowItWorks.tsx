import { motion } from "framer-motion";

const steps = [
  {
    num: "01",
    title: "Discover & Connect",
    desc: "Query the database to find prime opportunities, then let Maya initiate contact via email or realistic AI voice call to secure the meeting."
  },
  {
    num: "02",
    title: "Prepare & Practice",
    desc: "Get a comprehensive brief on the client, then roleplay your pitch against a skeptical AI persona to sharpen your delivery before the real deal."
  },
  {
    num: "03",
    title: "Engage & Close",
    desc: "Run the real-time listener during your meeting for instant ETF insights, then instantly generate follow-up tasks and warm emails."
  }
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative z-10 bg-card/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">How it works</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
          {/* Connecting Line */}
          <div className="hidden lg:block absolute top-[3rem] left-[15%] right-[15%] h-px bg-white/10" />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="relative text-center"
            >
              <div className="w-24 h-24 mx-auto bg-background border-2 border-primary/30 rounded-full flex items-center justify-center mb-8 relative z-10 shadow-glow">
                <span className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-primary">{step.num}</span>
              </div>
              <h4 className="text-2xl font-bold text-white mb-4">{step.title}</h4>
              <p className="text-muted-foreground leading-relaxed px-4">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
