import type { AtlasWorkspaceV1 } from '../auth/authTypes';

interface WorkspacePickerProps {
  workspaces: AtlasWorkspaceV1[];
  currentWorkspaceId: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
}

export function WorkspacePicker({ workspaces, currentWorkspaceId, onSelectWorkspace }: WorkspacePickerProps) {
  if (workspaces.length === 0) {
    return (
      <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
        No workspaces found.
      </p>
    );
  }

  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>
        Workspace
      </span>
      <select
        value={currentWorkspaceId ?? (workspaces[0]?.workspaceId ?? '')}
        onChange={(event) => onSelectWorkspace(event.target.value)}
        style={{
          width: '100%',
          padding: '0.55rem 0.75rem',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          fontSize: '0.95rem',
          background: '#fff',
        }}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.workspaceId} value={workspace.workspaceId}>
            {workspace.name}
          </option>
        ))}
      </select>
    </label>
  );
}
