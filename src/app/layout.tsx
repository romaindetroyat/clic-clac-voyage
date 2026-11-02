import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { EnregistrementServiceWorker } from "@/components/service-worker";
import "./globals.css";

const titre = Cormorant_Garamond({ variable: "--font-titre", subsets: ["latin"], weight: ["500", "600"] });
const texte = Inter({ variable: "--font-texte", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Clic-Clac Voyage", template: "%s · Clic-Clac Voyage" },
  description: "Les photos de votre voyage, réunies, racontées, puis en site et en livre.",
  applicationName: "Clic-Clac Voyage",
  appleWebApp: { capable: true, title: "Clic-Clac", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#151412" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${titre.variable} ${texte.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <EnregistrementServiceWorker />
      </body>
    </html>
  );
}
