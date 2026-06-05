import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [actions, setActions] = useState([]);
  const [filterAction, setFilterAction] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 50 });
    if (filterAction) params.append('action', filterAction);
    try {
      const r = await api.get(`/audit/?${params}`);
      setLogs(r.data.logs);
      setTotalPages(r.data.pages);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/audit/stats').then(r => setStats(r.data)).catch(console.error);
    api.get('/audit/actions').then(r => setActions(r.data)).catch(console.error);
  }, []);

  useEffect(() => { fetchLogs(); }, [page, filterAction]);

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1><p className="text-slate-500 text-sm mt-1">Complete trail of admin and exam cell actions</p></div>
        <button onClick={fetchLogs} className="flex items-center gap-2 text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-slate-800">{stats.total_logs}</div><div className="text-sm text-slate-500">Total Actions</div></div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-500 mb-2">Top Actions</div>
            {(stats.top_actions || []).slice(0, 3).map(a => (
              <div key={a.action} className="flex justify-between text-xs text-slate-600 py-0.5"><span className="truncate">{a.action}</span><span className="font-semibold ml-2">{a.count}</span></div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-500 mb-2">Top Users</div>
            {(stats.top_users || []).slice(0, 3).map(u => (
              <div key={u.user} className="flex justify-between text-xs text-slate-600 py-0.5"><span className="truncate">{u.user || 'System'}</span><span className="font-semibold ml-2">{u.count}</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[200px]">
          <option value="">All Actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (<div className="p-12 text-center text-slate-400">Loading...</div>)
          : logs.length === 0 ? (<div className="p-12 text-center text-slate-400">No audit logs found</div>)
          : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>{['Timestamp', 'User', 'Action', 'Details'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map(log => (
                    <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{formatDate(log.timestamp)}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs">{log.user || 'System'}</td>
                      <td className="px-4 py-2.5"><span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{log.action}</span></td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">{JSON.stringify(log.details || {})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border border-slate-200 rounded text-xs disabled:opacity-50 hover:bg-slate-50 transition-colors">Prev</button>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border border-slate-200 rounded text-xs disabled:opacity-50 hover:bg-slate-50 transition-colors">Next</button>
                </div>
              </div>
            </>
          )}
      </div>
    </div>
  );
}
