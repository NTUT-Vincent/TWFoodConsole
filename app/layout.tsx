import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TWFood｜台灣食品營養資料庫",
  description: "查詢台灣食品的營養成分、資料來源與審核狀態。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
