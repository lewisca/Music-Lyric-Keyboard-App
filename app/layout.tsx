import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Say It",
  description:
    "Finish an unspoken feeling with a licensed song lyric. A propose → resolve → verify prototype.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
