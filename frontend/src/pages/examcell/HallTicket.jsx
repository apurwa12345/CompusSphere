import React, { useState, useEffect } from 'react';
import { Download, Search, CheckCircle, XCircle } from 'lucide-react';
import api from '../../services/api';

export default function HallTicket() {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    api.get('/exam-setup/').then(r => setExams(r.data)).catch(console.error);
  }, []);

  const fetchEligible = async () => {
    if (!selectedExam) return;
    setLoading(true);
    try {
      // Re-using eligibility or exam-forms to find who can get a ticket
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const r = await api.get(`/exam-forms/exam/${selectedExam}${params}`);
      setStudents(r.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchEligible(); }, [selectedExam, statusFilter]);

  const generateTicket = async (applicationId) => {
    try {
      await api.post(`/hall-ticket/generate/${applicationId}`);
      alert('Hall ticket generated successfully. Student can now download it.');
      fetchEligible();
    } catch (err) {
      alert(err.response?.data?.warnings?.join('\n') || 'Error generating hall ticket. Ensure student is eligible and timetable is set.');
    }
  };

  const bulkGenerate = async () => {
    const appIds = filteredStudents.map(s => s._id);
    if (appIds.length === 0) return;
    
    alert('Bulk generation started... This may take a moment.');
    try {
      await api.post('/hall-ticket/bulk-mark-generated', { application_ids: appIds });
      alert('Hall tickets generated for all eligible filtered students.');
      fetchEligible();
    } catch (err) {
      alert('Error in bulk generation.');
    }
  };

  const filteredStudents = students.filter(s => 
    s.student_name?.toLowerCase().includes(search.toLowerCase()) || 
    s.enrollment_no?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hall Ticket Generation</h1>
          <p className="text-slate-500 text-sm mt-1">Generate and download hall tickets for approved students</p>
        </div>
        {selectedExam && filteredStudents.length > 0 && statusFilter === 'Approved' && (
          <button onClick={bulkGenerate} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> Bulk Generate Hall Ticket
          </button>
        )}
      </div>

      <div className="flex gap-4 flex-wrap items-center">
        <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[220px]">
          <option value="">— Select Exam —</option>
          {exams.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All Statuses</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Unapproved</option>
          <option value="Pending">Pending</option>
        </select>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student or enrollment..." 
            className="w-full pl-9 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" 
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!selectedExam ? (
          <div className="p-12 text-center text-slate-400">Select an exam to view approved students</div>
        ) : loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No applications found for this search</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Student', 'Enrollment', 'Status', 'Fees', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map(s => (
                <tr key={s._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.student_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.enrollment_no}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      s.status === 'Approved' ? 'bg-green-100 text-green-700' :
                      s.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {s.status === 'Rejected' ? 'Unapproved' : s.status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.fees_paid ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  </td>
                  <td className="px-4 py-3">
                    {s.status === 'Approved' ? (
                      s.hall_ticket_generated ? (
                        <span className="text-xs font-bold text-green-600">Generated</span>
                      ) : (
                        <button 
                          onClick={() => generateTicket(s._id)}
                          className="flex items-center gap-1.5 text-violet-600 hover:text-violet-800 font-medium transition-colors"
                        >
                          <Download className="w-4 h-4" /> Generate Hall Ticket
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-slate-400">Not Eligible</span>
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
