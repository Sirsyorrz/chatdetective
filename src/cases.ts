import type { Msg, Window } from "./justlog";

export type Suspect = { login: string; name: string; color: string };

export type LongRead = {
  kind: "longread";
  id: string;
  message: Msg;
  suspects: Suspect[];
  answer: string;
  date: Date;
  channel: string;
};

export type Forgery = {
  kind: "forgery";
  id: string;
  suspect: Suspect;
  statements: Msg[];
  forgedId: string;
  forgedBy: Suspect;
  date: Date;
  channel: string;
};

export type PeakChatter = {
  kind: "peak";
  id: string;
  lineup: { suspect: Suspect; count: number }[];
  answer: string;
  from: number;
  to: number;
  date: Date;
  channel: string;
};

export type Case = LongRead | Forgery | PeakChatter;

export type Mode = Case["kind"];

function stripNativeEmotes(m: Msg): string {
  if (!m.emoteTag) return m.text;
  const chars = [...m.text];
  for (const part of m.emoteTag.split("/")) {
    const ranges = part.split(":")[1];
    if (!ranges) continue;
    for (const r of ranges.split(",")) {
      const [a, b] = r.split("-").map(Number);
      if (a === undefined || b === undefined) continue;
      for (let i = a; i <= b && i < chars.length; i++) chars[i] = " ";
    }
  }
  return chars.join("");
}

/** Emote names survive as "words", so prose is approximated by dropping anything
 *  with an internal capital (FeelsOkayMan, forsenCD) or non-letters. */
function proseWords(m: Msg): string[] {
  return stripNativeEmotes(m)
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z][a-z']{1,}$/.test(w));
}

function uniqueRatio(words: string[]) {
  if (!words.length) return 0;
  return new Set(words.map((w) => w.toLowerCase())).size / words.length;
}

function isSubstantial(m: Msg) {
  const w = proseWords(m);
  return m.text.length >= 60 && w.length >= 9 && uniqueRatio(w) >= 0.7;
}

function isUsable(m: Msg) {
  const w = proseWords(m);
  return m.text.length >= 20 && w.length >= 4 && uniqueRatio(w) >= 0.65;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Copypasta repeats would otherwise fill a forgery file with the same statement. */
function distinct(ms: Msg[]): Msg[] {
  const seen = new Set<string>();
  return ms.filter((m) => {
    const k = normalize(m.text).slice(0, 40);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function suspectOf(m: Msg): Suspect {
  return { login: m.login, name: m.name, color: m.color };
}

/** A guess is only fair if the winner is clearly ahead, so lineups are built from
 *  a leader with a real margin over three strictly quieter chatters. */
function buildPeak(w: Window, authors: Map<string, Msg[]>, used: Set<string>): Case[] {
  const ranked = [...authors.entries()]
    .map(([login, ms]) => ({ login, count: ms.length, msg: ms[0]! }))
    .sort((a, b) => b.count - a.count);
  const from = w.messages[0]!.at;
  const to = w.messages[w.messages.length - 1]!.at;
  const out: Case[] = [];

  // A runaway spammer is a giveaway rather than a guess, so anyone dominating the
  // window is excluded from leading a lineup.
  const cap = Math.max(6, Math.floor(w.messages.length * 0.1));
  for (const leader of ranked.filter((r) => r.count >= 4 && r.count <= cap)) {
    const quieter = ranked.filter(
      (r) => r.login !== leader.login && r.count >= 2 && r.count <= leader.count - 2,
    );
    if (quieter.length < 3) continue;
    // Nearest counts first keeps the lineup close enough to be a real decision.
    const decoys = shuffle(quieter.slice(0, 8)).slice(0, 3);
    const id = `peak-${w.date.toISOString().slice(0, 10)}-${leader.login}-${decoys[0]!.login}`;
    if (used.has(id)) continue;
    out.push({
      kind: "peak",
      id,
      lineup: shuffle([leader, ...decoys]).map((r) => ({ suspect: suspectOf(r.msg), count: r.count })),
      answer: leader.login,
      from,
      to,
      date: w.date,
      channel: w.channel.name,
    });
  }
  return out;
}

function byAuthor(messages: Msg[]) {
  const map = new Map<string, Msg[]>();
  for (const m of messages) {
    const list = map.get(m.login);
    if (list) list.push(m);
    else map.set(m.login, [m]);
  }
  return map;
}

/** Cases are generated from one window and consumed lazily by the feed, so a
 *  window that yields nothing is discarded rather than retried per-case. */
export function buildCases(w: Window, mode: Mode, used: Set<string>): Case[] {
  const authors = byAuthor(w.messages);
  const out: Case[] = [];

  if (mode === "peak") return buildPeak(w, authors, used);

  if (mode === "longread") {
    const pool = distinct(w.messages.filter((m) => isSubstantial(m) && !used.has(m.id)));
    const others = [...authors.keys()];
    if (others.length < 6) return out;
    for (const message of shuffle(pool)) {
      const decoys = shuffle(others.filter((l) => l !== message.login)).slice(0, 3);
      if (decoys.length < 3) continue;
      const suspects = shuffle([
        suspectOf(message),
        ...decoys.map((l) => suspectOf(authors.get(l)![0]!)),
      ]);
      out.push({
        kind: "longread",
        id: message.id,
        message,
        suspects,
        answer: message.login,
        date: w.date,
        channel: w.channel.name,
      });
    }
    return out;
  }

  const candidates = [...authors.entries()].filter(([, ms]) => distinct(ms.filter(isUsable)).length >= 3);
  for (const [login, ms] of shuffle(candidates)) {
    const genuine = shuffle(distinct(ms.filter(isUsable))).slice(0, 3);
    const id = `forgery-${genuine[0]!.id}`;
    if (used.has(id)) continue;
    const avgLen = genuine.reduce((s, m) => s + m.text.length, 0) / 3;
    const genuineKeys = new Set(genuine.map((m) => normalize(m.text).slice(0, 40)));
    const plantPool = w.messages
      .filter((m) => m.login !== login && isUsable(m) && !genuineKeys.has(normalize(m.text).slice(0, 40)))
      .sort((a, b) => Math.abs(a.text.length - avgLen) - Math.abs(b.text.length - avgLen))
      .slice(0, 12);
    if (!plantPool.length) continue;
    const planted = pick(plantPool);
    out.push({
      kind: "forgery",
      id,
      suspect: suspectOf(genuine[0]!),
      statements: shuffle([...genuine, planted]),
      forgedId: planted.id,
      forgedBy: suspectOf(planted),
      date: w.date,
      channel: w.channel.name,
    });
  }
  return out;
}
