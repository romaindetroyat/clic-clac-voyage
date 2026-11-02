import { Marque } from "./marque";
import Link from "next/link";

export function Entete({ nom, children }: { nom: string; children?: React.ReactNode }) {
  return (
    <header className="border-b border-filet">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Marque />
        <div className="flex items-center gap-2">
          {children}
          <Link href="/compte" className="min-h-11 content-center rounded-md px-2 text-sm text-encre-douce hover:text-encre">
            {nom}
          </Link>
        </div>
      </div>
    </header>
  );
}
