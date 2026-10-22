import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, ChevronRight, FileText, ShieldCheck, CheckCheck, LoaderCircle } from 'lucide-react';
import { api } from '../api';
import type { User } from '../types';
import { Brand, ErrorNotice } from '../components/ui';

export default function Login({ onLogin, startupError }: { onLogin: (user: User) => void; startupError: string }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(startupError); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); setBusy(true); try { onLogin(await api.login(email, password)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className="login-page"><section className="login-story"><Brand /><div><div className="eyebrow">THE RIGHT ACCESS. THE RIGHT WAY.</div><h1>Great work starts<br />with the right access<span>.</span></h1><p>One place to request access, follow approvals, and keep your work moving.</p><div className="login-flow"><span><FileText />Request</span><ChevronRight /><span><ShieldCheck />Review</span><ChevronRight /><span><CheckCheck />Ready</span></div></div><small>AccessHub · Your secure employee workspace</small></section><section className="login-form-wrap"><form onSubmit={submit} className="login-form"><span className="section-kicker">WELCOME TO ACCESSHUB</span><h2>Sign in to your workspace</h2><p className="muted">Use your work account to manage application access.</p>{error && <ErrorNotice message={error} />}<label>Work email<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" maxLength={254} /></label><label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" /></label><button className="button primary" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <>Sign in <ArrowRight size={17} /></>}</button><p className="login-support"><ShieldCheck size={15} /> Your access is secured and every action is recorded.</p></form></section></div>;
}
