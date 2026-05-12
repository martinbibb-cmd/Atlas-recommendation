import type { ReactNode } from 'react';
import { LoginPage } from './LoginPage';
import { useAtlasAuth } from './useAtlasAuth';
import { WorkspacePicker } from '../workspaces/WorkspacePicker';

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
    isAuthenticated,
    userProfile,
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
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

  if (!isAuthenticated || userProfile === null) {
    return <LoginPage />;
  }

  if (currentWorkspace === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: 420, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.4rem' }}>
          <h1 style={{ margin: '0 0 0.6rem', fontSize: '1.2rem' }}>Choose workspace</h1>
          <WorkspacePicker
            workspaces={workspaces}
            currentWorkspaceId={null}
            onSelectWorkspace={setCurrentWorkspace}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
