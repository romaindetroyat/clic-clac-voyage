import { accesVoyage } from "@/server/acces";
import { Importeur } from "./importeur";

export const metadata = { title: "Importer" };

export default async function Importer({ params }: PageProps<"/voyages/[slug]/importer">) {
  const { slug } = await params;
  const { voyage } = await accesVoyage(slug);
  return <Importeur voyage={voyage.slug} />;
}
