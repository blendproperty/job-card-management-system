"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Box, Building2, CalendarDays, GitBranch, ClipboardList, Map, Receipt, Settings, UsersRound, Wrench } from "lucide-react";

const ITEMS = [
  { href: "/role-views", label: "Role views", Icon: UsersRound },
  { href: "/map", label: "Field locations", Icon: Map },
  { href: "/jobs", label: "Jobs", Icon: ClipboardList },
  { href: "/schedule", label: "Schedule", Icon: CalendarDays },
  { href: "/tenants", label: "Tenants", Icon: UsersRound },
  { href: "/contractors", label: "Contractors", Icon: Wrench },
  { href: "/dispatch", label: "Dispatch rules", Icon: GitBranch },
  { href: "/properties", label: "Properties", Icon: Building2 },
  { href: "/assets", label: "Assets", Icon: Box },
  { href: "/invoices", label: "Invoices", Icon: Receipt },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
];

function Item({ href, label, Icon }: (typeof ITEMS)[number]) {
  const path = usePathname();
  const on = path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={
        "flex items-center gap-2.5 rounded-sm px-2.5 py-2 font-medium [&_svg]:size-[18px] " +
        (on ? "bg-nav-hover text-on-nav [&_svg]:text-accent" : "text-on-nav-muted hover:bg-nav-hover hover:text-on-nav")
      }
    >
      <Icon aria-hidden />
      {label}
    </Link>
  );
}

export function MobileNavLinks() {
  const path = usePathname();
  return <nav aria-label="Office sections" className="flex gap-1 overflow-x-auto border-b border-border bg-bg px-3 py-2 md:hidden">
    {[...ITEMS, { href: "/settings", label: "Settings" }].map(({ href, label }) => (
      <Link key={href} href={href} aria-current={(path === href || path.startsWith(href + "/")) ? "page" : undefined}
        className="whitespace-nowrap rounded-md px-2.5 py-2 text-sm text-accent-text aria-[current=page]:bg-accent-soft aria-[current=page]:font-bold">{label}</Link>
    ))}
  </nav>;
}

export function NavLinks() {
  return (
    <>
      <div className="flex flex-col gap-0.5">{ITEMS.map((i) => <Item key={i.href} {...i} />)}</div>
      <div className="mt-auto"><Item href="/settings" label="Settings" Icon={Settings} /></div>
    </>
  );
}
