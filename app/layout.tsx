import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ClientRequestCache from "@/components/ClientRequestCache";

export const metadata: Metadata = {
  title: "Noll Studios - NSU | Creative Studio",
  description:
    "Noll Studios (NSU) - Your description here. Discover our work and services.",
  metadataBase: new URL("https://nollstudios.org"),
  icons: {
    icon: [{ url: "/NollPage-v3.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Noll Studios - NSU | Creative Studio",
    description:
      "Noll Studios (NSU) - Your description here. Discover our work and services.",
    url: "https://nollstudios.org",
    siteName: "Noll Studios (NSU)",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  const savedTheme = localStorage.getItem('nsu-theme') || localStorage.getItem('theme_mode');
                  if (savedTheme !== 'light') document.documentElement.classList.add('dark');
                } catch {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ClientRequestCache />
        {children}
      </body>
    </html>
  );
}
