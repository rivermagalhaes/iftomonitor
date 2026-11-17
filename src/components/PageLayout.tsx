import type { ReactNode } from 'react';
export function PageLayout({ children }: { children: ReactNode }) {
    return <div className="pageLayout" data-testid="page-layout"><div className="statusBarShield" aria-hidden="true" data-testid="status-bar-shield"/>{children}</div>;
}
