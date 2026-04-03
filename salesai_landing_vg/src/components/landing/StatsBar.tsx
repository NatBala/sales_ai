import { motion } from "framer-motion";

const stats = [
  { value: "6", label: "Specialized AI Agents" },
  { value: "5", label: "Core ETFs Tracked Live" },
  { value: "100%", label: "Capital Way Framework Aligned" },
  { value: "< 1s", label: "Voice Processing Latency" },
];

export function StatsBar() {
  return (
    <section className="py-16 relative z-10 bg-black/40 border-y border-white/5 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-display font-extrabold text-white mb-2">
                {stat.value}
              </div>
              <div className="text-sm md:text-base font-medium text-primary uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
