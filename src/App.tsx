import { useEffect, useRef } from "react";
import { CaseCard } from "./panels/CaseCard";
import { Sidebar } from "./panels/Sidebar";
import { allTimeBest, useStore } from "./state/store";
import { INSTANCES } from "./justlog";

function Feed() {
  const { cases, loading, error, channel } = useStore();
  const more = useStore((s) => s.more);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !channel || error) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void more();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [channel, more, error]);

  if (!channel) return <div className="empty">pick an archive channel to open the case files</div>;

  return (
    <div className="feed">
      {cases.map((c, i) => (
        <CaseCard key={c.id} c={c} n={i + 1} />
      ))}
      {error && (
        <div className="note" data-bad="true">
          <div>{error}</div>
          <button style={{ marginTop: 8 }} onClick={() => void more()}>
            retry
          </button>
        </div>
      )}
      {loading && <div className="note">pulling logs...</div>}
      <div ref={sentinel} className="sentinel" />
    </div>
  );
}

function TopBar() {
  const { stats, mode, channel, instance } = useStore();
  const acc = stats.solved ? Math.round((stats.correct / stats.solved) * 100) : 0;
  return (
    <div className="topbar">
      <span>
        mode <b>{mode === "longread" ? "long read" : "forgery"}</b>
      </span>
      <span>
        channel <b>{channel ? `#${channel.name}` : "-"}</b>
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
      <span>
        best <b>{Math.max(stats.best, allTimeBest(mode))}</b>
      </span>
      <span>{instance.label}</span>
    </div>
  );
}

export default function App() {
  const setInstance = useStore((s) => s.setInstance);
  useEffect(() => {
    void setInstance(INSTANCES[0]!);
  }, [setInstance]);

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <TopBar />
        <Feed />
      </main>
    </div>
  );
}
