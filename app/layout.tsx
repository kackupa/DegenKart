import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Pepecoin Kart — Kekspace Circuit", description: "An independent Pepecoin community kart racer.", icons: { icon: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
