import Link from "next/link";

export function Marque({ href = "/voyages" }: { href?: string }) {
  return (
    <Link href={href} className="font-titre text-xl tracking-tight text-encre">
      Clic-Clac <span className="italic text-accent">Voyage</span>
    </Link>
  );
}
