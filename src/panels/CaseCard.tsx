import { useEffect, useState } from "react";
import type { Case, Forgery, LongRead, PeakChatter } from "../cases";
import { useStore } from "../state/store";
import { Message } from "./Message";

const stamp = (d: Date) => d.toISOString().slice(0, 10);
const clock = (ms: number) => new Date(ms).toISOString().slice(11, 16);

function Head({ n, c, label }: { n: number; c: Case; label: string }) {
  return (
    <div className="case-h">
      <b>
        {label} {String(n).padStart(3, "0")}
      </b>
      <span>#{c.channel}</span>
      <span>{stamp(c.date)}</span>
    </div>
  );
}

function Footer({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const next = useStore((s) => s.next);
  const loading = useStore((s) => s.loading);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);
  return (
    <div className="verdict" data-ok={ok}>
      <span>
        <b>{ok ? "SOLVED" : "MISSED"}</b> &middot; {children}
      </span>
      <button className="next" disabled={loading} onClick={() => void next()}>
        {loading ? "pulling logs..." : "next case"}
      </button>
    </div>
  );
}

function LongReadCase({ c, n }: { c: LongRead; n: number }) {
  const answer = useStore((s) => s.answer);
  const [picked, setPicked] = useState<string | null>(null);
  const done = picked !== null;

  return (
    <article className="case">
      <Head n={n} c={c} label="CASE" />
      <blockquote className="evidence">
        <Message msg={c.message} />
      </blockquote>
      <div className="prompt">Four chatters were in the room. Who typed it?</div>
      <div className="choices">
        {c.suspects.map((s, i) => {
          const state = !done
            ? undefined
            : s.login === c.answer
              ? "right"
              : s.login === picked
                ? "wrong"
                : "dim";
          return (
            <button
              key={s.login}
              className="choice"
              data-state={state}
              disabled={done}
              onClick={() => {
                setPicked(s.login);
                answer(s.login === c.answer);
              }}
            >
              <span className="idx">{i + 1}</span>
              <span className="suspect-name" style={{ color: s.color || undefined }}>
                {s.name}
              </span>
            </button>
          );
        })}
      </div>
      {done && (
        <Footer ok={picked === c.answer}>
          said by {c.message.name} at {new Date(c.message.at).toISOString().slice(11, 16)} UTC
        </Footer>
      )}
    </article>
  );
}

function ForgeryCase({ c, n }: { c: Forgery; n: number }) {
  const answer = useStore((s) => s.answer);
  const [picked, setPicked] = useState<string | null>(null);
  const done = picked !== null;

  return (
    <article className="case">
      <Head n={n} c={c} label="FILE" />
      <div className="prompt prompt-lead">
        Filed under{" "}
        <span className="suspect-name" style={{ color: c.suspect.color || undefined }}>
          {c.suspect.name}
        </span>{" "}
        &mdash; three are theirs, one was planted
      </div>
      <div className="statements">
        {c.statements.map((m, i) => {
          const state = !done
            ? undefined
            : m.id === c.forgedId
              ? "right"
              : m.id === picked
                ? "wrong"
                : "dim";
          return (
            <button
              key={m.id}
              className="statement"
              data-state={state}
              disabled={done}
              onClick={() => {
                setPicked(m.id);
                answer(m.id === c.forgedId);
              }}
            >
              <span className="idx">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <Message msg={m} />
              </span>
            </button>
          );
        })}
      </div>
      {done && <Footer ok={picked === c.forgedId}>the plant was {c.forgedBy.name}</Footer>}
    </article>
  );
}

function PeakCase({ c, n }: { c: PeakChatter; n: number }) {
  const answer = useStore((s) => s.answer);
  const [picked, setPicked] = useState<string | null>(null);
  const done = picked !== null;

  return (
    <article className="case">
      <Head n={n} c={c} label="SHIFT" />
      <div className="evidence peak-window">
        <span className="peak-clock">
          {clock(c.from)} &ndash; {clock(c.to)} UTC
        </span>
        <span className="peak-sub">four of them were in this stretch of chat</span>
      </div>
      <div className="prompt">Who typed the most?</div>
      <div className="choices">
        {c.lineup.map((e, i) => {
          const state = !done
            ? undefined
            : e.suspect.login === c.answer
              ? "right"
              : e.suspect.login === picked
                ? "wrong"
                : "dim";
          return (
            <button
              key={e.suspect.login}
              className="choice"
              data-state={state}
              disabled={done}
              onClick={() => {
                setPicked(e.suspect.login);
                answer(e.suspect.login === c.answer);
              }}
            >
              <span className="idx">{i + 1}</span>
              <span className="suspect-name" style={{ color: e.suspect.color || undefined }}>
                {e.suspect.name}
              </span>
              {done && <span className="tally">{e.count}</span>}
            </button>
          );
        })}
      </div>
      {done && (
        <Footer ok={picked === c.answer}>
          {c.lineup.find((e) => e.suspect.login === c.answer)!.suspect.name} sent{" "}
          {c.lineup.find((e) => e.suspect.login === c.answer)!.count} messages
        </Footer>
      )}
    </article>
  );
}

export function CaseCard({ c, n }: { c: Case; n: number }) {
  if (c.kind === "longread") return <LongReadCase c={c} n={n} />;
  if (c.kind === "forgery") return <ForgeryCase c={c} n={n} />;
  return <PeakCase c={c} n={n} />;
}
