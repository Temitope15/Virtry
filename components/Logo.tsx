interface LogoProps {
  className?: string;
  /** Renders as a transparent mark with red strokes (no red square). */
  flat?: boolean;
}

/**
 * Virtry mark: AR-viewfinder corners around a "V" — reads as
 * "scan + try-on" while holding the brand letter.
 */
export function Logo({ className = "", flat = false }: LogoProps) {
  if (flat) {
    return (
      <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
        <g
          stroke="currentColor"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.4}
        >
          <path d="M6 13 L6 8 Q6 6 8 6 L13 6" />
          <path d="M27 6 L32 6 Q34 6 34 8 L34 13" />
          <path d="M34 27 L34 32 Q34 34 32 34 L27 34" />
          <path d="M13 34 L8 34 Q6 34 6 32 L6 27" />
          <path d="M14 15 L20 27 L26 15" strokeWidth={3.2} />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#DC2626" />
      <g
        stroke="#FFFFFF"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.4}
      >
        <path d="M6 13 L6 8 Q6 6 8 6 L13 6" />
        <path d="M27 6 L32 6 Q34 6 34 8 L34 13" />
        <path d="M34 27 L34 32 Q34 34 32 34 L27 34" />
        <path d="M13 34 L8 34 Q6 34 6 32 L6 27" />
        <path d="M14 15 L20 27 L26 15" strokeWidth={3.2} />
      </g>
    </svg>
  );
}
