import { Eye, EyeOff } from "lucide-react";
import { useFirm, FIRM_LABELS, type Firm } from "@/contexts/firm-context";

export function FirmToggle() {
  const { firm, setFirm, toggleVisible, setToggleVisible } = useFirm();

  if (!toggleVisible) return null;

  const options: Firm[] = ["VG", "CG"];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(10, 20, 40, 0.92)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 100,
        padding: "6px 10px 6px 14px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
        userSelect: "none",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", marginRight: 4 }}>
        FIRM
      </span>

      <div style={{ display: "flex", gap: 4 }}>
        {options.map((opt) => {
          const active = firm === opt;
          const cfg = FIRM_LABELS[opt];
          return (
            <button
              key={opt}
              onClick={() => setFirm(opt)}
              title={`Switch to ${cfg.full}`}
              style={{
                cursor: "pointer",
                border: "none",
                borderRadius: 100,
                padding: "4px 14px",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                transition: "all 0.18s ease",
                background: active ? cfg.color : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.45)",
                outline: active ? `2px solid ${cfg.color}` : "2px solid transparent",
                outlineOffset: 1,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setToggleVisible(false)}
        title="Hide toggle (Ctrl+Shift+F to restore)"
        style={{
          cursor: "pointer",
          border: "none",
          background: "transparent",
          color: "rgba(255,255,255,0.3)",
          padding: "2px 4px",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          marginLeft: 2,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)")}
      >
        <EyeOff size={13} />
      </button>
    </div>
  );
}
