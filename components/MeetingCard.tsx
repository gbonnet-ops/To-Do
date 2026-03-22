"use client";

import { useState } from "react";
import { CalendarEvent } from "@/lib/types";

interface MeetingCardProps {
  event: CalendarEvent;
  dotColor: string;
  mobile: boolean;
}

export default function MeetingCard({ event, dotColor, mobile }: MeetingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const st = event.start ? new Date(event.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  const en = event.end ? new Date(event.end).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  const hasContext = !!event.context;
  const showContext = hasContext && (mobile ? expanded : hovered);

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
          {event.deal && event.deal !== "_unmatched" && (
            <span style={{ fontSize: "9px", color: dotColor, opacity: 0.7 }}>{event.deal}</span>
          )}
          {hasContext && (
            <span style={{ fontSize: "9px", color: "#52525B", opacity: 0.5 }}>i</span>
          )}
        </div>

        {/* Mobile: inline expand */}
        {mobile && showContext && (
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

        {/* Desktop: tooltip */}
        {!mobile && showContext && (
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
