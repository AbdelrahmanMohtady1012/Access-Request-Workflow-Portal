import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

export default function Help() {
  const steps: { title: string; text: ReactNode }[] = [{ title: 'Create your request', text: 'Select an application, choose the least access you need, and explain the business reason. Your manager, application owner, and security reviewer must be configured before you can submit.' }, { title: 'Follow the approvals', text: 'Requests pass through line manager, application owner, and security review in that order. Only the current assigned approver can record a decision. Any rejection ends the workflow.' }, { title: 'Respond to questions', text: 'If an approver needs more information, the request comes back to you. Open it from My requests, read their question, and send your response. The request returns to that same approver.' }, { title: 'Check the outcome', text: 'Your request is approved once all three stages are complete. The portal records the approval decision; application access is provisioned separately by your internal team.' }];
  return <><div className="page-heading"><div><div className="section-kicker">A LITTLE GUIDANCE</div><h1>Your access workflow</h1><p>Know where your request goes and what happens next.</p></div></div><div className="help-content panel">{steps.map((s, i) => <div key={s.title}><span>{i + 1}</span><section><h2>{s.title}</h2><p>{s.text}</p></section></div>)}<Link className="button primary" to="/requests/new"><Plus size={17} />New access request</Link></div></>;
}
