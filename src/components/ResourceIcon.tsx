import type { Resource } from "@/domain/types";

export function ResourceIcon({ type, size = 44 }: { type: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (type) {
    case "CAMERA":
      return (
        <svg {...common}>
          <rect x="2.5" y="7" width="13" height="10" rx="2" />
          <path d="M15.5 10.5 21 8v8l-5.5-2.5" />
          <circle cx="8" cy="12" r="2.2" />
        </svg>
      );
    case "AUDIO":
      return (
        <svg {...common}>
          <rect x="9" y="2.5" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7" />
        </svg>
      );
    case "LIGHTING":
      return (
        <svg {...common}>
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V15h7v-1.1A6 6 0 0 0 12 3Z" />
        </svg>
      );
    case "TEST_EQUIPMENT":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M7 13l2 2 3-4 2 3 2-1" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z" />
          <path d="M3 7.5 12 12l9-4.5M12 12v9" />
        </svg>
      );
  }
}

export function typeLabel(type: Resource["type"] | string): string {
  switch (type) {
    case "CAMERA":
      return "Camera";
    case "AUDIO":
      return "Audio";
    case "LIGHTING":
      return "Lighting";
    case "TEST_EQUIPMENT":
      return "Test equipment";
    case "ACCESSORY":
      return "Accessory";
    default:
      return type;
  }
}
