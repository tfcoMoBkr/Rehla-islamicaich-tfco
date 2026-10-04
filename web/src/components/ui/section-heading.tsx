import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  id?: string;
  title: string;
  eyebrow?: string;
  description?: string;
  as?: "h1" | "h2" | "h3";
  align?: "start" | "center";
  className?: string;
};

/** A short stretch of road drawn before the eyebrow, mirrored for right-to-left reading. */
function RoadDash() {
  return (
    <svg viewBox="0 0 30 10" fill="none" aria-hidden="true" className="h-2.5 w-7.5 shrink-0 rtl:-scale-x-100">
      <path
        d="M1.5 6.5c4-4.5 8-4.5 12-1.5s8.5 3.5 13-2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="27.5" cy="3" r="1.75" fill="var(--dawn)" />
    </svg>
  );
}

export function SectionHeading({
  id,
  title,
  eyebrow,
  description,
  as: Heading = "h2",
  align = "start",
  className,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div className={cn("max-w-2xl", centered && "mx-auto text-center", className)}>
      {eyebrow && (
        <p
          className={cn(
            "mb-3 flex items-center gap-2.5 text-sm font-semibold text-primary [&:lang(en)]:tracking-[0.08em] [&:lang(en)]:uppercase",
            centered && "justify-center",
          )}
        >
          <RoadDash />
          {eyebrow}
        </p>
      )}
      <Heading id={id} className="font-display text-3xl leading-[1.3] font-semibold sm:text-4xl">
        {title}
      </Heading>
      {description && <p className="mt-4 text-lg text-muted-foreground">{description}</p>}
    </div>
  );
}
