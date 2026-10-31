"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; count?: number };

export function MainNav({ role, queueCount }: { role: string; queueCount: number }) {
  const pathname = usePathname();
  const items: NavItem[] = [
    { href: "/catalogue", label: "Catalogue" },
    { href: "/bookings", label: "My bookings" },
  ];
  if (role === "OWNER" || role === "ADMIN") {
    items.push({ href: "/manage/requests", label: "Requests", count: queueCount });
  }
  items.push({ href: "/incidents", label: "Incidents" });
  if (role === "ADMIN") {
    items.push({ href: "/admin/resources", label: "Resources" });
    items.push({ href: "/admin/users", label: "Members" });
    items.push({ href: "/admin/audit", label: "Audit" });
  }

  return (
    <nav className="main-nav" aria-label="Main">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={active ? "page" : undefined}
          >
            {item.label}
            {item.count ? <span className="nav-count">{item.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
