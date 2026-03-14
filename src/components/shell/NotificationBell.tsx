'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';
import { cn } from '@/lib/utils';

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, dismiss, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative flex h-7 w-7 items-center justify-center rounded transition-colors"
        style={{
          border: '1px solid var(--border)',
          backgroundColor: open ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
          color: 'var(--text-tertiary)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--text)';
          e.currentTarget.style.borderColor = 'var(--border-strong)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--text-tertiary)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-lg shadow-xl animate-fade-in z-50"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-strong)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
              Notifications
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] font-medium transition-colors"
                  style={{ color: 'var(--accent)' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[11px] font-medium transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="h-5 w-5 mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>No notifications yet</p>
              </div>
            ) : (
              <div className="p-1.5">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      'group flex items-start gap-3 rounded px-3 py-2.5 transition-all cursor-pointer',
                    )}
                    style={{
                      backgroundColor: !n.read ? 'var(--accent-subtle)' : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = !n.read ? 'var(--accent-subtle)' : 'transparent')}
                  >
                    {/* Unread dot */}
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: n.read ? 'var(--border-strong)' : 'var(--accent)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[12px] font-medium truncate"
                          style={{ color: 'var(--text)' }}
                        >
                          {n.ruleName}
                        </span>
                        {n.pool && (
                          <span
                            className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                            style={{
                              border: '1px solid var(--border)',
                              backgroundColor: 'var(--bg-elevated)',
                              color: 'var(--text-tertiary)',
                            }}
                          >
                            {n.pool}
                          </span>
                        )}
                        <span className="shrink-0 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {timeAgo(n.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {n.triggerReason}
                      </p>
                      {n.conditions.length > 0 && (
                        <p
                          className="text-[10px] mt-0.5 truncate"
                          style={{ color: 'var(--accent)' }}
                        >
                          {n.conditions.join(' · ')}
                        </p>
                      )}
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                        → {n.message}
                      </p>
                    </div>
                    {/* Inline actions */}
                    <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="flex h-5 w-5 items-center justify-center rounded transition-colors"
                          style={{ color: 'var(--text-tertiary)' }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = 'var(--text)';
                            e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = 'var(--text-tertiary)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title="Mark read"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => dismiss(n.id)}
                        className="flex h-5 w-5 items-center justify-center rounded transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = 'var(--text)';
                          e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = 'var(--text-tertiary)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
