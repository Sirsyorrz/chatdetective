import { create } from "zustand";
import { buildCases, type Case } from "../cases";
import { loadEmotes, type EmoteMap } from "../emotes";
import { fetchWindow, INSTANCES, listChannels, type Channel, type Instance } from "../justlog";

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

type State = {
  instance: Instance;
  channels: Channel[];
  channelsLoading: boolean;
  channel: Channel | null;
  mode: Mode;
  emotes: EmoteMap;
  cases: Case[];
  verdicts: Record<string, Verdict>;
  stats: Stats;
  loading: boolean;
  error: string | null;
  setInstance: (i: Instance) => Promise<void>;
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
    instance: INSTANCES[0]!,
    channels: [],
    channelsLoading: false,
    channel: null,
    mode: "longread",
    emotes: new Map(),
    cases: [],
    verdicts: {},
    stats: emptyStats(),
    loading: false,
    error: null,

    async setInstance(instance) {
      set({ instance, channels: [], channelsLoading: true, channel: null, error: null });
      reset();
      try {
        const channels = (await listChannels(instance)).sort((a, b) => a.name.localeCompare(b.name));
        set({ channels, channelsLoading: false });
      } catch (e) {
        set({ channelsLoading: false, error: `archive unreachable: ${(e as Error).message}` });
      }
    },

    async setChannel(channel) {
      set({ channel, emotes: new Map() });
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
