export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="flashy-logo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-from)" />
          <stop offset="1" stopColor="var(--brand-to)" />
        </linearGradient>
      </defs>
      {/* hinterer Karten-Stapel */}
      <rect x="5" y="8" width="18" height="13" rx="3" transform="rotate(-9 5 8)" fill="url(#flashy-logo)" opacity="0.35" />
      {/* vordere Karte */}
      <rect x="7" y="9" width="19" height="14" rx="3.2" fill="url(#flashy-logo)" />
      {/* Blitz */}
      <path
        d="M17.6 11.2l-4.2 5.6h3l-1.2 4.4 4.6-6h-3.1l0.9-4z"
        fill="#fff"
      />
    </svg>
  );
}
