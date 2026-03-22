"use client";

import { useState } from "react";
import { CalendarEvent } from "@/lib/types";

interface MeetingCardProps {
  event: CalendarEvent;
  dotColor: string;
  mobile: boolean;
  onDeepContext?: (event: CalendarEvent) => void;
}

export default function MeetingCard({ event, dotColor, mobile, onDeepContext }: MeetingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepContext, setDeepContext] = useState<string | null>(null);

  const st = event.start ? new Date(event.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  const en = event.end ? new Date(event.end).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  const hasContext = !!event.context;
  const hasDeal = event.deal && event.deal !== "_unmatched";
  const showContext = hasContext && (mobile ? expanded : hovered);
  const showDeep = deepContext !== null;

  const handleDeepContext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deepLoading || deepContext) {
      if (deepContext) setDeepContext(null); // toggle off
      return;
    }
    setDeepLoading(true);
    try {
      const res = await fetch("/api/calendar/context/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: `${event.title}|${event.start}`,
          title: event.title,
          deal: event.deal,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.context) setDeepContext(data.context);
      }
    } catch {
      // silent
    }
    setDeepLoading(false);
  };

  return (
    <div
      className="flex items-start gap-2.5 relative"
      style={{ padding: "6px 0 6px 4px", cursor: hasContext ? "pointer" : "default" }}
      onMouseEnter={() => !mobile && setHovered(true)}
      onMouseLeave={() => !mobile && setHovered(false)}
      onClick={() => mobile && hasContext && setExpanded((p) => !p)}
    >
      <div
        className="flex-shrink-0 rounded-sm mt-0.5"
        style={{ width: 3, minHeight: 18, background: dotColor, opacity: 0.4 }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: "12px", color: "#64748B" }}>{event.title}</span>
          <span style={{ fontSize: "10px", color: "#3F3F46" }}>
            {st}{en ? `–${en}` : ""}
          </span>
          {hasDeal && (
            <span style={{ fontSize: "9px", color: dotColor, opacity: 0.7 }}>{event.deal}</span>
          )}
          {hasContext && (
            <span style={{ fontSize: "9px", color: "#52525B", opacity: 0.5 }}>i</span>
          )}
          {hasDeal && (
            <span
              onClick={handleDeepContext}
              className="cursor-pointer rounded transition-all duration-150"
              style={{
                fontSize: "9px",
                padding: "1px 5px",
                color: deepLoading ? "#FBBF24" : deepContext ? "#818CF8" : "#3F3F46",
                background: deepContext ? "rgba(129,140,248,0.1)" : "rgba(255,255,255,0.04)",
                marginLeft: "auto",
                flexShrink: 0,
              }}
              title="Briefing détaillé"
            >
              {deepLoading ? "⏳" : "⤢"}
            </span>
          )}
        </div>

        {/* Mobile: inline expand short context */}
        {mobile && showContext && !showDeep && (
          <div
            style={{
              marginTop: "4px",
              padding: "5px 8px",
              fontSize: "11px",
              color: "#94A3B8",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "6px",
              lineHeight: "1.4",
            }}
          >
            {event.context}
          </div>
        )}

        {/* Deep context (both mobile & desktop) */}
        {showDeep && (
          <div
            style={{
              marginTop: "6px",
              padding: "8px 10px",
              fontSize: "11px",
              color: "#CBD5E1",
              background: "rgba(129,140,248,0.06)",
              border: "1px solid rgba(129,140,248,0.12)",
              borderRadius: "8px",
              lineHeight: "1.6",
              whiteSpace: "pre-line",
            }}
          >
            {deepContext}
          </div>
        )}

        {/* Desktop: tooltip for short context */}
        {!mobile && showContext && !showDeep && (
          <div
            style={{
              position: "absolute",
              left: "20px",
              top: "100%",
              zIndex: 50,
              padding: "8px 12px",
              fontSize: "11px",
              color: "#CBD5E1",
              background: "#1C1C1E",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              maxWidth: "320px",
              lineHeight: "1.5",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              whiteSpace: "normal",
            }}
          >
            {event.context}
          </div>
        )}
      </div>
    </div>
  );
}
