import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import api from '../../services/api';

export default function Eligibility() {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [overrideModal, setOverrideModal] = useState(null);
  const [overrideForm, setOverrideForm] = useState({ eligible: true, remarks: '' });

  useEffect(() => {
    api.get('/exam-setup/').then(r => setExams(r.data)).catch(console.error);
  }, []);

  const fetchEligibility = async () => {
    if (!selectedExam) return;
    setLoading(true);
    try {
      const r = await api.get(`/eligibility/exam/${selectedExam}`);
      setStudents(r.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchEligibility(); }, [selectedExam]);

  const runBulkCheck = async () => {
    try {
      await api.post(`/eligibility/bulk-check/${selectedExam}`);
      fetchEligibility();
    } catch (err) { alert('Bulk check failed'); }
  };

  const saveOverride = async () => {
    try {
      await api.post('/eligibility/set', {
        exam_id: selectedExam,
        student_id: overrideModal.student_id,
        eligible: overrideForm.eligible,
        remarks: overrideForm.remarks
      });
      setOverrideModal(null);
      fetchEligibility();
    } catch (err) { alert('Failed to update eligibility'); }
  };

  const eligible = students.filter(s => s.eligible).length;
  const notEligible = students.filter(s => !s.eligible).length;

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Eligibility Verification</h1>
          <p className="text-slate-500 text-sm mt-1">Check and set student eligibility for exams</p>
        </div>
        <div className="flex gap-2">
          <button onClick={runBulkCheck} disabled={!selectedExam} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <RefreshCw className="w-4 h-4" /> Run Bulk Check
          </button>
        </div>
      </div>

      <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[220px]">
        <option value="">— Select Exam —</option>
        {exams.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
      </select>

      {students.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{students.length}</div>
            <div className="text-sm text-slate-500">Total Applicants</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{eligible}</div>
            <div className="text-sm text-green-600">Eligible</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{notEligible}</div>
            <div className="text-sm text-red-500">Not Eligible</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!selectedExam ? (
          <div className="p-12 text-center text-slate-400">Select an exam to check eligibility</div>
        ) : loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No applications found for this exam</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Student', 'Enrollment', 'Fees', 'Eligible', 'Override', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map(s => (
                <tr key={s.student_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.student_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.enrollment_no}</td>

                  <td className="px-4 py-3">
                    {s.fees_paid ? <span className="text-green-600 font-medium">Paid</span> : <span className="text-red-500 font-medium">Unpaid</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.eligible ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                  </td>
                  <td className="px-4 py-3">
                    {s.override ? <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Manual</span> : <span className="text-xs text-slate-400">Auto</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setOverrideModal(s); setOverrideForm({ eligible: s.eligible, remarks: s.remarks || '' }); }}
                      className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">Override</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {overrideModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Set Eligibility</h3>
            <p className="text-sm text-slate-500 mb-4">{overrideModal.student_name} — {overrideModal.enrollment_no}</p>
            <div className="flex gap-3 mb-4">
              <button onClick={() => setOverrideForm({ ...overrideForm, eligible: true })} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${overrideForm.eligible ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-200'}`}>Eligible</button>
              <button onClick={() => setOverrideForm({ ...overrideForm, eligible: false })} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${!overrideForm.eligible ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-200'}`}>Not Eligible</button>
            </div>
            <textarea value={overrideForm.remarks} onChange={e => setOverrideForm({ ...overrideForm, remarks: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" placeholder="Remarks (optional)" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setOverrideModal(null)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={saveOverride} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
