/** Fichiers d'un glisser-déposer, en descendant dans les dossiers (carte SD, export Photos…). */
export async function fichiersDepuisDepot(dt: DataTransfer): Promise<File[]> {
  const entrees = [...dt.items]
    .map((i) => (typeof i.webkitGetAsEntry === "function" ? i.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => !!e);
  if (!entrees.length) return [...dt.files];
  const resultat: File[] = [];
  async function parcourir(e: FileSystemEntry): Promise<void> {
    if (e.isFile) {
      const f = await new Promise<File>((ok, ko) => (e as FileSystemFileEntry).file(ok, ko));
      if (!f.name.startsWith(".")) resultat.push(f);
    } else if (e.isDirectory) {
      const lecteur = (e as FileSystemDirectoryEntry).createReader();
      // readEntries renvoie les entrées par paquets : on lit jusqu'à épuisement.
      for (;;) {
        const lot = await new Promise<FileSystemEntry[]>((ok, ko) => lecteur.readEntries(ok, ko));
        if (!lot.length) break;
        for (const x of lot) await parcourir(x);
      }
    }
  }
  for (const e of entrees) await parcourir(e);
  return resultat;
}
