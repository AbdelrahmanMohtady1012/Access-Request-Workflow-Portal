

export const labels: Record<string, string> = { PENDING: 'In progress', NEEDS_INFORMATION: 'Needs information', APPROVED: 'Approved', REJECTED: 'Rejected', LINE_MANAGER: 'Line manager', APPLICATION_OWNER: 'Application owner', SECURITY: 'Security review', COMPLETED: 'Completed', READ_ONLY: 'Read only', STANDARD: 'Standard', ADMIN: 'Administrator', EMPLOYEE: 'Employee', MANAGER: 'Line manager' };
export const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
export const initials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('');
