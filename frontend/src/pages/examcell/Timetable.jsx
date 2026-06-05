import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';

export default function Timetable() {
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ subject_id: '', date: '', start_time: '10:00', end_time: '13:00', room: '' });

  useEffect(() => {
    api.get('/exam-setup/').then(r => setExams(r.data)).catch(console.error);
    api.get('/academic/subjects').then(r => setSubjects(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedExam) return;
    setLoading(true);
    api.get(`/timetable/${selectedExam}`).then(r => setEntries(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [selectedExam]);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/timetable/', { exam_id: selectedExam, ...form });
      setShowModal(false);
      setForm({ subject_id: '', date: '', start_time: '10:00', end_time: '13:00', room: '' });
      const r = await api.get(`/timetable/${selectedExam}`);
      setEntries(r.data);
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/timetable/${id}`);
      setEntries(entries.filter(e => e._id !== id));
    } catch (err) { alert('Delete failed'); }
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timetable Management</h1>
          <p className="text-slate-500 text-sm mt-1">Create subject-wise exam schedule</p>
        </div>
        <button onClick={() => setShowModal(true)} disabled={!selectedExam} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[220px]">
        <option value="">— Select Exam —</option>
        {exams.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
      </select>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!selectedExam ? (
          <div className="p-12 text-center text-slate-400">Select an exam to view / edit timetable</div>
        ) : loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No timetable entries yet. Add the first one.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Subject', 'Code', 'Date', 'Start Time', 'End Time', 'Room', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(e => (
                <tr key={e._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{e.subject_name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.subject_code || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{e.date}</td>
                  <td className="px-4 py-3 text-slate-600">{e.start_time}</td>
                  <td className="px-4 py-3 text-slate-600">{e.end_time || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{e.room || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(e._id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Add Timetable Entry</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
                <select required value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">— Select Subject —</option>
                  {subjects.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Date *</label><input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Room</label><input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="e.g. Hall A" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label><input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">End Time</label><input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors">Add Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
