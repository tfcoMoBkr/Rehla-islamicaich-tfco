import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

type AccountShellProps = { title: string; description?: string; card?: boolean; children: ReactNode };

/** The frame of every account screen: the heading, then the form on a paper card. */
export function AccountShell({ title, description, card = true, children }: AccountShellProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-16 pb-28 sm:px-6 md:pt-20">
      <SectionHeading as="h1" title={title} description={description} />
      <div className="mt-8">{card ? <Card className="gap-0 px-5 py-7 sm:px-8">{children}</Card> : children}</div>
    </div>
  );
}
