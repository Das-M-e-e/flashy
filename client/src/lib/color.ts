/** Deterministischer Farbverlauf aus einem Namen (stabil pro Projekt/Stapel). */
export function gradientFor(name: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  const hue2 = (hue + 40) % 360;
  return {
    from: `hsl(${hue}, 70%, 58%)`,
    to: `hsl(${hue2}, 72%, 48%)`,
  };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
