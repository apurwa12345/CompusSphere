import React, { useEffect, useState } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

export default function AccountantFeeCollection() {
  const [rows, setRows] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');
  const [docViewer, setDocViewer] = useState({ open: false, url: '', mime: '' });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const loadRows = async () => {
    try {
      setLoading(true);
      const res = await api.get('/accountant/students-submissions?uploaded_only=true');
      const submissions = res.data || [];
      
      // Group submissions by student_id and keep latest as representative
      const groupedByStudent = {};
      submissions.forEach((submission) => {
        const sid = submission.student_id;
        if (!groupedByStudent[sid]) {
          groupedByStudent[sid] = {
            ...submission,
            receipt_count: 1,
            receipts: [submission]
          };
        } else {
          groupedByStudent[sid].receipt_count += 1;
          groupedByStudent[sid].receipts.push(submission);
          // Update representative to latest (most recent)
          if (new Date(submission.created_at) > new Date(groupedByStudent[sid].created_at)) {
            groupedByStudent[sid] = {
              ...submission,
              receipt_count: groupedByStudent[sid].receipt_count,
              receipts: groupedByStudent[sid].receipts
            };
          }
        }
      });
      
      const grouped = Object.values(groupedByStudent);
      setRows(grouped);
      setFiltered(grouped);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch fee collection records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
    const loadDepartments = async () => {
      try {
        const res = await api.get('/academic/departments');
        setAllDepartments(res.data || []);
      } catch (err) {
        console.error('Failed to fetch departments', err);
      }
    };
    loadDepartments();
  }, []);

  useEffect(() => {
    const term = search.trim().toLowerCase();
    const result = rows.filter((r) => {
      const textMatch =
        !term ||
        [r.student_name, r.student_email, r.enrollment_no, r.category]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      const deptMatch = departmentFilter === 'all' || (r.department_name || '') === departmentFilter;
      return textMatch && deptMatch;
    });
    setFiltered(result);
  }, [search, rows, departmentFilter]);

  const markPaid = async (submissionId, status) => {
    try {
      setProcessingId(submissionId);
      await api.put(`/accountant/fee-submissions/${submissionId}/mark-paid`, { status });
      await loadRows();
      alert(`Student marked as ${status}.`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update payment status');
    } finally {
      setProcessingId('');
    }
  };

  const viewReceipt = async (submissionId) => {
    try {
      const res = await api.get(`/accountant/fee-submissions/${submissionId}/receipt`, {
        responseType: 'blob'
      });
      const contentType = res.headers?.['content-type'] || 'application/octet-stream';
      const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
      setDocViewer({ open: true, url, mime: contentType });
      // Close the details modal when opening receipt
      setDetailsOpen(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to open receipt document');
    }
  };

  const closeViewer = () => {
    if (docViewer.url) window.URL.revokeObjectURL(docViewer.url);
    setDocViewer({ open: false, url: '', mime: '' });
  };

  const openStudentDetails = async (row) => {
    const studentId = row?.student_id;
    if (!studentId) {
      alert('Student ID not found for this record.');
      return;
    }
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetails(null);
    try {
      const res = await api.get(`/accountant/fee-submissions/by-student/${studentId}`);
      setDetails(res.data || null);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to load student fee details.');
      setDetailsOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const departments = allDepartments.map((d) => ({ id: d.name, name: d.name }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {docViewer.open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <button type="button" onClick={closeViewer} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Back
              </button>
              <button type="button" onClick={closeViewer} className="text-xl leading-none text-slate-500 hover:text-slate-900">
                x
              </button>
            </div>
            <div className="flex-1 bg-slate-50">
              {docViewer.mime.startsWith('image/') ? (
                <img src={docViewer.url} alt="Fee receipt" className="w-full h-full object-contain" />
              ) : (
                <iframe title="Fee receipt document" src={docViewer.url} className="w-full h-full border-0" />
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fees Collection</h1>
        <p className="text-slate-500">Only students who uploaded documents are shown here.</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            placeholder="Search by name, email, enrollment or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading fee collection records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No uploaded documents found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Enrollment</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Fees Paid</th>
                  <th className="px-4 py-3 text-left">Receipts</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr
                    key={row._id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{row.student_name || row.name}</p>
                      <p className="text-xs text-slate-500">{row.student_email || row.email}</p>
                    </td>
                    <td className="px-4 py-3">{row.enrollment_no || '-'}</td>
                    <td className="px-4 py-3">{row.department_name || '-'}</td>
                    <td className="px-4 py-3">{row.category || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${row.fee_status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : row.fee_status === 'Partially Paid' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {row.fee_status || (row.fees_paid ? 'Paid' : 'Pending')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {row.receipt_count || 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          onClick={() => openStudentDetails(row)}
                        >
                          View Documents
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={processingId === row._id || row.fee_status === 'Paid'}
                          onClick={() => markPaid(row._id, 'Paid')}
                        >
                          Mark Paid
                        </Button>
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={processingId === row._id || row.fee_status === 'Partially Paid'}
                          onClick={() => markPaid(row._id, 'Partially Paid')}
                        >
                          Partially Paid
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={processingId === row._id || row.fee_status === 'Pending' || row.fee_status === 'Unpaid'}
                          onClick={() => markPaid(row._id, 'Pending')}
                        >
                          Mark Unpaid
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detailsOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setDetailsOpen(false)}
        >
          <div className="w-full max-w-4xl my-8" onClick={(e) => e.stopPropagation()}>
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Student Fee Details</h2>
                  <p className="text-sm text-slate-500">All fee submissions from the Student Fees section.</p>
                </div>
                <Button variant="secondary" onClick={() => setDetailsOpen(false)}>Close</Button>
              </div>

              {detailsLoading ? (
                <div className="py-12 text-center text-slate-500">Loading details...</div>
              ) : !details?.exists ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  No fee submission found for this student yet.
                </div>
              ) : (
                <div className="mt-6">
                  {/* Student Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Student</p>
                      <p className="mt-1 font-bold text-slate-800">{details.student?.name || '-'}</p>
                      <p className="text-xs text-slate-500">{details.student?.email || '-'}</p>
                      <p className="text-xs text-slate-500 mt-1">Enrollment: {details.student?.enrollment_no || '-'}</p>
                      <p className="text-xs text-slate-500">Phone: {details.student?.phone_no || '-'}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Fee Summary</p>
                      <p className="mt-1 text-slate-700">
                        Status:{' '}
                        <span className={`font-black ${details.student?.fee_status === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {details.student?.fee_status || 'Pending'}
                        </span>
                      </p>
                      <p className="text-slate-700">Category: <span className="font-bold">{details.student?.category || '-'}</span></p>
                      <p className="text-slate-700">
                        Amount: <span className="font-bold">Rs {Number(details.student?.fees_amount ?? 0).toLocaleString('en-IN')}</span>
                      </p>
                    </div>
                  </div>

                  {/* All Submissions */}
                  <div className="border-t border-slate-200 pt-6">
                    <p className="text-sm font-bold text-slate-900 mb-3">
                      Submitted Receipts ({details.submissions?.length || 0})
                    </p>
                    {details.submissions && details.submissions.length > 0 ? (
                      <div className="space-y-3">
                        {details.submissions.map((submission, idx) => (
                          <div key={submission._id} className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-slate-800">Receipt {idx + 1}</p>
                                <p className="text-xs text-slate-600 mt-1">
                                  Submitted: {formatDate(submission.created_at, '-')}
                                </p>
                                <p className="text-xs text-slate-600">
                                  File: {submission.receipt_filename || 'Unknown'}
                                </p>
                                <p className="text-xs text-slate-600">
                                  Status:{' '}
                                  <span className={`font-semibold ${submission.status === 'Paid' ? 'text-emerald-600' : submission.status === 'Partially Paid' ? 'text-blue-600' : 'text-amber-600'}`}>
                                    {submission.status || 'Pending'}
                                  </span>
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => viewReceipt(submission._id)}
                                className="px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                              >
                                View Receipt
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">No receipts uploaded yet.</p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

