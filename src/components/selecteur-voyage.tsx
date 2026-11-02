"use client";

import { useRouter } from "next/navigation";

export function SelecteurVoyage({ voyages, actuel }: { voyages: { slug: string; nom: string }[]; actuel: string }) {
  const router = useRouter();
  if (voyages.length < 2) return null;
  return (
    <label className="sr-only-focusable">
      <span className="sr-only">Changer de voyage</span>
      <select
        className="max-w-44 rounded-md border border-filet bg-papier px-2 py-2 text-sm"
        value={actuel}
        onChange={(e) => router.push(`/voyages/${e.target.value}`)}
      >
        {voyages.map((v) => (
          <option key={v.slug} value={v.slug}>
            {v.nom}
          </option>
        ))}
      </select>
    </label>
  );
}
