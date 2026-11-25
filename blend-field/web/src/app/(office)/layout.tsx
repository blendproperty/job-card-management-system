import { LogOut, Plus, Search } from "lucide-react";
import { MobileNavLinks, NavLinks } from "@/components/nav-links";
import { ButtonLink, initials } from "@/components/ui";
import { requireOffice } from "@/server/auth";
import { signOutAction } from "../actions";

/** AppShell (components.md): dark sidebar, 56px header with search and Quick create. */
export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const me = await requireOffice();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[var(--layout-sidebar)_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-sm focus:bg-bg focus:p-2">
        Skip to content
      </a>
      <nav aria-label="Main" className="hidden flex-col gap-0.5 bg-nav-bg px-3 py-4 md:sticky md:top-0 md:flex md:h-dvh">
        <div className="mb-5 flex items-center px-2.5 pt-1 text-base font-bold text-on-nav">
          <span aria-hidden className="mr-2 size-2.5 rounded-[3px] bg-accent" />
          PM / FM workspace
        </div>
        <NavLinks />
      </nav>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-header items-center gap-3 border-b border-border bg-bg px-4">
          <span className="font-bold md:hidden">PM / FM</span>
          <form action="/jobs" role="search" className="relative max-w-[420px] flex-1">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle" />
            <label htmlFor="q" className="sr-only">Search jobs</label>
            <input id="q" name="q" placeholder="Search jobs, sites, clients"
              className="h-10 w-full rounded-sm border border-border-input bg-bg pr-3 pl-8 text-base placeholder:text-text-subtle focus:border-focus focus:ring-2 focus:ring-focus/35 focus:outline-none" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <ButtonLink href="/jobs/new"><Plus aria-hidden />New job</ButtonLink>
            <span title={me.display_name} aria-label={`Signed in as ${me.display_name}`}
              className="grid size-8 place-items-center rounded-full bg-surface-2 text-xs font-bold">{initials(me.display_name)}</span>
            <form action={signOutAction}>
              <button className="grid size-10 place-items-center rounded-md text-text-muted hover:bg-surface" aria-label="Sign out">
                <LogOut aria-hidden className="size-4" />
              </button>
            </form>
          </div>
        </header>
        <MobileNavLinks />
        <main id="main" className="mx-auto w-full max-w-content flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
