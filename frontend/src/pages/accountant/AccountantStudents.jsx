import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

export default function AccountantStudents() {
  const [rows, setRows] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [processingId, setProcessingId] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const loadRows = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get('/accountant/students-fees');
      setRows(res.data || []);
      setFiltered(res.data || []);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Failed to fetch students.';
      setLoadError(msg);
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

  const markPaid = async (studentId, status) => {
    try {
      setProcessingId(studentId);
      await api.put(`/accountant/update-fee-status/${studentId}`, { fee_status: status });
      await loadRows();
      alert(`Student marked as ${status}.`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update payment status');
    } finally {
      setProcessingId('');
    }
  };

  const departments = allDepartments.map((d) => ({ id: d.name, name: d.name }));

  // FY/Class division config from DB counts (max 80/class; CSE fixed to 3 sections as requested).
  const CLASS_DIVISION = {
    CSE: { fy: 1, total: 208, sections: 3 },
    IT: { fy: 2, total: 121, sections: 2 },
    AIML: { fy: 3, total: 69, sections: 1 },
    'A&R': { fy: 4, total: 64, sections: 1 },
    CIVIL: { fy: 5, total: 73, sections: 1 },
    MECH: { fy: 6, total: 59, sections: 1 },
    'E&TC': { fy: 7, total: 69, sections: 1 }
  };

  const computeSectionSizes = (deptKey) => {
    const cfg = CLASS_DIVISION[deptKey];
    if (!cfg) return [];
    const { total, sections } = cfg;
    if (sections <= 1) return [total];
    if (deptKey === 'CSE' && sections === 3) return [70, 70, Math.max(0, total - 140)];
    const base = Math.floor(total / sections);
    const rem = total % sections;
    return Array.from({ length: sections }, (_v, i) => base + (i < rem ? 1 : 0));
  };

  const classOptions = Object.entries(CLASS_DIVISION)
    .sort((a, b) => a[1].fy - b[1].fy)
    .flatMap(([deptKey, cfg]) => {
      const sizes = computeSectionSizes(deptKey);
      return sizes.map((_sz, i) => {
        const letter = String.fromCharCode('A'.charCodeAt(0) + i);
        const value = `FY ${cfg.fy} ${letter}`;
        const label = `${value} (${deptKey})`;
        return { value, label, deptKey };
      });
    });

  const getDeptKeyFromName = (name) => {
    const v = String(name || '').trim().toLowerCase();
    if (!v) return '';
    if (v.includes('computer') || v.includes('cse')) return 'CSE';
    if (v.includes('information') || v.includes('it')) return 'IT';
    if (v.includes('artificial') || v.includes('aiml')) return 'AIML';
    if (v.includes('automation') || v.includes('robotics') || v.includes('ar')) return 'A&R';
    if (v.includes('civil')) return 'CIVIL';
    if (v.includes('mechanical') || v.includes('mech')) return 'MECH';
    if (v.includes('telecommunication') || v.includes('etc')) return 'E&TC';
    return '';
  };

  const rowsWithClass = useMemo(() => {
    // Create stable ordering within department for consistent section assignment.
    const groups = new Map();
    for (const r of rows) {
      const deptKey = getDeptKeyFromName(r.department_name) || '__UNKNOWN__';
      if (!groups.has(deptKey)) groups.set(deptKey, []);
      groups.get(deptKey).push(r);
    }

    const withClass = [];
    for (const [deptKey, list] of groups.entries()) {
      const sorted = [...list].sort((a, b) => {
        const ar = String(a.roll_no || a.enrollment_no || a.name || '');
        const br = String(b.roll_no || b.enrollment_no || b.name || '');
        return ar.localeCompare(br, undefined, { numeric: true, sensitivity: 'base' });
      });
      const sizes = computeSectionSizes(deptKey);
      sorted.forEach((r, idx) => {
        let sectionIndex = 0;
        let t = idx;
        while (sectionIndex < sizes.length && t >= sizes[sectionIndex]) {
          t -= sizes[sectionIndex];
          sectionIndex += 1;
        }
        const cfg = CLASS_DIVISION[deptKey];
        const letter = String.fromCharCode('A'.charCodeAt(0) + Math.min(sectionIndex, 25));
        const computed = cfg ? `FY ${cfg.fy} ${letter}` : '';
        withClass.push({ ...r, __computed_class: computed });
      });
    }
    return withClass;
  }, [rows]);

  useEffect(() => {
    const term = search.trim().toLowerCase();
    const result = rowsWithClass.filter((r) => {
      const textMatch =
        !term ||
        [r.name, r.email, r.enrollment_no, r.category]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'paid' && r.fee_status === 'Paid') ||
        (statusFilter === 'partially_paid' && r.fee_status === 'Partially Paid') ||
        (statusFilter === 'unpaid' && r.fee_status !== 'Paid' && r.fee_status !== 'Partially Paid');
      const deptMatch = departmentFilter === 'all' || (r.department_name || '') === departmentFilter;
      const classMatch = classFilter === 'all' || (r.__computed_class || '') === classFilter;
      return textMatch && statusMatch && deptMatch && classMatch;
    });
    setFiltered(result);
  }, [search, rowsWithClass, statusFilter, departmentFilter, classFilter]);

  const openStudentDetails = async (row) => {
    if (!row?._id) return;
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetails(null);
    try {
      const res = await api.get(`/accountant/fee-submissions/by-student/${row._id}`);
      setDetails(res.data || null);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to load student fee details.');
      setDetailsOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Students</h1>
        <p className="text-slate-500">All students list with fee payment status.</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            placeholder="Search by name, email, enrollment or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          >
            <option value="all">All (Paid/Unpaid)</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="unpaid">Unpaid/Pending</option>
          </select>
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

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          >
            <option value="all">All Classes</option>
            {classOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading student submissions...</div>
        ) : loadError ? (
          <div className="p-10 text-center">
            <p className="text-slate-700 font-semibold">Unable to load students</p>
            <p className="text-sm text-slate-500 mt-1">{loadError}</p>
            <div className="mt-4 flex justify-center">
              <Button onClick={loadRows} className="px-5">Retry</Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No submissions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Enrollment</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Fees Paid</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr
                    key={row._id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => openStudentDetails(row)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{row.name}</p>
                      <p className="text-xs text-slate-500">{row.email}</p>
                    </td>
                    <td className="px-4 py-3">{row.enrollment_no || '-'}</td>
                    <td className="px-4 py-3">{row.phone_no || '-'}</td>
                    <td className="px-4 py-3">{row.department_name || '-'}</td>
                    <td className="px-4 py-3">{row.category || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${row.fee_status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : row.fee_status === 'Partially Paid' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {row.fee_status || (row.fees_paid ? 'Paid' : 'Pending')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetailsOpen(false)}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Student Fee Details</h2>
                  <p className="text-sm text-slate-500">Information submitted in the Student Fees section.</p>
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
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Student</p>
                    <p className="mt-1 font-bold text-slate-800">{details.student?.name || '-'}</p>
                    <p className="text-xs text-slate-500">{details.student?.email || '-'}</p>
                    <p className="text-xs text-slate-500 mt-1">Enrollment: {details.student?.enrollment_no || '-'}</p>
                    <p className="text-xs text-slate-500">Phone: {details.student?.phone_no || '-'}</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Submission</p>
                    <p className="mt-1 text-slate-700">
                      Status:{' '}
                      <span className={`font-black ${details.status === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {details.status || 'Pending'}
                      </span>
                    </p>
                    <p className="text-slate-700">Category: <span className="font-bold">{details.category || details.student?.category || '-'}</span></p>
                    <p className="text-slate-700">
                      Amount: <span className="font-bold">Rs {Number(details.fees_amount ?? details.student?.fees_amount ?? 0).toLocaleString('en-IN')}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Submitted: {formatDate(details.created_at, '-')}
                    </p>
                    <p className="text-xs text-slate-500">
                      Verified: {formatDate(details.verified_at, '-')}
                    </p>
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

