import React, { useState, useEffect } from 'react';
import { formatDate } from '../../utils/dateUtils';
import { Eye, EyeOff, Layout, X } from 'lucide-react';
import api from '../../services/api';

export default function ResultPublish() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try { const r = await api.get('/result-publish/all'); setExams(r.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const fetchOverview = async (examId) => {
    setOverviewLoading(true);
    try {
      const r = await api.get(`/result-publish/exam/${examId}/overview`);
      setOverview(r.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Error fetching overview');
    } finally {
      setOverviewLoading(false);
    }
  };

  const toggle = async (exam) => {
    const action = exam.results_published ? 'unpublish' : 'publish';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} results for "${exam.exam_name}"?`)) return;
    try {
      await api.post(`/result-publish/${action}/${exam.exam_id}`);
      fetchAll();
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const statusColors = { 'Results Declared': 'bg-purple-100 text-purple-700', Completed: 'bg-green-100 text-green-700', Ongoing: 'bg-yellow-100 text-yellow-700', Upcoming: 'bg-blue-100 text-blue-700', Draft: 'bg-slate-100 text-slate-600' };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div><h1 className="text-2xl font-bold text-slate-900">Result Publishing</h1><p className="text-slate-500 text-sm mt-1">Control visibility of results to students</p></div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (<div className="p-12 text-center text-slate-400">Loading...</div>)
          : exams.length === 0 ? (<div className="p-12 text-center text-slate-400">No exams found</div>)
          : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Exam Name', 'Type', 'Semester', 'Exam Status', 'Results', 'Published At', 'Action'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map(e => (
                  <tr key={e.exam_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{e.exam_name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{e.exam_type || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">Sem {e.semester}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[e.status] || 'bg-slate-100 text-slate-600'}`}>{e.status}</span></td>
                    <td className="px-4 py-3">
                      {e.results_published
                        ? <span className="flex items-center gap-1 text-green-600 font-medium text-xs"><Eye className="w-3.5 h-3.5" /> Published</span>
                        : <span className="flex items-center gap-1 text-slate-400 text-xs"><EyeOff className="w-3.5 h-3.5" /> Hidden</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDate(e.published_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => fetchOverview(e.exam_id)} 
                          disabled={e.status !== 'Completed' && e.status !== 'Results Declared'}
                          className={`p-1.5 rounded-lg transition-colors ${e.status !== 'Completed' && e.status !== 'Results Declared' ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-violet-50 text-violet-600 hover:bg-violet-100'}`} 
                          title={e.status !== 'Completed' && e.status !== 'Results Declared' ? 'Results not compiled yet' : 'View Result Overview'}
                        >
                          <Layout className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggle(e)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${e.results_published ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                          {e.results_published ? 'Unpublish' : 'Publish'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {/* Overview Modal */}
      {overview && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{overview.exam_name} - Result Overview</h2>
                <p className="text-sm text-slate-500">Subject-wise marks review matrix</p>
              </div>
              <button onClick={() => setOverview(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr>
                    <th className="p-2 text-left bg-slate-100 border border-slate-200 sticky left-0 z-20 min-w-[150px]">Student Name</th>
                    <th className="p-2 text-left bg-slate-100 border border-slate-200 sticky left-[150px] z-20 min-w-[120px]">Enrollment</th>
                    {overview.subjects.map(s => (
                      <th key={s.id} className="p-2 text-center bg-slate-100 border border-slate-200 min-w-[140px]">
                        <div className="text-[10px] text-slate-500 font-mono">{s.code}</div>
                        <div className="text-xs whitespace-normal break-words leading-tight" title={s.name}>{s.name}</div>
                      </th>
                    ))}
                    <th className="p-2 text-center bg-slate-100 border border-slate-200 min-w-[70px]">SGPA</th>
                    <th className="p-2 text-center bg-slate-100 border border-slate-200 min-w-[70px]">CGPA</th>
                    <th className="p-2 text-center bg-slate-100 border border-slate-200 min-w-[70px]">Percentage</th>
                    <th className="p-2 text-center bg-slate-100 border border-slate-200 min-w-[70px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.students.map((student, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 border border-slate-200 font-medium text-slate-800 bg-white sticky left-0 z-10">{student.student_name}</td>
                      <td className="p-2 border border-slate-200 font-mono text-xs text-slate-500 bg-white sticky left-[150px] z-10">{student.enrollment_no}</td>
                      {overview.subjects.map(s => {
                        const m = student.marks[s.id];
                        if (!m) return <td key={s.id} className="p-2 border border-slate-200 text-center text-slate-300">-</td>;
                        return (
                          <td key={s.id} className="p-2 border border-slate-200 text-center">
                            <div className={`font-bold ${m.grade === 'FF' ? 'text-red-600' : 'text-slate-700'}`}>
                              {m.grade === 'PP' ? (
                                <span className="text-green-600 font-bold">PP</span>
                              ) : (
                                <>
                                  {m.total} <span className="text-[10px] font-normal text-slate-400">({m.grade})</span>
                                </>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-2 border border-slate-200 text-center font-bold text-violet-700">{student.sgpa?.toFixed(2)}</td>
                      <td className="p-2 border border-slate-200 text-center font-bold text-blue-700">{student.cgpa?.toFixed(2) || '—'}</td>
                      <td className="p-2 border border-slate-200 text-center font-bold text-emerald-700">{student.percentage?.toFixed(2) || '—'}%</td>
                      <td className="p-2 border border-slate-200 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${student.status === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {student.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setOverview(null)} className="px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-200">
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}

      {overviewLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-[2px] z-[60] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-violet-900 animate-pulse">Generating Result Overview...</p>
          </div>
        </div>
      )}
    </div>
  );
}
