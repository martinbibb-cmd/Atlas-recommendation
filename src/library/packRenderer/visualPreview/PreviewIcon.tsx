import type { SVGProps } from 'react';

export type PreviewIconName =
  | 'boiler'
  | 'cylinder'
  | 'radiator'
  | 'water-flow'
  | 'pressure'
  | 'safety'
  | 'controls'
  | 'heat-pump'
  | 'print'
  | 'qr'
  | 'comfort';

interface PreviewIconProps extends SVGProps<SVGSVGElement> {
  name: PreviewIconName;
  label?: string;
}

function renderGlyph(name: PreviewIconName) {
  switch (name) {
    case 'boiler':
      return (
        <>
          <rect x="6" y="4" width="12" height="16" rx="3" />
          <path d="M10 8h4" />
          <path d="M10 12h4" />
          <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
        </>
      );
    case 'cylinder':
      return (
        <>
          <ellipse cx="12" cy="5" rx="5" ry="2.5" />
          <path d="M7 5v12c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V5" />
          <path d="M7 17c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5" />
        </>
      );
    case 'radiator':
      return (
        <>
          <rect x="5" y="7" width="14" height="10" rx="2" />
          <path d="M8 7v10M11 7v10M14 7v10M17 7v10" />
          <path d="M7 19h2M15 19h2" />
        </>
      );
    case 'water-flow':
      return (
        <>
          <path d="M5 12c2.5-4 5-6 7-7 1.8 1.1 4.3 3.2 7 7-2.5 4-5 6-7 7-1.8-1.1-4.3-3.2-7-7Z" />
          <path d="M9 12h6" />
          <path d="m13 9 3 3-3 3" />
        </>
      );
    case 'pressure':
      return (
        <>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 12 16 9" />
          <path d="M12 5v2M19 12h-2M12 19v-2M5 12h2" />
        </>
      );
    case 'safety':
      return (
        <>
          <path d="M12 3 5 6v5c0 4.2 2.8 7.4 7 10 4.2-2.6 7-5.8 7-10V6l-7-3Z" />
          <path d="M12 8v5" />
          <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case 'controls':
      return (
        <>
          <rect x="4" y="6" width="16" height="12" rx="3" />
          <circle cx="9" cy="12" r="2" />
          <path d="M14 10h3M14 14h3" />
        </>
      );
    case 'heat-pump':
      return (
        <>
          <rect x="4" y="6" width="16" height="12" rx="3" />
          <circle cx="10" cy="12" r="3.5" />
          <path d="M10 8.5v7M6.5 12h7" />
          <path d="M16.5 9.5h1.5M16.5 12h1.5M16.5 14.5h1.5" />
        </>
      );
    case 'print':
      return (
        <>
          <path d="M7 7V4h10v3" />
          <rect x="5" y="8" width="14" height="7" rx="2" />
          <rect x="7" y="13" width="10" height="7" rx="1" />
        </>
      );
    case 'qr':
      return (
        <>
          <rect x="5" y="5" width="5" height="5" />
          <rect x="14" y="5" width="5" height="5" />
          <rect x="5" y="14" width="5" height="5" />
          <path d="M14 14h2v2h-2zM17 14h2v5h-5v-2" />
        </>
      );
    default:
      return (
        <>
          <path d="M12 4c4.4 0 8 3.1 8 7s-3.6 9-8 9-8-5.1-8-9 3.6-7 8-7Z" />
          <path d="M8.5 12.5 11 15l4.5-5" />
        </>
      );
  }
}

export function PreviewIcon({ name, label, className, ...props }: PreviewIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      {...props}
    >
      {renderGlyph(name)}
    </svg>
  );
}
