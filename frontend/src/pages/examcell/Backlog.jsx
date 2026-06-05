import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../../services/api';

export default function Backlog() {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [backlogs, setBacklogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get('/exam-setup/').then(r => setExams(r.data)).catch(console.error);
    api.get('/backlog/summary').then(r => setSummary(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedExam) return;
    setLoading(true);
    api.get(`/backlog/exam/${selectedExam}`).then(r => setBacklogs(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [selectedExam]);

  const clearBacklog = async (studentId, subjectId, examId) => {
    try {
      await api.post('/backlog/clear', { student_id: studentId, subject_id: subjectId, original_exam_id: examId });
      setBacklogs(prev => prev.map(b => b.student_id === studentId && b.subject_id === subjectId ? { ...b, status: 'Cleared' } : b));
    } catch (err) { alert('Error'); }
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Backlog / ATKT Tracker</h1>
        <p className="text-slate-500 text-sm mt-1">Track and manage failed subjects</p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-slate-800">{summary.total_backlogs}</div><div className="text-sm text-slate-500">Total Backlogs</div></div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-red-700">{summary.students_with_pending_backlogs}</div><div className="text-sm text-red-500">Students with Pending</div></div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-green-700">{summary.by_status?.Cleared || 0}</div><div className="text-sm text-green-600">Cleared</div></div>
        </div>
      )}

      <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[220px]">
        <option value="">— Select Exam —</option>
        {exams.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
      </select>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!selectedExam ? (<div className="p-12 text-center text-slate-400">Select an exam to view backlogs</div>)
          : loading ? (<div className="p-12 text-center text-slate-400">Loading...</div>)
          : backlogs.length === 0 ? (<div className="p-12 text-center text-slate-400">No backlogs for this exam 🎉</div>)
          : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Student', 'Enrollment', 'Subject', 'Grade', 'Status', 'Action'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backlogs.map(b => (
                  <tr key={b._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{b.student_name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.enrollment_no || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{b.subject_name || b.subject_id}</td>
                    <td className="px-4 py-3 font-bold text-red-600">{b.grade}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${b.status === 'Cleared' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{b.status}</span></td>
                    <td className="px-4 py-3">
                      {b.status !== 'Cleared' && (
                        <button onClick={() => clearBacklog(b.student_id, b.subject_id, b.exam_id)} className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">Mark Cleared</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
