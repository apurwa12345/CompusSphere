import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import api from '../../services/api';

export default function Supplementary() {
  const [exams, setExams] = useState([]);
  const [suppExams, setSuppExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', semester: 1, parent_exam_id: '', start_date: '', end_date: '', department_id: 'ALL' });

  useEffect(() => {
    api.get('/exam-setup/').then(r => setExams(r.data)).catch(console.error);
    api.get('/supplementary/').then(r => setSuppExams(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/supplementary/', form);
      setShowModal(false);
      const r = await api.get('/supplementary/');
      setSuppExams(r.data);
    } catch (err) { alert(err.response?.data?.message || 'Error creating exam'); }
  };

  const statusColors = { Upcoming: 'bg-blue-100 text-blue-700', Ongoing: 'bg-yellow-100 text-yellow-700', Completed: 'bg-green-100 text-green-700' };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Supplementary / ATKT Exams</h1><p className="text-slate-500 text-sm mt-1">Manage re-examination sessions for backlog students</p></div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Supplementary Exam
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (<div className="p-12 text-center text-slate-400">Loading...</div>)
          : suppExams.length === 0 ? (<div className="p-12 text-center text-slate-400">No supplementary exams created yet</div>)
          : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Exam Name', 'Semester', 'Start Date', 'End Date', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppExams.map(e => (
                  <tr key={e._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{e.name}</td>
                    <td className="px-4 py-3 text-slate-600">Sem {e.semester}</td>
                    <td className="px-4 py-3 text-slate-500">{e.start_date || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{e.end_date || '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[e.status] || 'bg-slate-100 text-slate-600'}`}>{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Create Supplementary Exam</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="e.g. ATKT Exam - May 2026" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Semester</label><input type="number" min={1} max={8} value={form.semester} onChange={e => setForm({ ...form, semester: parseInt(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Parent Exam (optional)</label>
                  <select value={form.parent_exam_id} onChange={e => setForm({ ...form, parent_exam_id: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">— None —</option>
                    {exams.map(ex => <option key={ex._id} value={ex._id}>{ex.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">End Date</label><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
