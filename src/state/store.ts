import { create } from "zustand";
import { buildCases, type Case } from "../cases";
import { loadEmotes, type EmoteMap } from "../emotes";
import { fetchWindow, findChannel, type Channel } from "../justlog";

export type Mode = "longread" | "forgery";

export type Verdict = { caseId: string; correct: boolean; picked: string };

type Stats = { solved: number; correct: number; streak: number; best: number };

const emptyStats = (): Stats => ({ solved: 0, correct: 0, streak: 0, best: 0 });

function loadBest(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem("cd.best") ?? "{}");
  } catch {
    return {};
  }
}

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem("cd.recent") ?? "[]");
  } catch {
    return [];
  }
}

type State = {
  channel: Channel | null;
  alternates: Channel[];
  recent: string[];
  searching: boolean;
  searchError: string | null;
  mode: Mode;
  emotes: EmoteMap;
  cases: Case[];
  verdicts: Record<string, Verdict>;
  stats: Stats;
  loading: boolean;
  error: string | null;
  search: (name: string) => Promise<void>;
  setChannel: (c: Channel) => Promise<void>;
  setMode: (m: Mode) => void;
  more: () => Promise<void>;
  answer: (c: Case, picked: string, correct: boolean) => void;
};

const POOL_TARGET = 8;

export const useStore = create<State>((set, get) => {
  let pool: Case[] = [];
  const used = new Set<string>();
  let inflight: Promise<void> | null = null;

  async function refill() {
    const { channel, mode } = get();
    if (!channel) return;
    for (let i = 0; i < 6 && pool.length < POOL_TARGET; i++) {
      const w = await fetchWindow(channel);
      pool.push(...buildCases(w, mode, used));
    }
  }

  function reset() {
    pool = [];
    used.clear();
    set({ cases: [], verdicts: {}, stats: emptyStats(), error: null });
  }

  return {
    channel: null,
    alternates: [],
    recent: loadRecent(),
    searching: false,
    searchError: null,
    mode: "longread",
    emotes: new Map(),
    cases: [],
    verdicts: {},
    stats: emptyStats(),
    loading: false,
    error: null,

    async search(name) {
      const query = name.trim();
      if (!query) return;
      set({ searching: true, searchError: null });
      const matches = await findChannel(query);
      set({ searching: false, alternates: matches });
      if (!matches.length) {
        set({ searchError: `no public archive logs ${query.replace(/^[@#]/, "")}` });
        return;
      }
      await get().setChannel(matches[0]!);
    },

    async setChannel(channel) {
      const recent = [channel.name, ...get().recent.filter((n) => n !== channel.name)].slice(0, 8);
      localStorage.setItem("cd.recent", JSON.stringify(recent));
      set({ channel, recent, emotes: new Map(), searchError: null });
      reset();
      loadEmotes(channel.userID).then((emotes) => set({ emotes }));
      await get().more();
    },

    setMode(mode) {
      if (mode === get().mode) return;
      set({ mode });
      reset();
      if (get().channel) void get().more();
    },

    async more() {
      if (inflight) return inflight;
      set({ loading: true, error: null });
      inflight = (async () => {
        try {
          if (pool.length < 4) await refill();
          if (!pool.length) throw new Error("this channel's logs are too sparse for cases, try another");
          const next = pool.splice(0, 4);
          for (const c of next) used.add(c.id);
          set({ cases: [...get().cases, ...next] });
        } catch (e) {
          set({ error: (e as Error).message });
        } finally {
          set({ loading: false });
          inflight = null;
        }
      })();
      return inflight;
    },

    answer(c, picked, correct) {
      const s = get().stats;
      const streak = correct ? s.streak + 1 : 0;
      const best = Math.max(s.best, streak);
      const key = `${get().mode}`;
      const bests = loadBest();
      if (best > (bests[key] ?? 0)) {
        bests[key] = best;
        localStorage.setItem("cd.best", JSON.stringify(bests));
      }
      set({
        verdicts: { ...get().verdicts, [c.id]: { caseId: c.id, correct, picked } },
        stats: { solved: s.solved + 1, correct: s.correct + (correct ? 1 : 0), streak, best },
      });
    },
  };
});

export const allTimeBest = (mode: Mode) => loadBest()[mode] ?? 0;
