import { useEffect, useState } from 'react';
import { Link, NavLink, Routes, Route, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, ShieldCheck, ChevronRight, CircleHelp, ArrowUpRight, LogOut, Menu } from 'lucide-react';
import { api } from './api';
import type { User } from './types';
import { labels, initials } from './lib/format';
import { Brand, Loading, ErrorNotice } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RequestList from './pages/RequestList';
import CreateRequest from './pages/CreateRequest';
import RequestDetails from './pages/RequestDetails';
import Help from './pages/Help';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    api.me().then(setUser).catch(e => { if (e.status !== 401) setStartupError(e.message); }).finally(() => setLoading(false));
    const expired = () => setUser(null);
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  async function logout() { try { await api.logout(); setUser(null); navigate('/'); } catch (e) { setLogoutError((e as Error).message); } }
  if (loading) return <Loading />;
  if (!user) return <Login onLogin={setUser} startupError={startupError} />;
  return <div className="app-shell">
    <aside className={'sidebar ' + (mobileNav ? 'is-open' : '')}>
      <Link to="/" className="brand-link" onClick={() => setMobileNav(false)}><Brand /></Link>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav aria-label="Main navigation">
        {[{ to: '/', icon: LayoutDashboard, title: 'Overview' }, { to: '/requests', icon: FileText, title: 'My requests' }, { to: '/approvals', icon: ShieldCheck, title: 'Pending approvals' }].map(({ to, icon: Icon, title }) =>
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileNav(false)} className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}><Icon size={19} />{title}<ChevronRight className="nav-chevron" size={15} /></NavLink>)}
      </nav>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={23} /><h3>A little guidance?</h3><p>See how your access request moves from submission to approval.</p><Link to="/help" onClick={() => setMobileNav(false)}>View workflow guide <ArrowUpRight size={14} /></Link></div>
      <div className="security-note"><ShieldCheck size={15} /> Secure access. Every step.</div></div>
    </aside>
    {mobileNav && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <div className="main-shell"><header className="topbar"><div className="topbar-context"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={22} /></button><span className="workspace-dot" /> Employee workspace <span className="topbar-divider">/</span><span className="muted">Access management</span></div><div className="user-menu"><span className="avatar">{initials(user.name)}</span><div><strong>{user.name}</strong><small>{labels[user.role] || 'Application owner'}</small></div><button className="icon-button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button></div></header>
    <main className="page-content">{logoutError && <ErrorNotice message={logoutError} />}<Routes>
      <Route path="/" element={<Dashboard user={user} />} />
      <Route path="/requests" element={<RequestList scope="mine" />} />
      <Route path="/approvals" element={<RequestList scope="pending" />} />
      <Route path="/requests/new" element={<CreateRequest />} />
      <Route path="/requests/:id" element={<RequestDetails user={user} />} />
      <Route path="/help" element={<Help />} />
      <Route path="*" element={<div className="empty"><h1>Page not found</h1><Link to="/" className="button primary">Back to overview</Link></div>} />
    </Routes><footer className="page-footer"><span>AccessHub · Internal access management</span><span><ShieldCheck size={13} /> Protected by role-based access</span></footer></main></div>
  </div>;
}
