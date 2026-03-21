"use client";

import { useState, useEffect, useRef } from "react";
import { parseDeal, parsePriority, parseDate, parseAssignee, cleanText } from "@/lib/parsers";
import { formatDeadline } from "@/lib/utils";

interface QuickAddProps {
  onAdd: (text: string, deal: string, priority: "high" | "medium" | "low", deadline: string | null, assignee: string | null) => void;
  deals: string[];
  dealDot: Record<string, string>;
  activeDeal: string;
  mobile: boolean;
}

export default function QuickAdd({ onAdd, deals, dealDot, activeDeal, mobile }: QuickAddProps) {
  const [input, setInput] = useState("");
  const [pDeal, setPDeal] = useState<string | null>(null);
  const [pPri, setPPri] = useState<"high" | "medium" | "low">("medium");
  const [pDate, setPDate] = useState<string | null>(null);
  const [pAssignee, setPAssignee] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const iRef = useRef<HTMLInputElement>(null);
  const pRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPDeal(parseDeal(input, deals));
    setPPri(parsePriority(input));
    setPDate(parseDate(input));
    setPAssignee(parseAssignee(input));
  }, [input, deals]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pRef.current && !pRef.current.contains(e.target as Node)) setPicker(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const add = () => {
    const text = cleanText(input);
    if (!text) return;
    const d = pDeal || (activeDeal !== "Tous" ? activeDeal : "Perso");
    onAdd(text, d, pPri, pDate, pAssignee || null);
    setInput("");
    setPicker(false);
    if (!mobile) iRef.current?.focus();
  };

  return (
    <div>
      <div
        className="flex items-center rounded-[10px]"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "2px 2px 2px 14px",
        }}
      >
        <input
          ref={iRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder={mobile ? "Nouvelle tâche..." : "Ajouter...  #deal  !high  @ven  >nom"}
          className="flex-1 bg-transparent border-none font-[inherit] min-w-0 outline-none"
          style={{
            color: "#CBD5E1",
            fontSize: mobile ? "14px" : "13px",
            padding: "10px 0",
          }}
        />

        {/* Deal picker */}
        <div ref={pRef} className="relative">
          <div
            onClick={() => setPicker(!picker)}
            className="cursor-pointer rounded-md"
            style={{
              padding: "6px 8px",
              fontSize: "11px",
              color: pDeal ? dealDot[pDeal] : "#333",
            }}
          >
            {pDeal || "+"}
          </div>
          {picker && (
            <div
              className="absolute z-50 rounded-[10px] min-w-[150px]"
              style={{
                bottom: "calc(100% + 8px)",
                right: 0,
                background: "#18181B",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "4px",
                boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
              }}
            >
              {deals.map((d) => (
                <div
                  key={d}
                  onClick={() => {
                    const c = input.replace(/#\w[\w\s]*?(?=\s|$)/g, "").trim();
                    setInput(c + ` #${d.split(" ")[0]}`);
                    setPicker(false);
                  }}
                  className="cursor-pointer flex items-center gap-2.5 rounded-[7px] transition-colors"
                  style={{ padding: "8px 12px", fontSize: "13px", color: "#A1A1AA" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: dealDot[d] }} />
                  {d}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          onClick={add}
          className="cursor-pointer rounded-lg transition-all duration-150"
          style={{
            background: input.trim() ? "#818CF8" : "rgba(255,255,255,0.04)",
            color: input.trim() ? "#FFF" : "#333",
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          +
        </div>
      </div>

      {/* Parse preview */}
      {input.trim() && (pDeal || pDate || pPri !== "medium" || pAssignee) && (
        <div className="flex gap-2 mt-2 items-center" style={{ fontSize: "11px", color: "#3F3F46" }}>
          <span>→</span>
          {pDeal && <span style={{ color: dealDot[pDeal] }}>{pDeal}</span>}
          {pPri === "high" && <span style={{ color: "#F87171" }}>Haute</span>}
          {pPri === "low" && <span style={{ color: "#475569" }}>Basse</span>}
          {pDate && <span>{formatDeadline(pDate)}</span>}
          {pAssignee && <span style={{ color: "#A78BFA" }}>→ {pAssignee}</span>}
        </div>
      )}
    </div>
  );
}
