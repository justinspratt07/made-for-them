import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Made For Them | Thoughtful DIY Gift Ideas",
  description:
    "Find handmade gift ideas matched to the person, occasion, time, budget, craft type, and feeling you want.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
