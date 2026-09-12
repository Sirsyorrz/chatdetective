export type Instance = { id: string; url: string; label: string };

export const INSTANCES: Instance[] = [
  { id: "ivr", url: "https://logs.ivr.fi", label: "ivr.fi" },
  { id: "zonian", url: "https://logs.zonian.dev", label: "zonian.dev" },
  { id: "spanix", url: "https://logs.spanix.team", label: "spanix.team" },
  { id: "twitchmetrics", url: "https://logs.twitchmetrics.xyz", label: "twitchmetrics.xyz" },
  { id: "logxx", url: "https://logxx.dev", label: "logxx.dev" },
];

export type Channel = { name: string; userID: string; instance: Instance };

export type RawMessage = {
  text: string;
  displayName: string;
  timestamp: string;
  id: string;
  tags: Record<string, string>;
};

export type Msg = {
  id: string;
  login: string;
  name: string;
  text: string;
  at: number;
  color: string;
  emoteTag: string;
};

const BOTS = new Set([
  "nightbot", "streamelements", "moobot", "fossabot", "supibot", "botrixoficial",
  "wizebot", "sery_bot", "streamlabs", "buttsbot", "own3d", "commanderroot",
  "kofistreambot", "pokemoncommunitygame", "soundalerts", "creatisbot", "titlechange_bot",
  "snusbot", "okayeg", "supinic", "kunszg", 
]);

const isBot = (login: string) => BOTS.has(login) || /bot\d*$/.test(login) || login.startsWith("bot");

async function getJSON<T>(url: string, timeoutMs = 15000): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function listChannels(inst: Instance): Promise<Channel[]> {
  const d = await getJSON<{ channels: { name: string; userID: string }[] }>(`${inst.url}/channels`);
  return d.channels.map((c) => ({ ...c, instance: inst }));
}

function toMsg(m: RawMessage): Msg | null {
  const login = (m.tags["login"] ?? m.displayName ?? "").toLowerCase();
  if (!login || isBot(login)) return null;
  const text = m.text.trim();
  // Commands and link drops are either bot chatter or say nothing about the author.
  if (!text || /^[!$+#-]/.test(text) || /https?:\/\//.test(text)) return null;
  // justlog stores sub/raid usernotices alongside chat; their text is Twitch's, not the user's.
  if (m.tags["system-msg"] || m.tags["msg-id"]) return null;
  if (/\bsubscribed (with|at)\b|is gifting|gifted a |are watching\b/i.test(text)) return null;
  // Timeouts and bans are logged as CLEARCHAT lines attributed to the punished user.
  if (/has been (timed out|banned|permanently banned)/i.test(text)) return null;
  return {
    id: m.id || `${login}-${m.timestamp}`,
    login,
    name: m.displayName || login,
    text,
    at: Date.parse(m.timestamp),
    color: m.tags["color"] || "",
    emoteTag: m.tags["emotes"] || "",
  };
}

async function dayCount(base: string, path: string): Promise<number> {
  // justlog has no count endpoint, so probe by offset: 404 means we ran past the end.
  let hi = 1000;
  let lo = 0;
  for (let i = 0; i < 7; i++) {
    const ok = await offsetExists(base, path, hi);
    if (!ok) break;
    lo = hi;
    hi *= 4;
  }
  return lo;
}

async function offsetExists(base: string, path: string, offset: number): Promise<boolean> {
  const r = await fetch(`${base}${path}?json&limit=1&offset=${offset}`);
  if (!r.ok) return false;
  const d = (await r.json()) as { messages: RawMessage[] };
  return d.messages.length > 0;
}

export type Window = { channel: Channel; date: Date; messages: Msg[] };

const DAY = 86400000;

function randomDay(spanDays: number): Date {
  const back = 2 + Math.floor(Math.random() * spanDays);
  return new Date(Date.now() - back * DAY);
}

/** Pulls a contiguous slice of chat from a random day, which is enough raw material
 *  for dozens of cases without hammering the log host. */
export async function fetchWindow(channel: Channel, size = 600, spanDays = 700): Promise<Window> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const date = randomDay(spanDays);
    const path = `/channel/${channel.name}/${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
    let total: number;
    try {
      total = await dayCount(channel.instance.url, path);
    } catch {
      continue;
    }
    if (total < size) continue;
    const offset = Math.floor(Math.random() * Math.max(1, total - size));
    try {
      const d = await getJSON<{ messages: RawMessage[] }>(
        `${channel.instance.url}${path}?json&limit=${size}&offset=${offset}`,
      );
      const messages = d.messages.map(toMsg).filter((m): m is Msg => m !== null);
      if (messages.length > size / 3) return { channel, date, messages };
    } catch {
      /* try another day */
    }
  }
  throw new Error(`no usable logs for ${channel.name} on ${channel.instance.label}`);
}
