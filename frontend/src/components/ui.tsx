import { ShieldCheck, AlertCircle, LoaderCircle } from 'lucide-react';
import type { Status } from '../types';
import { labels } from '../lib/format';

export function Brand() { return <div className="brand"><span className="brand-icon"><ShieldCheck size={24} /></span><span>Access<span className="font-normal">Hub</span><small>WORKFORCE ACCESS PORTAL</small></span></div>; }

export function Badge({ status }: { status: Status }) { return <span className={'badge badge-' + status.toLowerCase()}><span />{labels[status]}</span>; }

export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) { return <div className="error-notice" role="alert"><AlertCircle size={18} /><span>{message}</span>{retry && <button onClick={retry} className="text-button">Try again</button>}</div>; }

export function Loading() { return <div className="loading" role="status"><LoaderCircle size={24} className="animate-spin" /><span>Loading your workspace…</span></div>; }

export function AppIcon({ name }: { name: string }) { const letter = name === 'Power BI' ? 'BI' : name.slice(0, 1); return <span className={'application-icon app-' + (name.startsWith('Sales') ? 'blue' : name.startsWith('SAP') ? 'navy' : name.startsWith('Jira') ? 'indigo' : 'gold')}>{letter}</span>; }
