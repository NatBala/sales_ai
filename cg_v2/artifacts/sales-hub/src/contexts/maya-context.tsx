import {
  createContext, useContext, useState,
  useCallback, type ReactNode,
} from "react";
import type { GeneratedLead } from "@workspace/api-client-react";

export interface MayaLead {
  generatedLead: GeneratedLead;
  savedLeadId: string;
}

type MayaPhase = "idle" | "listening" | "thinking" | "responding";

interface MayaContextValue {
  selectedLeads: MayaLead[];
  addLead: (lead: MayaLead) => void;
  removeLead: (savedLeadId: string) => void;
  clearLeads: () => void;
  isSelected: (savedLeadId: string) => boolean;

  autoQuery: string | null;
  setAutoQuery: (q: string) => void;
  clearAutoQuery: () => void;

  mayaMeetingId: string | null;
  setMayaMeetingId: (id: string | null) => void;

  mayaPhase: MayaPhase;
  setMayaPhase: (p: MayaPhase) => void;

  mayaMessage: string | null;
  setMayaMessage: (m: string | null) => void;

  mayaFocused: boolean;
  setMayaFocused: (v: boolean) => void;
}

const MayaCtx = createContext<MayaContextValue | null>(null);

export function MayaProvider({ children }: { children: ReactNode }) {
  const [selectedLeads, setSelectedLeads] = useState<MayaLead[]>([]);
  const [autoQuery, setAutoQueryState] = useState<string | null>(null);
  const [mayaMeetingId, setMayaMeetingId] = useState<string | null>(null);
  const [mayaPhase, setMayaPhase] = useState<MayaPhase>("idle");
  const [mayaMessage, setMayaMessage] = useState<string | null>(null);
  const [mayaFocused, setMayaFocused] = useState(false);

  const addLead = useCallback((lead: MayaLead) => {
    setSelectedLeads(prev => {
      if (prev.find(l => l.savedLeadId === lead.savedLeadId)) return prev;
      return [...prev, lead];
    });
  }, []);

  const removeLead = useCallback((id: string) => {
    setSelectedLeads(prev => prev.filter(l => l.savedLeadId !== id));
  }, []);

  const clearLeads = useCallback(() => setSelectedLeads([]), []);

  const isSelected = useCallback(
    (id: string) => selectedLeads.some(l => l.savedLeadId === id),
    [selectedLeads]
  );

  const setAutoQuery = useCallback((q: string) => setAutoQueryState(q), []);
  const clearAutoQuery = useCallback(() => setAutoQueryState(null), []);

  return (
    <MayaCtx.Provider value={{
      selectedLeads, addLead, removeLead, clearLeads, isSelected,
      autoQuery, setAutoQuery, clearAutoQuery,
      mayaMeetingId, setMayaMeetingId,
      mayaPhase, setMayaPhase,
      mayaMessage, setMayaMessage,
      mayaFocused, setMayaFocused,
    }}>
      {children}
    </MayaCtx.Provider>
  );
}

export function useMaya() {
  const ctx = useContext(MayaCtx);
  if (!ctx) throw new Error("useMaya must be used inside MayaProvider");
  return ctx;
}
