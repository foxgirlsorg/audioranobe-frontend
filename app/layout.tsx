import type { Metadata, Viewport } from 'next';
import 'react-photo-view/dist/react-photo-view.css';
import 'react-loading-skeleton/dist/skeleton.css';
import './globals.css';
import './markdown.css';
import './photo-view.css';
import { SkeletonTheme } from 'react-loading-skeleton';
import UmamiProvider from 'next-umami';
import { PhotoProvider } from '@/components/PhotoViewProvider/PhotoViewProvider';
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://audioranobe.com';
const SITE_TITLE = 'AudioRanobe — аудиокниги';
const SITE_DESCRIPTION = 'Сообщество аудиокниг — слушайте, отслеживайте и находите озвученные тайтлы.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: 'AudioRanobe',
    type: 'website',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConfigProvider>
        <BadgesProvider>
          <MyNarratorsProvider>
            <ToastProvider>
              <PlayerProvider>
                <a href="#main-content" className="skip-link">
                  {'Перейти к содержимому'}
                </a>
                <div className="noise" aria-hidden="true" />
                <DragScroll />
                <NavBar />
                <BannedBanner />
                <CookiesBanner />
                <SkeletonTheme baseColor="#232326" highlightColor="#302f34">
                  <PhotoProvider>
                    <main id="main-content" className="container">{children}</main>
                  </PhotoProvider>
                </SkeletonTheme>
                <Footer />
                <Player />
              </PlayerProvider>
            </ToastProvider>
          </MyNarratorsProvider>
        </BadgesProvider>
      </ConfigProvider>
    </AuthProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ? (
          <UmamiProvider
            websiteId={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            src="/stats/script.js"
            hostUrl="/stats"
            domains={process.env.NEXT_PUBLIC_UMAMI_DOMAINS}
          >
            <AppProviders>{children}</AppProviders>
          </UmamiProvider>
        ) : (
          <AppProviders>{children}</AppProviders>
        )}
      </body>
    </html>
  );
}
