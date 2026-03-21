import React from 'react';

interface CursorPosition {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
}

interface Props {
  cursors: Map<string, CursorPosition>;
  users: Array<{ userId: string; userName: string; color: string }>;
  connected: boolean;
}

export function CollaborationCursors({ cursors, users, connected }: Props) {
  if (!connected) return null;

  return (
    <>
      {/* Presence indicator */}
      {users.length > 1 && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 4, padding: '4px 12px', borderRadius: 20,
          background: 'rgba(10, 22, 40, 0.9)', border: '1px solid rgba(0, 217, 255, 0.2)',
          zIndex: 50,
        }}>
          {users.map(u => (
            <div key={u.userId} style={{
              width: 24, height: 24, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: u.color, color: '#fff', fontSize: 10, fontWeight: 700,
              border: '2px solid rgba(255,255,255,0.3)',
            }} title={u.userName}>
              {u.userName.charAt(0).toUpperCase()}
            </div>
          ))}
          <span style={{ color: '#64748b', fontSize: 11, lineHeight: '24px', marginLeft: 4 }}>
            {users.length} online
          </span>
        </div>
      )}

      {/* Remote cursors */}
      {[...cursors.values()].map(cursor => (
        <div key={cursor.userId} style={{
          position: 'absolute', left: cursor.x, top: cursor.y,
          pointerEvents: 'none', zIndex: 100, transition: 'left 0.1s, top 0.1s',
        }}>
          <svg width="16" height="20" viewBox="0 0 16 20" style={{ filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.5))` }}>
            <path d="M0 0L16 12L8 12L4 20L0 0Z" fill={cursor.color} />
          </svg>
          <span style={{
            position: 'absolute', left: 16, top: 12,
            padding: '1px 6px', borderRadius: 4,
            background: cursor.color, color: '#fff',
            fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            {cursor.userName}
          </span>
        </div>
      ))}
    </>
  );
}
