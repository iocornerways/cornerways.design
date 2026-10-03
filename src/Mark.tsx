/** The Cornerways mark: a rounded square with the corner bracket, in currentColor. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 15V11C9.5 9.6193 10.6193 8.5 12 8.5H15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
