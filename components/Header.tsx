import { HelpCircle } from "lucide-react";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-brand-line/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10 shrink-0" />
          <h1 className="text-lg font-extrabold tracking-tight text-brand-ink sm:text-xl">
            Virtry
          </h1>
        </div>

        <a
          href="#how-it-works"
          className="hidden items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-smoke transition hover:border-brand-red/40 hover:text-brand-red sm:inline-flex"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          How it works
        </a>
      </div>
    </header>
  );
}
