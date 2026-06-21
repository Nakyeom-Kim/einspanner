import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Einspanner Road",
  description: "가장 맛있는 아인슈페너를 찾아서",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";
  return (
    <html
      lang="ko"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full bg-zinc-100 dark:bg-zinc-950 flex justify-center items-start">
        <div className="w-full max-w-[430px] min-h-screen bg-background text-foreground shadow-2xl border-x border-zinc-200 dark:border-zinc-800 flex flex-col relative overflow-hidden">
          {children}
        </div>
        <Script
          src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`}
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
