import { gradientFor, initials } from "../lib/color";

export default function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  const { from, to } = gradientFor(name);
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: size * 0.4,
      }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
