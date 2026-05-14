import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";
import { ToastProvider } from "@/components/toast-provider";

export const metadata: Metadata = {
  title: "5CBid",
  description: "5CBid: The Bidding Platform for 5C Students"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
