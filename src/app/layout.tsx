import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Merly Partner System", description: "Nền tảng đối tác Merly Shoes" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}
