import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { AccessRequest } from '../types';

export function useRequests(scope: 'mine' | 'pending') {
  const [data, setData] = useState<AccessRequest[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(() => { setLoading(true); setError(''); api.requests(scope).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false)); }, [scope]);
  useEffect(load, [load]);
  return { data, loading, error, load };
}
