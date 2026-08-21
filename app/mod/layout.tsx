import { cookies } from 'next/headers';
import { ModCollapseProvider, MOD_SIDEBAR_COOKIE } from './modSidebarCollapse';

export default function ModLayout({ children }: { children: React.ReactNode }) {
  const initialCollapsed = cookies().get(MOD_SIDEBAR_COOKIE)?.value === '1';
  return <ModCollapseProvider initialCollapsed={initialCollapsed}>{children}</ModCollapseProvider>;
}
