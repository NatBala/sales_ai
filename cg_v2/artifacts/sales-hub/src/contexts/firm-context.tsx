import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type Firm = "VG" | "CG";

interface FirmContextType {
  firm: Firm;
  setFirm: (f: Firm) => void;
  toggleVisible: boolean;
  setToggleVisible: (v: boolean) => void;
}

const FirmContext = createContext<FirmContextType>({
  firm: "CG",
  setFirm: () => {},
  toggleVisible: true,
  setToggleVisible: () => {},
});

export function FirmProvider({ children }: { children: ReactNode }) {
  const [firm, setFirmState] = useState<Firm>(() => {
    return (localStorage.getItem("salesai_firm") as Firm) ?? "CG";
  });
  const [toggleVisible, setToggleVisibleState] = useState<boolean>(() => {
    return localStorage.getItem("salesai_toggle_visible") !== "false";
  });

  const setFirm = useCallback((f: Firm) => {
    setFirmState(f);
    localStorage.setItem("salesai_firm", f);
  }, []);

  const setToggleVisible = useCallback((v: boolean) => {
    setToggleVisibleState(v);
    localStorage.setItem("salesai_toggle_visible", String(v));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setToggleVisible(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [setToggleVisible]);

  return (
    <FirmContext.Provider value={{ firm, setFirm, toggleVisible, setToggleVisible }}>
      {children}
    </FirmContext.Provider>
  );
}

export function useFirm() {
  return useContext(FirmContext);
}

export const FIRM_LABELS: Record<Firm, { short: string; full: string; color: string }> = {
  VG: { short: "VG", full: "Vanguard", color: "#8b1a1a" },
  CG: { short: "CG", full: "Capital Group", color: "#003087" },
};
