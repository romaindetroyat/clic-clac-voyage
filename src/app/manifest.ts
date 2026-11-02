import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clic-Clac Voyage",
    short_name: "Clic-Clac",
    description: "Les photos de votre voyage, réunies, racontées, puis en site et en livre.",
    lang: "fr",
    dir: "ltr",
    start_url: "/voyages",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f3ee",
    theme_color: "#1d1b18",
    // Menu « Partager » d'Android vers l'app (iOS ne le permet pas : voir la page d'aide iPhone).
    share_target: {
      action: "/partager/recevoir",
      method: "POST",
      enctype: "multipart/form-data",
      params: { files: [{ name: "fichiers", accept: ["image/*", "video/*", ".heic", ".heif", ".zip"] }] },
    },
    icons: [
      { src: "/icones/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
