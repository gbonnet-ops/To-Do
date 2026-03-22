"use client";

import { useState } from "react";
import { Deal } from "@/lib/types";

interface RecapViewProps {
  deals: Deal[];
  mobile: boolean;
}

export default function RecapView({ deals, mobile }: RecapViewProps) {
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [period, setPeriod] = useState<"today" | "week">("today");
  const [loading, setLoading] = useState(false);
  const [recap, setRecap] = useState<string | null>(null);
  const [stats, setStats] = useState<{ sourcesCount: number; emailCount: number; slackCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateRecap = async () => {
    if (!selectedDeal) return;
    setLoading(true);
    setRecap(null);
    setError(null);
    setStats(null);

    try {
      const deal = deals.find((d) => d.name === selectedDeal);
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealName: selectedDeal,
          company: deal?.company || null,
          period,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setRecap(data.recap);
      if (data.sourcesCount !== undefined) {
        setStats({
          sourcesCount: data.sourcesCount,
          emailCount: data.emailCount,
          slackCount: data.slackCount,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
    setLoading(false);
  };

  return (
    <div style={{ paddingTop: "14px" }}>
      {/* Deal selector */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "10px", fontWeight: 500, color: "#27272A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
          Projet
        </div>
        <div className="flex flex-wrap gap-1.5">
          {deals.map((d) => {
            const active = selectedDeal === d.name;
            return (
              <div
                key={d.name}
                onClick={() => { setSelectedDeal(d.name); setRecap(null); setError(null); }}
                className="cursor-pointer flex items-center gap-[5px] rounded-md transition-all duration-100"
                style={{
                  padding: "5px 12px",
                  fontSize: "11px",
                  color: active ? "#E2E8F0" : "#52525B",
                  background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                  border: active ? `1px solid ${d.color}40` : "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <span className="w-[5px] h-[5px] rounded-full" style={{ background: d.color, opacity: active ? 0.9 : 0.3 }} />
                {d.name}
              </div>
            );
          })}
        </div>
      </div>

      {/* Period selector + Generate button */}
      {selectedDeal && (
        <div className="flex items-center gap-3 mb-4" style={{ flexWrap: mobile ? "wrap" : "nowrap" }}>
          <div className="flex gap-0 rounded-md" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            {([
              { k: "today" as const, l: "Aujourd'hui" },
              { k: "week" as const, l: "7 derniers jours" },
            ]).map(({ k, l }) => (
              <div
                key={k}
                onClick={() => { setPeriod(k); setRecap(null); }}
                className="cursor-pointer transition-all duration-100"
                style={{
                  padding: "6px 14px",
                  fontSize: "11px",
                  fontWeight: period === k ? 500 : 400,
                  color: period === k ? "#E2E8F0" : "#3F3F46",
                  background: period === k ? "rgba(129,140,248,0.12)" : "transparent",
                }}
              >
                {l}
              </div>
            ))}
          </div>

          <div
            onClick={!loading ? generateRecap : undefined}
            className="flex items-center gap-[6px] rounded-md cursor-pointer transition-all duration-150"
            style={{
              padding: "6px 16px",
              fontSize: "11px",
              fontWeight: 500,
              color: loading ? "#818CF8" : "#E2E8F0",
              background: loading ? "rgba(129,140,248,0.08)" : "rgba(129,140,248,0.15)",
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "⏳ Génération..." : "Générer le récap"}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-lg mb-4"
          style={{
            padding: "10px 14px",
            fontSize: "11px",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.15)",
            color: "#F87171",
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ padding: "20px 0" }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded"
              style={{
                height: i === 1 ? "14px" : "10px",
                width: `${70 + Math.random() * 30}%`,
                background: "rgba(129,140,248,0.06)",
                marginBottom: "10px",
              }}
            />
          ))}
        </div>
      )}

      {/* Recap content */}
      {recap && (
        <div>
          {/* Stats bar */}
          {stats && (
            <div className="flex gap-3 mb-3" style={{ fontSize: "10px", color: "#52525B" }}>
              <span>{stats.sourcesCount} source{stats.sourcesCount > 1 ? "s" : ""}</span>
              {stats.emailCount > 0 && <span>📧 {stats.emailCount} email{stats.emailCount > 1 ? "s" : ""}</span>}
              {stats.slackCount > 0 && <span>💬 {stats.slackCount} message{stats.slackCount > 1 ? "s" : ""} Slack</span>}
            </div>
          )}

          {/* Markdown-ish rendered content */}
          <div
            className="rounded-xl"
            style={{
              padding: "16px 20px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              fontSize: "12px",
              lineHeight: "1.7",
              color: "#CBD5E1",
            }}
          >
            {recap.split("\n").map((line, i) => {
              // Bold headers
              if (line.match(/^#{1,3}\s/)) {
                const text = line.replace(/^#{1,3}\s/, "");
                return (
                  <div key={i} style={{ fontWeight: 600, color: "#E2E8F0", fontSize: "13px", marginTop: i > 0 ? "16px" : "0", marginBottom: "6px" }}>
                    {text}
                  </div>
                );
              }
              // Bold text with **
              if (line.match(/^\*\*.+\*\*$/)) {
                const text = line.replace(/\*\*/g, "");
                return (
                  <div key={i} style={{ fontWeight: 600, color: "#E2E8F0", fontSize: "13px", marginTop: i > 0 ? "14px" : "0", marginBottom: "6px" }}>
                    {text}
                  </div>
                );
              }
              // Bullet points
              if (line.match(/^[-•*]\s/)) {
                const text = line.replace(/^[-•*]\s/, "");
                return (
                  <div key={i} style={{ paddingLeft: "12px", position: "relative", marginBottom: "4px" }}>
                    <span style={{ position: "absolute", left: "0", color: "#818CF8" }}>·</span>
                    {renderInlineBold(text)}
                  </div>
                );
              }
              // Empty line
              if (line.trim() === "") {
                return <div key={i} style={{ height: "8px" }} />;
              }
              // Regular line
              return <div key={i}>{renderInlineBold(line)}</div>;
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedDeal && (
        <div style={{
          padding: "40px 0",
          textAlign: "center",
          fontSize: "12px",
          color: "#27272A",
        }}>
          Sélectionne un projet pour générer un récap des échanges
        </div>
      )}
    </div>
  );
}

/** Render inline **bold** within a text string */
function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ color: "#E2E8F0", fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}
