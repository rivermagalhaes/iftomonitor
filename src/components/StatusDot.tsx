import { statusLabels, type StatusKind } from '../lib/status';
export function StatusDot({ kind }: { kind: StatusKind }) { return <span className={'dot ' + kind} role="img" aria-label={statusLabels[kind]} title={statusLabels[kind]}/>; }
