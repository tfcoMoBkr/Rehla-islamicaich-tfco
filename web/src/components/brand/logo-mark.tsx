import type { ComponentProps } from "react";

/** A road climbing toward the lantern's light. The road follows `currentColor`. */
export function LogoMark(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path
        d="M10 29.5c0-6.5 12-6 11.5-12s-8.5-5.5-6-9"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="17.6" cy="5.1" r="5" stroke="var(--dawn)" strokeWidth="1" opacity="0.55" />
      <circle cx="17.6" cy="5.1" r="2.8" fill="var(--dawn)" />
    </svg>
  );
}
