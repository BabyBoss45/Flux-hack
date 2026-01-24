import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flux Interior Studio",
  description: "AI-powered interior design generation demo"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="page-shell">
        <header className="border-b border-white/5 bg-background/80 backdrop-blur">
          <div className="flex items-center justify-between px-2 lg:px-4 py-3 w-full">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent to-fuchsia-500 shadow-lg" />
              <div>
                <p className="text-sm font-semibold tracking-tight">
                  Flux Interior Studio
                </p>
                <p className="text-[11px] text-white/50">
                  Floorplan → Room-by-room → Final reveal
                </p>
              </div>
            </div>
            <nav className="hidden sm:flex items-center gap-3 text-xs text-white/60">
              <a href="/" className="hover:text-white transition-colors">
                1. Questionnaire
              </a>
              <span className="text-white/25">•</span>
              <a href="/rooms" className="hover:text-white transition-colors">
                2. Room by room
              </a>
              <span className="text-white/25">•</span>
              <a href="/final" className="hover:text-white transition-colors">
                3. Final result
              </a>
            </nav>
          </div>
        </header>
        <main className="page-main">{children}</main>
      </body>
    </html>
  );
}


