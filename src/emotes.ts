export type EmoteMap = Map<string, string>;

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

type SevenTvEmote = { name: string; data?: { host?: { url?: string } } };

function addSevenTv(map: EmoteMap, emotes: SevenTvEmote[] | undefined) {
  for (const e of emotes ?? []) {
    const host = e.data?.host?.url;
    if (host) map.set(e.name, `https:${host.replace(/^https?:/, "")}/1x.webp`);
  }
}

type BttvEmote = { id: string; code: string };
type FfzEmote = { id: number; code: string; images: Record<string, string> };

export async function loadEmotes(twitchUserId: string): Promise<EmoteMap> {
  const map: EmoteMap = new Map();
  const [stvGlobal, stvUser, bttvGlobal, bttvUser, ffzGlobal, ffzUser] = await Promise.all([
    json<{ emotes: SevenTvEmote[] }>("https://7tv.io/v3/emote-sets/global"),
    json<{ emote_set?: { emotes: SevenTvEmote[] } }>(`https://7tv.io/v3/users/twitch/${twitchUserId}`),
    json<BttvEmote[]>("https://api.betterttv.net/3/cached/emotes/global"),
    json<{ channelEmotes: BttvEmote[]; sharedEmotes: BttvEmote[] }>(
      `https://api.betterttv.net/3/cached/users/twitch/${twitchUserId}`,
    ),
    json<FfzEmote[]>("https://api.betterttv.net/3/cached/frankerfacez/emotes/global"),
    json<FfzEmote[]>(`https://api.betterttv.net/3/cached/frankerfacez/users/twitch/${twitchUserId}`),
  ]);

  addSevenTv(map, stvGlobal?.emotes);
  addSevenTv(map, stvUser?.emote_set?.emotes);
  for (const e of [...(bttvGlobal ?? []), ...(bttvUser?.channelEmotes ?? []), ...(bttvUser?.sharedEmotes ?? [])])
    map.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/1x`);
  for (const e of [...(ffzGlobal ?? []), ...(ffzUser ?? [])]) {
    const url = e.images["1x"] ?? Object.values(e.images)[0];
    if (url) map.set(e.code, url.startsWith("http") ? url : `https:${url}`);
  }
  return map;
}

export type Token = { type: "text"; value: string } | { type: "emote"; url: string; name: string };

/** Twitch's own emotes only exist as index ranges in the IRC tag, so they are
 *  substituted first and third-party lookups run on what is left. */
export function tokenize(text: string, emoteTag: string, map: EmoteMap): Token[] {
  const native = new Map<number, { end: number; id: string }>();
  for (const part of emoteTag.split("/").filter(Boolean)) {
    const [id, ranges] = part.split(":");
    if (!id || !ranges) continue;
    for (const r of ranges.split(",")) {
      const [a, b] = r.split("-").map(Number);
      if (a === undefined || b === undefined) continue;
      native.set(a, { end: b, id });
    }
  }

  const chars = [...text];
  const out: Token[] = [];
  let buf = "";
  const flushWords = () => {
    if (!buf) return;
    for (const piece of buf.split(/(\s+)/)) {
      if (!piece) continue;
      const url = map.get(piece);
      if (url) out.push({ type: "emote", url, name: piece });
      else out.push({ type: "text", value: piece });
    }
    buf = "";
  };

  for (let i = 0; i < chars.length; i++) {
    const hit = native.get(i);
    if (hit) {
      flushWords();
      const name = chars.slice(i, hit.end + 1).join("");
      out.push({
        type: "emote",
        name,
        url: `https://static-cdn.jtvnw.net/emoticons/v2/${hit.id}/default/dark/1.0`,
      });
      i = hit.end;
      continue;
    }
    buf += chars[i];
  }
  flushWords();
  return out;
}
