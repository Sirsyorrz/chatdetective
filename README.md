# chatdetective

Endless "who said it" cases built from real Twitch chat logs. No backend: the browser
talks straight to public [justlog](https://github.com/gempir/justlog) archives and the
7TV/BTTV/FFZ emote CDNs, so it deploys as static files on GitHub Pages.

## Modes

- **Long Read** - one substantial chat message, four chatters who were in the room, pick the author.
- **The Forgery** - four statements filed under one suspect, three are genuine, mark the plant.

Both are endless. Cases stream into an infinite feed, no round limit, no timer, no lives.

## Archives

Pick any justlog instance and any channel it logs. Rounds are drawn from a random day
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
