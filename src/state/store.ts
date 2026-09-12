import { create } from "zustand";
import { buildCases, type Case } from "../cases";
import { loadEmotes, type EmoteMap } from "../emotes";
import { fetchWindow, findChannel, type Channel } from "../justlog";

export type Mode = "longread" | "forgery";

type Stats = { solved: number; correct: number; streak: number; best: number };

const emptyStats = (): Stats => ({ solved: 0, correct: 0, streak: 0, best: 0 });

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

type State = {
  channel: Channel | null;
  recent: string[];
  searching: boolean;
  searchError: string | null;
  mode: Mode | null;
  emotes: EmoteMap;
  current: Case | null;
  caseNo: number;
  stats: Stats;
  loading: boolean;
  error: string | null;
  search: (name: string) => Promise<void>;
  start: (m: Mode) => Promise<void>;
  quit: () => void;
  next: () => Promise<void>;
  answer: (correct: boolean) => void;
};

const POOL_TARGET = 8;

export const useStore = create<State>((set, get) => {
  let pool: Case[] = [];
  const used = new Set<string>();
  let inflight: Promise<void> | null = null;

  async function refill() {
    const { channel, mode } = get();
    if (!channel || !mode) return;
    for (let i = 0; i < 6 && pool.length < POOL_TARGET; i++) {
      const w = await fetchWindow(channel);
      pool.push(...buildCases(w, mode, used));
    }
  }

  function reset() {
    pool = [];
    used.clear();
    set({ current: null, caseNo: 0, stats: emptyStats(), error: null });
  }

  return {
    channel: null,
    recent: loadJSON<string[]>("cd.recent", []),
    searching: false,
    searchError: null,
    mode: null,
    emotes: new Map(),
    current: null,
    caseNo: 0,
    stats: emptyStats(),
    loading: false,
    error: null,

    async search(name) {
      const query = name.trim();
      if (!query) return;
      set({ searching: true, searchError: null });
      const matches = await findChannel(query);
      set({ searching: false });
      const channel = matches[0];
      if (!channel) {
        set({ searchError: `no public archive logs ${query.replace(/^[@#]/, "")}` });
        return;
      }
      const recent = [channel.name, ...get().recent.filter((n) => n !== channel.name)].slice(0, 6);
      localStorage.setItem("cd.recent", JSON.stringify(recent));
      set({ channel, recent, mode: null, emotes: new Map(), searchError: null });
      reset();
      loadEmotes(channel.userID).then((emotes) => set({ emotes }));
    },

    async start(mode) {
      set({ mode });
      reset();
      await get().next();
    },

    quit() {
      set({ mode: null });
      reset();
    },

    async next() {
      if (inflight) return inflight;
      set({ loading: true, error: null });
      inflight = (async () => {
        try {
          if (!pool.length) await refill();
          const c = pool.shift();
          if (!c) throw new Error("this channel's logs are too sparse for cases, try another");
          used.add(c.id);
          set({ current: c, caseNo: get().caseNo + 1 });
          if (pool.length < 3) void refill().catch(() => {});
        } catch (e) {
          set({ error: (e as Error).message });
        } finally {
          set({ loading: false });
          inflight = null;
        }
      })();
      return inflight;
    },

    answer(correct) {
      const s = get().stats;
      const mode = get().mode;
      const streak = correct ? s.streak + 1 : 0;
      const best = Math.max(s.best, streak);
      if (mode) {
        const bests = loadJSON<Record<string, number>>("cd.best", {});
        if (best > (bests[mode] ?? 0)) {
          bests[mode] = best;
          localStorage.setItem("cd.best", JSON.stringify(bests));
        }
      }
      set({ stats: { solved: s.solved + 1, correct: s.correct + (correct ? 1 : 0), streak, best } });
    },
  };
});

export const allTimeBest = (mode: Mode) => loadJSON<Record<string, number>>("cd.best", {})[mode] ?? 0;
