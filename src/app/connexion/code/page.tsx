import { Marque } from "@/components/marque";
import { ConnexionParLien } from "./connexion-par-lien";

export const metadata = { title: "Connexion" };

export default async function ConnexionCode({ searchParams }: PageProps<"/connexion/code">) {
  const { email, code } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <Marque href="/" />
      <ConnexionParLien email={typeof email === "string" ? email : ""} code={typeof code === "string" ? code : ""} />
    </main>
  );
}
