import { Link } from 'react-router-dom';
import { FileText, ArrowRight, ChevronRight } from 'lucide-react';
import type { AccessRequest } from '../types';
import { labels, formatDate } from '../lib/format';
import { AppIcon, Badge } from './ui';

export default function RequestTable({ requests, compact = false }: { requests: AccessRequest[]; compact?: boolean }) {
  if (!requests.length) return <div className="empty"><span className="empty-icon"><FileText size={28} /></span><h3>No requests to show</h3><p>Your requests will appear here as they move through approvals.</p><Link to="/requests/new" className="text-link">Create an access request <ArrowRight size={15} /></Link></div>;
  return <div className="table-scroll"><table><thead><tr><th>APPLICATION / REQUEST</th><th>STATUS</th>{!compact && <th>CURRENT OWNER</th>}<th>SUBMITTED</th><th><span className="sr-only">View</span></th></tr></thead><tbody>{requests.map(r => <tr key={r.id}><td><Link to={'/requests/' + r.id} className="app-cell"><AppIcon name={r.applicationName} /><div><strong>{r.applicationName}</strong><small>{r.reference} <span>·</span> {labels[r.accessLevel]}</small></div></Link></td><td><Badge status={r.status} /></td>{!compact && <td><div className="owner-cell">{r.currentOwnerName || 'Completed'}<small>{labels[r.stage]}</small></div></td>}<td className="date-cell">{formatDate(r.createdAt)}</td><td><Link className="row-link" aria-label={'View request ' + r.reference} to={'/requests/' + r.id}><ChevronRight size={18} /></Link></td></tr>)}</tbody></table></div>;
}
