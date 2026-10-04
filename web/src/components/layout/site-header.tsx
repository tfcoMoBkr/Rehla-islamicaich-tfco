import { Logo } from "@/components/brand/logo";

import { DuneEdge } from "./dune-edge";
import { LocaleSwitcher } from "./locale-switcher";
import { MainNav } from "./main-nav";

export function SiteHeader() {
  return (
    <header className="tone-night relative z-40 bg-background">
      {/* On small screens the nav wraps onto its own scrollable row below the logo. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-1 px-4 py-3 sm:px-6">
        <Logo />
        <MainNav className="order-last w-full md:order-0 md:w-auto md:flex-1" />
        <LocaleSwitcher className="ms-auto md:ms-0" />
      </div>
      <DuneEdge className="absolute inset-x-0 top-full h-3 -scale-y-100 sm:h-4" />
    </header>
  );
}
