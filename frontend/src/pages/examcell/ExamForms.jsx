import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import api from '../../services/api';
import { formatDateShort } from '../../utils/dateUtils';

const statusColors = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};

const StatusBadge = ({ status }) => {
  const currentStatus = status || 'Pending';
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColors[currentStatus] || 'bg-slate-100 text-slate-600'}`}>
      {currentStatus}
    </span>
  );
};

export default function ExamForms() {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [remarksModal, setRemarksModal] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [remainingStudents, setRemainingStudents] = useState([]);
  const [loadingRemaining, setLoadingRemaining] = useState(false);

  useEffect(() => {
    api.get('/exam-setup/').then(r => setExams(r.data)).catch(console.error);
    api.get('/academic/departments').then(r => setDepartments(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedExam) return;
    setLoading(true);
    setRemainingStudents([]); // Clear stale data
    const params = statusFilter ? `?status=${statusFilter}` : '';
    // Apply department filter to applications too if needed (though applications are usually checked globally, 
    // it's good practice if there are thousands of apps)
    api.get(`/exam-forms/exam/${selectedExam}${params}`)
      .then(r => {
        let data = r.data;
        if (selectedDepartment && selectedDepartment !== 'All Departments') {
          data = data.filter(a => a.department === selectedDepartment || a.department_name === selectedDepartment);
        }
        setApplications(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Fetch remaining students
    setLoadingRemaining(true);
    const depParam = selectedDepartment ? `?department=${encodeURIComponent(selectedDepartment)}` : '';
    api.get(`/exam-forms/exam/${selectedExam}/remaining-students${depParam}`)
      .then(r => setRemainingStudents(r.data))
      .catch(console.error)
      .finally(() => setLoadingRemaining(false));
  }, [selectedExam, statusFilter, selectedDepartment]);

  const filteredApplications = applications.filter(app => !searchQuery || (app.student_name || '').toLowerCase().includes(searchQuery.toLowerCase()));

  const updateStatus = async (appId, status) => {
    try {
      await api.patch(`/exam-forms/${appId}/status`, { status, remarks });
      setRemarksModal(null); setRemarks('');
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const r = await api.get(`/exam-forms/exam/${selectedExam}${params}`);
      setApplications(r.data);
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const bulkApprove = async () => {
    const pendingIds = applications.filter(a => a.status === 'Pending' && a.fees_paid && (a.college_fee_status === 'Paid' || a.college_fee_status === 'Partially Paid')).map(a => a._id);
    if (!pendingIds.length) { alert('No pending applications with paid fees and accountant approval available for approval'); return; }
    try {
      await api.post('/exam-forms/bulk-approve', { application_ids: pendingIds });
      const r = await api.get(`/exam-forms/exam/${selectedExam}`);
      setApplications(r.data);
    } catch (err) { alert('Bulk approve failed'); }
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exam Form Management</h1>
          <p className="text-slate-500 text-sm mt-1">Review and approve student exam applications</p>
        </div>
        {selectedExam && (
          <button onClick={bulkApprove} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <CheckCircle className="w-4 h-4" /> Bulk Approve Pending
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[200px]">
            <option value="">— Select Exam —</option>
            {exams.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
          <select value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[200px]">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">All Statuses</option>
            <option>Pending</option><option>Approved</option><option>Rejected</option>
          </select>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search student name..."
          className="w-full md:w-80 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Stats */}
      {selectedExam && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Pending', 'Approved', 'Rejected'].map(s => {
            const count = filteredApplications.filter(a => a.status === s).length;
            const colors = { Pending: 'bg-yellow-50 border-yellow-200 text-yellow-700', Approved: 'bg-green-50 border-green-200 text-green-700', Rejected: 'bg-red-50 border-red-200 text-red-700' };
            return (
              <div key={s} className={`p-4 rounded-xl border ${colors[s]} text-center shadow-sm`}>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm font-medium">{s}</div>
              </div>
            );
          })}
          <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 text-slate-700 text-center shadow-sm">
            <div className="text-2xl font-bold">{remainingStudents.length}</div>
            <div className="text-sm font-medium">Remaining</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!selectedExam ? (
          <div className="p-12 text-center text-slate-400">Select an exam to view applications</div>
        ) : loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : filteredApplications.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No applications found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Student', 'Enrollment No', 'Accountant Approval', 'Payment Details', 'Applied On', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApplications.map(app => (
                <tr key={app._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{app.student_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{app.enrollment_no || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`w-max px-2 py-0.5 rounded-full text-xs font-semibold ${
                      app.college_fee_status === 'Paid' ? 'bg-green-100 text-green-700' :
                      app.college_fee_status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {app.college_fee_status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`w-max px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase ${
                        app.paymentStatus === 'SUSPICIOUS' ? 'bg-orange-100 text-orange-700' : 
                        app.fees_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {app.paymentStatus?.replace('_', ' ') || 'PENDING'}
                      </span>
                      {app.payment_method && (
                        <span className={`text-[10px] font-bold tracking-widest uppercase w-max px-1.5 py-0.5 rounded ${
                          app.payment_method === 'qr' ? 'bg-blue-100 text-blue-700' :
                          app.payment_method === 'upi' ? 'bg-purple-100 text-purple-700' :
                          app.payment_method === 'netbanking' ? 'bg-green-100 text-green-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {app.payment_method === 'qr' ? 'QR Code' : 
                           app.payment_method === 'upi' ? 'UPI' :
                           app.payment_method === 'netbanking' ? 'Net Banking' :
                           app.payment_method}
                        </span>
                      )}
                      {app.UTR && (
                        <span className="text-xs font-mono text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded w-max">
                          UTR: {app.UTR}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDateShort(app.createdAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                  <td className="px-4 py-3">
                    {(app.status === 'Pending' || app.status === 'Rejected') && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => app.fees_paid && (app.college_fee_status === 'Paid' || app.college_fee_status === 'Partially Paid') ? updateStatus(app._id, 'Approved') : alert('Both College Fees and Exam Form Fees must be paid before approval')} 
                          className={`${app.fees_paid && (app.college_fee_status === 'Paid' || app.college_fee_status === 'Partially Paid') ? 'text-green-600 hover:text-green-800' : 'text-slate-300 cursor-not-allowed'} transition-colors`} 
                          title={app.fees_paid && (app.college_fee_status === 'Paid' || app.college_fee_status === 'Partially Paid') ? 'Approve' : 'Cannot Approve: Fees Unpaid'}
                          disabled={!app.fees_paid || !(app.college_fee_status === 'Paid' || app.college_fee_status === 'Partially Paid')}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        {app.status === 'Pending' && (
                          <button onClick={() => { setRemarksModal(app._id); }} className="text-red-500 hover:text-red-700 transition-colors" title="Reject"><XCircle className="w-4 h-4" /></button>
                        )}
                      </div>
                    )}

                    {app.status === 'Approved' && (
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => {
                            if (!confirm('Revert approval for this application? This will set status back to Pending.')) return;
                            updateStatus(app._id, 'Pending');
                          }}
                          className="text-yellow-600 hover:text-yellow-800 transition-colors"
                          title="Undo Approval"
                        >
                          Undo
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Remaining Students Section */}
      {selectedExam && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Remaining Students (Not Applied)</h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
              {remainingStudents.length} Students
            </span>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingRemaining ? (
              <div className="p-8 text-center text-slate-400">Loading remaining students...</div>
            ) : remainingStudents.length === 0 ? (
              <div className="p-8 text-center text-slate-400">All students have applied!</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Student Name', 'Enrollment No', 'Department', 'Semester'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {remainingStudents.map(student => (
                    <tr key={student._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{student.name}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{student.enrollment_no}</td>
                      <td className="px-4 py-3 text-slate-500">{student.department}</td>
                      <td className="px-4 py-3 text-slate-500">{student.current_semester}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {remarksModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-3">Reject Application</h3>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" placeholder="Reason for rejection (optional)" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setRemarksModal(null); setRemarks(''); }} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={() => updateStatus(remarksModal, 'Rejected')} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
