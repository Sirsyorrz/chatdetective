import { useState } from "react";
import { useStore, type Mode } from "../state/store";

const MODES: { id: Mode; name: string; sub: string }[] = [
  { id: "longread", name: "Long Read", sub: "one message, four suspects" },
  { id: "forgery", name: "The Forgery", sub: "four statements, one planted" },
];

export function Sidebar() {
  const { channel, alternates, recent, searching, searchError, mode } = useStore();
  const search = useStore((s) => s.search);
  const setChannel = useStore((s) => s.setChannel);
  const setMode = useStore((s) => s.setMode);
  const [q, setQ] = useState("");

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
      <form
        className="pad stack"
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
      >
        <div className="row">
          <input
            placeholder="twitch channel"
            value={q}
            spellCheck={false}
            autoCapitalize="off"
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button disabled={searching || !q.trim()}>{searching ? "..." : "open"}</button>
        </div>
        {searchError && <div className="dim">{searchError}</div>}
        {channel && (
          <div className="dim">
            #{channel.name} via {channel.instance.label}
          </div>
        )}
      </form>

      {alternates.length > 1 && (
        <>
          <div className="section-h">Also logged by</div>
          <div className="pad stack">
            {alternates.map((c) => (
              <button
                key={c.instance.id}
                className="mode"
                data-on={channel?.instance.id === c.instance.id}
                onClick={() => void setChannel(c)}
              >
                {c.instance.label}
              </button>
            ))}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <div className="section-h">Recent</div>
          <div className="chan-list">
            {recent.map((n) => (
              <button
                key={n}
                className="chan"
                data-on={channel?.name === n}
                onClick={() => {
                  setQ(n);
                  void search(n);
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
