import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NOIR BARBER STUDIO",
  description: "Sistema completo de agendamentos para barbearia premium.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${cinzel.variable} ${inter.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full bg-[#0B0B0C] text-[#F5F3EF]">
        {children}
      </body>
    </html>
  );
}
