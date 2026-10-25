import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TWFood Console | OKF Review Workspace",
  description: "Browse and review Taiwan food nutrition knowledge from TWFoodMCP Open Knowledge Format."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
