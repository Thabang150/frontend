'use client';

import { RefreshCw } from 'lucide-react';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="loading-card">
      <RefreshCw size={20} className="spin" />
      <span>{message}</span>
    </div>
  );
}
