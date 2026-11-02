import { BoutonAction, FormulaireAction } from "@/components/formulaires";
import { accesVoyage } from "@/server/acces";
import { getDb } from "@/server/db";
import { invitationsEnAttente, participantsDe } from "@/server/domaine/voyages";
import { actionAnnulerInvitation, actionChangerRole, actionInviter, actionRetirerParticipant } from "../../actions";

export const metadata = { title: "Participants" };

const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

export default async function Participants({ params }: PageProps<"/voyages/[slug]/participants">) {
  const { slug } = await params;
  const { voyage, estAdmin, utilisateur } = await accesVoyage(slug);
  const db = await getDb();
  const [participants, invitations] = await Promise.all([
    participantsDe(db, voyage.id),
    estAdmin ? invitationsEnAttente(db, voyage.id) : Promise.resolve([]),
  ]);

  const seulAdmin = participants.filter((p) => p.role === "admin").length === 1;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-4">
        <h2 className="text-2xl">Participants</h2>
        <ul className="divide-y divide-filet border-y border-filet">
          {participants.map((p) => {
            const soi = p.userId === utilisateur.id;
            return (
              <li key={p.userId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate">
                    {p.nom} {soi ? <span className="text-encre-douce">(vous)</span> : null}
                  </p>
                  <p className="truncate text-sm text-encre-douce">
                    {estAdmin ? `${p.email} · ` : ""}
                    {p.role === "admin" ? "Administrateur" : "Contributeur"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center">
                  {estAdmin && !soi ? (
                    <BoutonAction
                      libelle={p.role === "admin" ? "Rendre contributeur" : "Rendre administrateur"}
                      action={actionChangerRole.bind(null, slug, p.userId, p.role === "admin" ? "contributeur" : "admin")}
                    />
                  ) : null}
                  {estAdmin && !soi ? (
                    <BoutonAction
                      variante="danger"
                      libelle="Retirer"
                      confirmation={`Retirer ${p.nom} du voyage ? Ses photos resteront dans le voyage.`}
                      action={actionRetirerParticipant.bind(null, slug, p.userId)}
                    />
                  ) : null}
                  {soi && !(seulAdmin && p.role === "admin") ? (
                    <BoutonAction
                      variante="danger"
                      libelle="Quitter le voyage"
                      confirmation="Quitter ce voyage ? Il faudra une nouvelle invitation pour y revenir."
                      action={actionRetirerParticipant.bind(null, slug, p.userId)}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {estAdmin && invitations.length > 0 ? (
          <div className="space-y-3 pt-4">
            <h3 className="etiquette">Invitations en attente</h3>
            <ul className="divide-y divide-filet border-y border-filet">
              {invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate">{i.email}</p>
                    <p className="text-sm text-encre-douce">
                      {i.role === "admin" ? "Administrateur" : "Contributeur"} · valable jusqu’au {fmt.format(i.expireLe)}
                    </p>
                  </div>
                  <BoutonAction variante="danger" libelle="Annuler" action={actionAnnulerInvitation.bind(null, slug, i.id)} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {estAdmin ? (
        <aside className="space-y-4">
          <h2 className="text-2xl">Inviter</h2>
          <p className="text-sm text-encre-douce">
            La personne reçoit un e-mail. Elle se connecte avec cette adresse, sans mot de passe, et n’accède qu’à ce
            voyage.
          </p>
          <FormulaireAction action={actionInviter.bind(null, slug)} bouton="Envoyer l’invitation">
            <label className="block space-y-1.5">
              <span className="etiquette">Adresse e-mail</span>
              <input name="email" type="email" className="champ" required autoComplete="off" />
            </label>
            <fieldset className="space-y-2">
              <legend className="etiquette">Rôle</legend>
              <label className="flex items-start gap-2">
                <input type="radio" name="role" value="contributeur" defaultChecked className="mt-1" />
                <span>
                  Contributeur
                  <span className="block text-sm text-encre-douce">Importe, légende, commente, commande ses livres.</span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="role" value="admin" className="mt-1" />
                <span>
                  Administrateur
                  <span className="block text-sm text-encre-douce">Gère aussi les participants, le site et le livre.</span>
                </span>
              </label>
            </fieldset>
          </FormulaireAction>
        </aside>
      ) : null}
    </div>
  );
}
