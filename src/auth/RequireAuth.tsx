import type { ReactNode } from 'react';
import { useAtlasAuth } from './useAtlasAuth';

interface RequireAuthProps {
  children: ReactNode;
}

function isPublicPathname(pathname: string): boolean {
  if (pathname.startsWith('/portal/')) return true;
  return false;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const {
    status,
  } = useAtlasAuth();

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (isPublicPathname(pathname)) return <>{children}</>;

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#64748b' }}>
        Loading Atlas auth…
      </div>
    );
  }

  return <>{children}</>;
}
