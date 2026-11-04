'use client';
import { useEffect } from 'react';
import { useSession } from './session';

// Opening the inbox marks everything read.
export function InboxRead() {
  const { markRead } = useSession();
  useEffect(() => {
    fetch('/api/messages', { method: 'POST' }).then(() => markRead()).catch(() => {});
  }, [markRead]);
  return null;
}
