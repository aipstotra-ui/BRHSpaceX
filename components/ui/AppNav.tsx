"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const LINKS = [{ href: "/test", label: "Testing" }];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The one top bar. The 3ROK mark always goes to the landing page. A page can put its own context
 * after the links (the testing page adds chip, orbit and feed status), so there is never a second bar.
 */
export function AppNav({ className, children }: { className?: string; children?: ReactNode }) {
  const pathname = usePathname();
  return (
    <header className={className ? `rok-nav ${className}` : "rok-nav"}>
      <Link
        className="rok-nav__mark"
        href="/"
        aria-label="3rok, home"
        aria-current={pathname === "/" ? "page" : undefined}
      >
        3ROK
      </Link>
      <nav aria-label="Primary">
        <ul className="rok-nav__links">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                className="rok-nav__link eyebrow"
                href={link.href}
                aria-current={isActive(pathname, link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </header>
  );
}
