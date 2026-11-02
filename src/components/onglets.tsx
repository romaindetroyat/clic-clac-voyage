"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Onglets({ liens }: { liens: { href: string; libelle: string }[] }) {
  const chemin = usePathname();
  return (
    <nav aria-label="Sections du voyage" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1 border-b border-filet">
        {liens.map((l) => {
          const actif = chemin === l.href;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={actif ? "page" : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm ${
                  actif ? "border-encre text-encre" : "border-transparent text-encre-douce hover:text-encre"
                }`}
              >
                {l.libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
