import React, { useState, useEffect } from 'react';
import { PlayCircle, Layout, X } from 'lucide-react';
import api from '../../services/api';

export default function ResultProcessing() {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  useEffect(() => { api.get('/exam-setup/').then(r => setExams(r.data)).catch(console.error); }, []);

  const fetchResults = async () => {
    if (!selectedExam) return;
    setLoading(true);
    try { const r = await api.get(`/results/exam/${selectedExam}`); setResults(r.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchResults(); }, [selectedExam]);

  const fetchOverview = async () => {
    if (!selectedExam) return;
    setOverviewLoading(true);
    try {
      const r = await api.get(`/result-publish/exam/${selectedExam}/overview`);
      setOverview(r.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Error fetching overview');
    } finally {
      setOverviewLoading(false);
    }
  };

  const compile = async () => {
    if (!window.confirm('Compile results for all approved students in this exam?')) return;
    setCompiling(true);
    try {
      const r = await api.post(`/results/compile/${selectedExam}`);
      alert(r.data.message);
      fetchResults();
    } catch (err) { alert(err.response?.data?.message || 'Compilation failed'); } finally { setCompiling(false); }
  };

  const gradeColor = (sgpa) => {
    if (sgpa >= 9) return 'text-green-700 font-bold';
    if (sgpa >= 7) return 'text-blue-600 font-bold';
    if (sgpa >= 5) return 'text-yellow-600 font-bold';
    return 'text-red-600 font-bold';
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Result Processing</h1>
          <p className="text-slate-500 text-sm mt-1">Compile total marks, grades and SGPA</p>
        </div>
        <div className="flex gap-3">
          {selectedExam && (
            <button onClick={fetchOverview} className="flex items-center gap-2 bg-white border border-violet-200 text-violet-600 hover:bg-violet-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              <Layout className="w-4 h-4" /> View Detailed Matrix
            </button>
          )}
          <button onClick={compile} disabled={!selectedExam || compiling} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-violet-200">
            <PlayCircle className="w-4 h-4" /> {compiling ? 'Compiling...' : 'Compile Results'}
          </button>
        </div>
      </div>

      <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[220px]">
        <option value="">— Select Exam —</option>
        {exams.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
      </select>

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total', value: results.length, cls: 'bg-slate-50 border-slate-200 text-slate-800' },
            { label: 'Passed', value: results.filter(r => r.status === 'PASS').length, cls: 'bg-green-50 border-green-200 text-green-700' },
            { label: 'Failed', value: results.filter(r => r.status === 'FAIL').length, cls: 'bg-red-50 border-red-200 text-red-600' }
          ].map(c => (
            <div key={c.label} className={`rounded-xl border p-4 text-center ${c.cls}`}>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-sm font-medium">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!selectedExam ? (<div className="p-12 text-center text-slate-400">Select an exam</div>)
          : loading ? (<div className="p-12 text-center text-slate-400">Loading...</div>)
          : results.length === 0 ? (<div className="p-12 text-center text-slate-400">No results compiled yet. Click "Compile Results" above.</div>)
          : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Student', 'Enrollment', 'SGPA', 'CGPA', 'Status', 'Published'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.sort((a, b) => (b.sgpa || 0) - (a.sgpa || 0)).map(r => (
                  <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.student_name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.enrollment_no || '—'}</td>
                    <td className={`px-4 py-3 ${gradeColor(r.sgpa)} font-bold`}>{r.sgpa?.toFixed(2) || '—'}</td>
                    <td className="px-4 py-3 text-blue-600 font-bold">{r.cgpa?.toFixed(2) || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.status === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${r.is_published ? 'text-green-600 font-medium' : 'text-slate-400'}`}>{r.is_published ? '✓ Published' : 'Unpublished'}</span>
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
                <p className="text-sm text-slate-500">Detailed Subject-wise Matrix</p>
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
                Close Matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {overviewLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-[2px] z-[60] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-violet-900 animate-pulse">Loading detailed matrix...</p>
          </div>
        </div>
      )}
    </div>
  );
}
