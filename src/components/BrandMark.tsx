export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="brand-mark"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <svg
        width={Math.round(size * 0.58)}
        height={Math.round(size * 0.58)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 20A7 7 0 0 1 4 13c0-4 3-8 8-10 4.5 1.6 8 5.5 8 10a7 7 0 0 1-7 7" />
        <path d="M12 22V11" />
        <path d="M12 14c0-2.5-2-4-4.5-4.5" />
      </svg>
    </span>
  );
}
