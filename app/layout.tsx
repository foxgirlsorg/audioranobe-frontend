import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast';
import { PlayerProvider } from '@/lib/player';
import NavBar from '@/components/NavBar';
import BannedBanner from '@/components/BannedBanner';
import Footer from '@/components/Footer';
import Player from '@/components/Player';

export const metadata: Metadata = {
  title: 'AudioRanobe — аудиокниги',
  description: 'Сообщество аудиокниг — слушайте, отслеживайте и находите озвученные тайтлы.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>
          <ToastProvider>
            <PlayerProvider>
              <div className="noise" aria-hidden="true" />
              <NavBar />
              <BannedBanner />
              <main className="container">{children}</main>
              <Footer />
              <Player />
            </PlayerProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
