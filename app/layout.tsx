import type { Metadata, Viewport } from 'next';
import './globals.css';
import './markdown.css';
import { AuthProvider } from '@/lib/auth';
import { ConfigProvider } from '@/lib/config';
import { BadgesProvider } from '@/lib/badges';
import { MyNarratorsProvider } from '@/lib/narrators';
import { ToastProvider } from '@/lib/toast';
import { PlayerProvider } from '@/lib/player';
import NavBar from '@/components/NavBar/NavBar';
import BannedBanner from '@/components/BannedBanner/BannedBanner';
import CookiesBanner from '@/components/CookiesBanner/CookiesBanner';
import Footer from '@/components/Footer/Footer';
import Player from '@/components/Player/Player';
import DragScroll from '@/components/DragScroll/DragScroll';

export const metadata: Metadata = {
  title: 'AudioRanobe — аудиокниги',
  description: 'Сообщество аудиокниг — слушайте, отслеживайте и находите озвученные тайтлы.',
  icons: { icon: '/favicon.svg' },
};

// viewportFit: 'cover' lets the page draw under the notch/home-indicator area
// on iOS/Android so env(safe-area-inset-*) actually resolves to a real value
// instead of 0 — needed so the fixed player bar can pad itself above the
// gesture nav bar instead of sitting flush against it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>
          <ConfigProvider>
            <BadgesProvider>
              <MyNarratorsProvider>
                <ToastProvider>
                  <PlayerProvider>
                    <div className="noise" aria-hidden="true" />
                    <DragScroll />
                    <NavBar />
                    <BannedBanner />
                    <CookiesBanner />
                    <main className="container">{children}</main>
                    <Footer />
                    <Player />
                  </PlayerProvider>
                </ToastProvider>
              </MyNarratorsProvider>
            </BadgesProvider>
          </ConfigProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
