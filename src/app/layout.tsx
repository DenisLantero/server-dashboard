import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Serverspace · I tuoi server",
  description: "La tua dashboard personale per i server di gioco.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className="dark h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
