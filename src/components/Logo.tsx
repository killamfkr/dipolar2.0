interface LogoProps {
  className?: string;
  size?: number;
}

/** Dipolar logo: two poles (dots) with a streaming arc between them. */
export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Left pole */}
      <circle cx="10" cy="20" r="4" fill="currentColor" />
      {/* Right pole */}
      <circle cx="30" cy="20" r="4" fill="currentColor" />
      {/* Streaming arc between poles */}
      <path
        d="M14 20c0 0 4-8 12-8s12 8 12 8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14 20c0 0 4 8 12 8s12-8 12-8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
