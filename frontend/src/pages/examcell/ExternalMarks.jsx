import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import api from '../../services/api';

const SPECIAL_CASES = ['None', 'Absent', 'Malpractice', 'Withheld'];

export default function ExternalMarks() {
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [locking, setLocking] = useState(false);
  const [editRow, setEditRow] = useState({});

  useEffect(() => {
    api.get('/exam-setup/').then(r => setExams(r.data)).catch(console.error);
    api.get('/academic/subjects').then(r => setSubjects(r.data)).catch(console.error);
  }, []);

  const fetchMarks = async () => {
    if (!selectedExam || !selectedSubject) return;
    setLoading(true);
    try { const r = await api.get(`/external-marks/exam/${selectedExam}/subject/${selectedSubject}`); setMarks(r.data); setEditRow({}); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchMarks(); }, [selectedExam, selectedSubject]);

  const saveAll = async () => {
    const entries = Object.entries(editRow).map(([sid, data]) => ({
      student_id: sid,
      exam_id: selectedExam,
      subject_id: selectedSubject,
      marks: data.marks,
      special_case: data.special_case || 'None'
    }));

    if (entries.length === 0) return;
    setSavingAll(true);
    try {
      await api.post('/external-marks/bulk', { entries });
      fetchMarks();
      alert('All marks saved successfully!');
    } catch (e) { alert(e.response?.data?.message || 'Error saving marks'); }
    finally { setSavingAll(false); }
  };

  const lockMarks = async () => {
    if (!window.confirm('Are you sure you want to LOCK these marks? They will be verified and cannot be edited again.')) return;
    setLocking(true);
    try {
      await api.post('/external-marks/lock-subject', {
        exam_id: selectedExam,
        subject_id: selectedSubject
      });
      fetchMarks();
      alert('Marks locked successfully!');
    } catch (e) { alert(e.response?.data?.message || 'Error locking marks'); }
    finally { setLocking(false); }
  };

  const verifySubject = async () => {
    if (!selectedExam || !selectedSubject) return;
    try {
      await api.post('/external-marks/verify-subject', {
        exam_id: selectedExam,
        subject_id: selectedSubject
      });
      fetchMarks();
      alert('Subject marks verified!');
    } catch (err) { alert(err.response?.data?.message || 'Error verifying subject'); }
  };

  const saveRow = async (student_id) => {
    const row = editRow[student_id] || {};
    try {
      await api.post('/external-marks/', {
        exam_id: selectedExam,
        student_id,
        subject_id: selectedSubject,
        marks: row.marks || 0,
        special_case: row.special_case || 'None'
      });
      fetchMarks();
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const calculateGrade = (marks, max = 60) => {
    if (marks === null || marks === undefined || marks === '') return '—';
    const pct = (parseFloat(marks) / max) * 100;
    if (pct >= 90) return 'EX';
    if (pct >= 80) return 'AA';
    if (pct >= 75) return 'AB';
    if (pct >= 70) return 'BB';
    if (pct >= 65) return 'BC';
    if (pct >= 60) return 'CC';
    if (pct >= 55) return 'CD';
    if (pct >= 50) return 'DD';
    if (pct >= 45) return 'DE';
    if (pct >= 40) return 'EE';
    return 'FF';
  };

  const gradeColors = { 
    EX: 'text-green-700', AA: 'text-green-600', AB: 'text-green-500', 
    BB: 'text-blue-600', BC: 'text-blue-500', CC: 'text-yellow-600', 
    CD: 'text-yellow-500', DD: 'text-orange-600', DE: 'text-orange-500', 
    EE: 'text-orange-400', FF: 'text-red-600',
    // Old mapping for compatibility
    O: 'text-green-700', 'A+': 'text-green-600', A: 'text-blue-600', 
    'B+': 'text-blue-500', B: 'text-yellow-600', C: 'text-orange-500', 
    P: 'text-orange-400', F: 'text-red-600' 
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">External Marks</h1>
        <p className="text-slate-500 text-sm mt-1">Enter external/university exam marks</p>
      </div>
      <div className="flex gap-3 flex-wrap items-center justify-between">
        <div className="flex gap-3">
          <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[200px]">
            <option value="">— Select Exam —</option>
            {exams.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
          <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[200px]">
            <option value="">— Select Subject —</option>
            {subjects.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3">
          {selectedExam && selectedSubject && marks.length > 0 && (
            <>
              <button onClick={saveAll} disabled={savingAll || Object.keys(editRow).length === 0} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm">
                {savingAll ? 'Saving...' : 'Save All Marks'}
              </button>
              <button onClick={lockMarks} disabled={locking} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm">
                {locking ? 'Locking...' : 'Lock Marks'}
              </button>
              <button onClick={verifySubject} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm">
                Verify All Subject Marks
              </button>
            </>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!selectedExam || !selectedSubject ? (<div className="p-12 text-center text-slate-400">Select exam and subject</div>)
          : loading ? (<div className="p-12 text-center text-slate-400">Loading...</div>)
          : marks.length === 0 ? (<div className="p-12 text-center text-slate-400">No marks yet</div>)
          : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Student', 'Enrollment', 'Marks / 60', 'Special Case', 'Grade', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marks.map(m => {
                  const row = editRow[m.student_id] || {};
                  return (
                    <tr key={m._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{m.student_name || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.enrollment_no || '—'}</td>
                      <td className="px-4 py-3">
                        <input type="number" min={0} max={60} defaultValue={m.marks} disabled={m.is_locked || (row.special_case && row.special_case !== 'None')}
                          onChange={e => setEditRow({ ...editRow, [m.student_id]: { ...row, marks: e.target.value } })}
                          className="w-20 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-100" />
                      </td>
                      <td className="px-4 py-3">
                        <select defaultValue={m.special_case || 'None'} disabled={m.is_locked} onChange={e => setEditRow({ ...editRow, [m.student_id]: { ...row, special_case: e.target.value } })}
                          className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-100">
                          {SPECIAL_CASES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 font-bold">
                        <span className={gradeColors[row.marks !== undefined ? calculateGrade(row.marks) : m.grade] || 'text-slate-700'}>
                          {row.marks !== undefined ? calculateGrade(row.marks) : (m.grade || '—')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${m.is_locked ? 'bg-red-100 text-red-700' : m.is_verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {m.is_locked ? 'Locked' : m.is_verified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
