import type { Metadata } from "next";
import { Geist, Geist_Mono, Fredoka } from "next/font/google";
import { AuthProvider } from "@/lib/AuthProvider";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { ThemeMascot } from "@/components/ThemeMascot";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kairos",
  description:
    "A companion agent that remembers you over time - chat, a coding assistant, document Q&A, notes, and a roast battle game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable}`}
    >
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ThemeMascot />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
