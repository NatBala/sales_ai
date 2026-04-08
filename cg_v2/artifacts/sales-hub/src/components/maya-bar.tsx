import { useCallback } from "react";
import { useMaya } from "@/contexts/maya-context";
import { X, Users, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function MayaBar() {
  const { selectedLeads, clearLeads, mayaFocused, setMayaFocused } = useMaya();

  const handleOpenMaya = useCallback(() => {
    setMayaFocused(!mayaFocused);
  }, [mayaFocused, setMayaFocused]);

  return (
    <div className="flex items-center gap-3 ml-auto mr-2">

      {/* Selected leads badge */}
      <AnimatePresence>
        {selectedLeads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: 8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: 8 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-sm"
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-300 font-medium">{selectedLeads.length} selected</span>
            <button
              onClick={clearLeads}
              className="text-blue-400/60 hover:text-blue-300 transition-colors ml-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ask Maya button */}
      <button
        onClick={handleOpenMaya}
        className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all duration-200 focus:outline-none ${
          mayaFocused
            ? "bg-purple-600/30 border border-purple-400/50 text-white shadow-lg shadow-purple-500/20"
            : "bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 text-purple-200 hover:from-purple-600/30 hover:to-indigo-600/30 hover:border-purple-400/50 hover:text-white shadow-lg shadow-purple-500/10"
        }`}
      >
        <Sparkles className="w-4 h-4 text-purple-400" />
        <span>Ask Maya</span>
      </button>
    </div>
  );
}
