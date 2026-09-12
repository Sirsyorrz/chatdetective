# chatdetective

Inspired by [whodunchat](https://whodunchat.ducksaint.com/) by DuckSaint. This is an
independent rebuild of that idea the way I wanted to play it: endless modes only, no
round limits, no timers, no lives, and a channel you type in rather than pick from a list.
No code or assets from the original, and no affiliation with it.

Endless "who said it" cases built from real Twitch chat logs. No backend: the browser
talks straight to public [justlog](https://github.com/gempir/justlog) archives and the
7TV/BTTV/FFZ emote CDNs, so it deploys as static files on GitHub Pages.

## Modes

- **Long Read** - one substantial chat message, four chatters who were in the room, pick the author.
- **The Forgery** - four statements filed under one suspect, three are genuine, mark the plant.
- **Peak Chatter** - four chatters from the same stretch of chat, pick who typed the most.

All three are endless: one case at a time, no round limit, no timer, no lives.

## Archives

Type a channel name and every known justlog instance is asked at once. Windows rotate
across every archive that logs it, so a gap in one host is covered by another. Rounds are drawn from a random day
in the last ~2 years, sampled at a random offset so the same window rarely repeats.

## Dev

```
npm install
npm run dev
```

`npm run build` emits `dist/`. `BASE_PATH=/ npm run build` for a custom domain.

## Notes

Public justlog hosts are run by volunteers. Each case window is a single request for a
few hundred messages, reused for several cases, which keeps the load low. Don't remove
that batching.
