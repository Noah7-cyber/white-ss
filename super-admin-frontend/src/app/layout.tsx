import type { Metadata } from "next";
import "./globals.css";
import Providers from "./Providers";
import AppErrorBoundary from "@/components/AppErrorBoundary/appErrorBoundary";

export const metadata: Metadata = {
  title: "Super Admin Portal",
  description: "System administration for WhitePenguin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppErrorBoundary>
          <Providers>{children}</Providers>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
