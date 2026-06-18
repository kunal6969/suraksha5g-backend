import { useEffect, useRef } from "react";

export default function KavachStream({ events }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="kavach-ticker">
      <div className="kavach-label">KAVACH · Live Wire</div>
      <div className="kavach-events" ref={ref}>
        {events.length === 0 && (
          <span className="kavach-empty">awaiting init—</span>
        )}
        {events.map((ev, i) => {
          /* PRE-ARMED match lines get amber accent even though level is "match" */
          const isPrearmedProof = ev.message.includes("PRE-ARMED");
          const cls = isPrearmedProof ? "level-prearm" : `level-${ev.level}`;
          return (
            <div className={`kev ${cls}`} key={`${ev.ts}-${i}`}>
              <time className="kev-time">{ev.ts}</time>
              <span className="kev-msg">{ev.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
