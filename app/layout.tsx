import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { VedaProvider } from "@/lib/context";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VedaAI — AI Assessment Extraction & Answer Mapping",
  description: "Upload question papers and handwritten answer sheets for automated AI grading and mapping.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${poppins.variable}`}>
      <body
        className={`${poppins.className} antialiased h-full bg-slate-50 text-slate-900`}
      >
        <VedaProvider>
          {children}
        </VedaProvider>
      </body>
    </html>
  );
}
