import { Handle, Position } from "reactflow";

const STATE_META = {
  idle:       { icon: "●",  label: "IDLE"    },
  scanning:   { icon: "◎",  label: "SCAN"    },
  prearmed:   { icon: "◈",  label: "PRE-ARM" },
  clear:      { icon: "✓",  label: "CLEAR"   },
  match:      { icon: "⚠",  label: "MATCH"   },
  exit_flag:  { icon: "🚨", label: "EXIT"    },
  dispatched: { icon: "◉",  label: "UNIT"    },
};

export default function CameraNode({ data }) {
  const meta = STATE_META[data.state] || STATE_META.idle;

  const inspect = (e) => {
    e.stopPropagation();
    const now = Date.now();
    const last = Number(e.currentTarget.dataset.lastInspect || 0);
    if (now - last < 120) return;
    e.currentTarget.dataset.lastInspect = String(now);
    data.onInspect?.(data.id);
  };

  return (
    <div
      aria-label={`${meta.label} ${data.label}`}
      className={`camera-pod-wrap nodrag nopan state-${data.state} type-${data.type}`}
      data-node-card={data.id}
      onFocus={inspect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inspect(e); }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={inspect}
      role="button"
      tabIndex={0}
    >
      <Handle className="node-handle" type="target" position={Position.Left} />
      <Handle className="node-handle" type="source" position={Position.Right} />

      <div className="camera-pod">
        <span className="pod-icon">{meta.icon}</span>
      </div>

      <span className="pod-label">{data.label}</span>

      {data.timestamp && (
        <span className="pod-ts">{data.timestamp}</span>
      )}
    </div>
  );
}
