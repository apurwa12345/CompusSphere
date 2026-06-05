import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../../services/api';

export default function Revaluation() {
  const [revs, setRevs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [updateModal, setUpdateModal] = useState(null);
  const [revisedMarks, setRevisedMarks] = useState('');
  const [remarks, setRemarks] = useState('');

  const fetchRevs = async () => {
    setLoading(true);
    const params = statusFilter ? `?status=${statusFilter}` : '';
    try { const r = await api.get(`/revaluation/all${params}`); setRevs(r.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchRevs(); }, [statusFilter]);

  const handleUpdate = async () => {
    try {
      await api.patch(`/revaluation/${updateModal._id}/update-marks`, { revised_marks: parseFloat(revisedMarks), remarks });
      setUpdateModal(null); setRevisedMarks(''); setRemarks(''); fetchRevs();
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const statusColors = { Pending: 'bg-yellow-100 text-yellow-700', 'Under Review': 'bg-blue-100 text-blue-700', Completed: 'bg-green-100 text-green-700' };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Revaluation</h1><p className="text-slate-500 text-sm mt-1">Process student revaluation requests</p></div>
        <button onClick={fetchRevs} className="flex items-center gap-2 text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>
      <div className="flex gap-2">
        {['', 'Pending', 'Under Review', 'Completed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>{s || 'All'}</button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (<div className="p-12 text-center text-slate-400">Loading...</div>)
          : revs.length === 0 ? (<div className="p-12 text-center text-slate-400">No revaluation requests</div>)
          : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Student', 'Enrollment', 'Subject', 'Original', 'Revised', 'Status', 'Action'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {revs.map(r => (
                  <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.student_name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.enrollment_no || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{r.subject_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.original_marks ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-violet-700">{r.revised_marks ?? '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[r.status] || 'bg-slate-100 text-slate-600'}`}>{r.status}</span></td>
                    <td className="px-4 py-3">
                      {r.status !== 'Completed' && (
                        <button onClick={() => { setUpdateModal(r); setRevisedMarks(r.original_marks || ''); }} className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">Update Marks</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
      {updateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Update Revaluation Marks</h3>
            <p className="text-sm text-slate-500 mb-4">{updateModal.student_name} — {updateModal.subject_name}</p>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Revised Marks (out of 70)</label>
                <input type="number" min={0} max={70} value={revisedMarks} onChange={e => setRevisedMarks(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Admin Remarks</label>
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" /></div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setUpdateModal(null)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={handleUpdate} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
