import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, RefreshCw, CheckCheck } from 'lucide-react';
import { useRequests } from '../hooks/useRequests';
import { ErrorNotice, Loading } from '../components/ui';
import RequestTable from '../components/RequestTable';

export default function RequestList({ scope }: { scope: 'mine' | 'pending' }) {
  const { data, loading, error, load } = useRequests(scope);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(new URLSearchParams(window.location.search).get('status') || 'ALL');
  const isPending = scope === 'pending';
  const filtered = data.filter(r => (status === 'ALL' || r.status === status || (status === 'PENDING' && r.status === 'NEEDS_INFORMATION')) && `${r.applicationName} ${r.reference} ${r.requesterName}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { setQuery(''); setStatus(new URLSearchParams(window.location.search).get('status') || 'ALL'); }, [scope]);
  return <><div className="page-heading"><div><div className="section-kicker">{isPending ? 'KEEP WORK MOVING' : 'YOUR ACCESS JOURNEY'}</div><h1>{isPending ? 'Pending approvals' : 'My requests'}</h1><p>{isPending ? 'Review the requests that need your decision.' : 'Track and manage every access request in one place.'}</p></div>{!isPending && <Link to="/requests/new" className="button primary"><Plus size={18} />New access request</Link>}</div>{error && <ErrorNotice message={error} retry={load} />}<section className="panel"><div className="list-toolbar"><div className="search-field"><Search size={18} /><input aria-label="Search requests" placeholder="Search application, request ID or requester…" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="toolbar-actions">{!isPending && <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">All statuses</option><option value="PENDING">In progress</option><option value="NEEDS_INFORMATION">Needs information</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>}<button className="icon-button" onClick={load} aria-label="Refresh requests"><RefreshCw size={17} /></button></div></div><div className="list-summary">{filtered.length} {isPending ? 'pending approval' : 'request'}{filtered.length !== 1 ? 's' : ''}{query && ' matching your search'}</div>{loading ? <Loading /> : isPending && !data.length ? <div className="empty"><span className="empty-icon green"><CheckCheck size={28} /></span><h3>You’re all caught up</h3><p>There are no requests waiting for your approval.</p></div> : <RequestTable requests={filtered} />}</section></>;
}
