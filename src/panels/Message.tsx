import { tokenize } from "../emotes";
import { useStore } from "../state/store";
import type { Msg } from "../justlog";

export function Message({ msg }: { msg: Msg }) {
  const emotes = useStore((s) => s.emotes);
  const tokens = tokenize(msg.text, msg.emoteTag, emotes);
  return (
    <span>
      {tokens.map((t, i) =>
        t.type === "emote" ? (
          <img key={i} className="emote" src={t.url} alt={t.name} title={t.name} loading="lazy" />
        ) : (
          <span key={i}>{t.value}</span>
        ),
      )}
    </span>
  );
}
