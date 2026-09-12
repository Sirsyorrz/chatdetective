import { useMemo, useState } from "react";
import { INSTANCES } from "../justlog";
import { useStore, type Mode } from "../state/store";

const MODES: { id: Mode; name: string; sub: string }[] = [
  { id: "longread", name: "Long Read", sub: "one message, four suspects" },
  { id: "forgery", name: "The Forgery", sub: "four statements, one planted" },
];

export function Sidebar() {
  const { instance, channels, channelsLoading, channel, mode } = useStore();
  const setInstance = useStore((s) => s.setInstance);
  const setChannel = useStore((s) => s.setChannel);
  const setMode = useStore((s) => s.setMode);
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? channels.filter((c) => c.name.includes(needle)) : channels;
    return list.slice(0, 400);
  }, [channels, q]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <b>chatdetective</b>
        <span>who said it</span>
      </div>

      <div className="modes">
        {MODES.map((m) => (
          <button key={m.id} className="mode" data-on={mode === m.id} onClick={() => setMode(m.id)}>
            <b>{m.name}</b>
            <small>{m.sub}</small>
          </button>
        ))}
      </div>

      <div className="section-h">Archive</div>
      <div className="pad stack">
        <select
          value={instance.id}
          onChange={(e) => void setInstance(INSTANCES.find((i) => i.id === e.target.value)!)}
        >
          {INSTANCES.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
        <input
          placeholder={channelsLoading ? "loading channels..." : `filter ${channels.length} channels`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="chan-list">
        {shown.map((c) => (
          <button
            key={c.name}
            className="chan"
            data-on={channel?.name === c.name}
            onClick={() => void setChannel(c)}
          >
            {c.name}
          </button>
        ))}
        {!channelsLoading && !shown.length && <div className="pad dim">no channels</div>}
      </div>
    </aside>
  );
}
