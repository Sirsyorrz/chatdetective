import { useState } from "react";
import { CaseCard } from "./panels/CaseCard";
import { allTimeBest, useStore, type Mode } from "./state/store";

const MODES: { id: Mode; name: string; sub: string }[] = [
  { id: "longread", name: "Long Read", sub: "one message \u00b7 four suspects \u00b7 endless" },
  { id: "forgery", name: "The Forgery", sub: "four statements \u00b7 one planted \u00b7 endless" },
];

function ChannelSearch() {
  const { recent, searching, searchError, channel } = useStore();
  const search = useStore((s) => s.search);
  const [q, setQ] = useState("");

  return (
    <div className="stack center-stack">
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
      >
        <input
          className="chan-input"
          placeholder="twitch channel"
          value={q}
          spellCheck={false}
          autoCapitalize="off"
          autoFocus
          onChange={(e) => setQ(e.target.value)}
        />
        <button disabled={searching || !q.trim()}>{searching ? "..." : "open archive"}</button>
      </form>
      {searchError && <div className="note" data-bad="true">{searchError}</div>}
      {channel && (
        <div className="note">
          archive open &middot; #{channel.name}
        </div>
      )}
      {recent.length > 0 && (
        <div className="recent">
          {recent.map((n) => (
            <button key={n} className="chip" onClick={() => { setQ(n); void search(n); }}>
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Home() {
  const channel = useStore((s) => s.channel);
  const start = useStore((s) => s.start);

  return (
    <div className="home">
      <header className="title">
        <h1>chatdetective</h1>
        <p>real chat logs. one message. who said it?</p>
      </header>
      <ChannelSearch />
      <div className="mode-grid">
        {MODES.map((m) => (
          <button
            key={m.id}
            className="mode-card"
            disabled={!channel}
            onClick={() => void start(m.id)}
          >
            <b>{m.name}</b>
            <small>{m.sub}</small>
            <span className="best">best streak {allTimeBest(m.id)}</span>
          </button>
        ))}
      </div>
      {!channel && <p className="note">open an archive to pick a mode</p>}
      <footer className="credit">
        inspired by{" "}
        <a href="https://whodunchat.ducksaint.com/" target="_blank" rel="noreferrer">
          whodunchat
        </a>{" "}
        by DuckSaint. this is my own rebuild of the idea, endless modes only, no rounds and no
        timers, not affiliated with the original.
      </footer>
    </div>
  );
}

function Play() {
  const { current, caseNo, stats, mode, channel, loading, error } = useStore();
  const quit = useStore((s) => s.quit);
  const next = useStore((s) => s.next);
  const acc = stats.solved ? Math.round((stats.correct / stats.solved) * 100) : 0;

  return (
    <div className="play">
      <div className="scorebar">
        <button className="ghost" onClick={quit}>
          &larr; archive
        </button>
        <span>
          <b>{mode === "longread" ? "long read" : "forgery"}</b> #{channel?.name}
        </span>
        <span className="spacer" />
        <span>
          solved <b>{stats.correct}/{stats.solved}</b>
        </span>
        <span>
          acc <b>{acc}%</b>
        </span>
        <span>
          streak <b>{stats.streak}</b>
        </span>
      </div>
      <div className="stage">
        {current && <CaseCard key={current.id} c={current} n={caseNo} />}
        {!current && loading && <div className="note">pulling logs...</div>}
        {error && (
          <div className="note" data-bad="true">
            <div>{error}</div>
            <button style={{ marginTop: 8 }} onClick={() => void next()}>
              retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const mode = useStore((s) => s.mode);
  return <div className="app">{mode ? <Play /> : <Home />}</div>;
}
