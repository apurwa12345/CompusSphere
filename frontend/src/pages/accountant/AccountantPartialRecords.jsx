import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import api from '../../services/api';
import { UserCircle, IndianRupee, AlertCircle, ArrowUpDown, Filter } from 'lucide-react';

export default function AccountantPartialRecords() {
  const [students, setStudents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paidAmount, setPaidAmount] = useState('');
  const [updating, setUpdating] = useState(false);
  const [sortBy, setSortBy] = useState('name_asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/accountant/students-fees');
      const data = res.data || [];
      setStudents(data);

      // Keep selected student data fresh
      if (selectedStudent) {
        const updated = data.find(s => s._id === selectedStudent._id);
        if (updated) setSelectedStudent(updated);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load students data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStudentRollKey = (student) =>
    String(student?.roll_no || student?.enrollment_no || student?.student_id || '').trim();

  const normalizeFilterValue = (value) =>
    String(value || '').trim().toLowerCase();

  const getYearShortName = (semester, year) => {
    const semNumber = Number.parseInt(semester, 10);
    if (semNumber === 1 || semNumber === 2) return 'FY';
    if (semNumber === 3 || semNumber === 4) return 'SY';
    if (semNumber === 5 || semNumber === 6) return 'TY';
    if (semNumber === 7 || semNumber === 8) return 'Final Year';

    const normalizedYear = String(year || '').trim().toLowerCase();
    if (normalizedYear.includes('first') || normalizedYear.includes('fy')) return 'FY';
    if (normalizedYear.includes('second') || normalizedYear.includes('sy')) return 'SY';
    if (normalizedYear.includes('third') || normalizedYear.includes('ty')) return 'TY';
    if (normalizedYear.includes('final') || normalizedYear.includes('be')) return 'Final Year';
    return normalizedYear ? String(year).trim() : '';
  };

  const getDepartmentShortCode = (student) => {
    const rawCode = String(student?.department_code || '').trim();
    if (rawCode) return rawCode.toUpperCase();

    const normalized = String(student?.department_name || student?.department || student?.branch || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    if (!normalized) return '';
    if (normalized.includes('computerscience') || normalized.includes('computerengineering')) return 'CSE';
    if (normalized.includes('informationtechnology')) return 'IT';
    if (normalized.includes('artificialintelligence') || normalized.includes('aiandml')) return 'AIML';
    if (normalized.includes('automation') || normalized.includes('robotics')) return 'AR';
    if (normalized.includes('civil')) return 'CE';
    if (normalized.includes('mechanical')) return 'ME';
    if (normalized.includes('electronic') || normalized.includes('telecommunication')) return 'ENTC';
    return String(student?.department_name || student?.department || '').trim();
  };

  const getStudentClassValue = (student) => {
    const semester = String(student?.current_semester || '').trim();
    const division = String(student?.group || student?.division || '').trim();
    const year = getYearShortName(semester, student?.year || student?.class_name || student?.batch_year);
    const department = getDepartmentShortCode(student);

    const parts = [year, division.toUpperCase(), semester, department].filter(Boolean);
    if (parts.length) return parts.join(' ');

    const className = String(student?.class_name || '').trim();
    if (className) return className;
    if (semester) return `Sem ${semester}`;
    if (division) return `Div ${division}`;
    return '';
  };

  const departmentOptions = useMemo(() => {
    const seen = new Map();
    students.forEach((student) => {
      const label = String(student.department_name || student.department || '').trim();
      const value = normalizeFilterValue(label);
      if (label && !seen.has(value)) seen.set(value, label);
    });
    return Array.from(seen, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    );
  }, [students]);

  const classOptions = useMemo(() => {
    const seen = new Map();
    students.forEach((student) => {
      const label = getStudentClassValue(student);
      const value = normalizeFilterValue(label);
      if (label && !seen.has(value)) seen.set(value, label);
    });
    return Array.from(seen, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [students]);

  const getDepartmentOrderKey = (department) => {
    const normalized = String(department || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (!normalized) return 999;
    if (normalized.includes('computerscience') || normalized.includes('computerengineering') || normalized.includes('cse')) return 1;
    if (normalized.includes('informationtechnology') || normalized.includes('it')) return 2;
    if (normalized.includes('artificialintelligence') || normalized.includes('aiandml') || normalized.includes('aiml')) return 3;
    if (normalized.includes('automation') || normalized.includes('robotics') || normalized.includes('ar')) return 4;
    if (normalized.includes('civil') || normalized.includes('ce')) return 5;
    if (normalized.includes('mechanical') || normalized.includes('mech')) return 6;
    if (normalized.includes('electronic') || normalized.includes('telecommunication') || normalized.includes('entc') || normalized.includes('etc')) return 7;
    return 999;
  };

  useEffect(() => {
    let result = [...students];
    const term = searchQuery.trim().toLowerCase();

    if (term) {
      result = result.filter((student) => {
        const values = [
          student.name,
          student.department_name,
          student.department,
          getStudentClassValue(student),
          student.enrollment_no,
          student.roll_no,
          student.email,
          student.student_id,
        ];
        return values.some((value) => String(value || '').toLowerCase().includes(term));
      });
    }

    if (departmentFilter !== 'all') {
      result = result.filter((student) =>
        normalizeFilterValue(student.department_name || student.department) === departmentFilter
      );
    }

    if (classFilter !== 'all') {
      result = result.filter((student) =>
        normalizeFilterValue(getStudentClassValue(student)) === classFilter
      );
    }

    result.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      const deptA = (a.department_name || '').toLowerCase();
      const deptB = (b.department_name || '').toLowerCase();
      const classA = getStudentClassValue(a).toLowerCase();
      const classB = getStudentClassValue(b).toLowerCase();
      const rollA = getStudentRollKey(a).toLowerCase();
      const rollB = getStudentRollKey(b).toLowerCase();

      if (sortBy === 'name_asc') return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      if (sortBy === 'name_desc') return nameB.localeCompare(nameA, undefined, { sensitivity: 'base' });
      const deptRankA = getDepartmentOrderKey(a.department_name);
      const deptRankB = getDepartmentOrderKey(b.department_name);

      if (sortBy === 'dept_asc') {
        if (deptRankA !== deptRankB) return deptRankA - deptRankB;
        if (deptA !== deptB) return deptA.localeCompare(deptB, undefined, { sensitivity: 'base' });
        return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'dept_desc') {
        if (deptRankA !== deptRankB) return deptRankB - deptRankA;
        if (deptA !== deptB) return deptB.localeCompare(deptA, undefined, { sensitivity: 'base' });
        return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'roll_asc') return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'roll_desc') return rollB.localeCompare(rollA, undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'class_asc') {
        if (classA !== classB) return classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
        return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'class_desc') {
        if (classA !== classB) return classB.localeCompare(classA, undefined, { numeric: true, sensitivity: 'base' });
        return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
      }
      return 0;
    });

    setFiltered(result);
  }, [students, sortBy, searchQuery, departmentFilter, classFilter]);

  const handleSelect = (student) => {
    setSelectedStudent(student);
    setPaidAmount(student.fees_paid_amount != null ? student.fees_paid_amount : '');
  };

  const handleUpdate = async () => {
    if (!selectedStudent) return;
    if (paidAmount === '' || isNaN(paidAmount) || parseFloat(paidAmount) < 0) {
      alert('Please enter a valid amount.');
      return;
    }

    try {
      setUpdating(true);
      await api.put(`/accountant/update-partial-amount/${selectedStudent._id}`, {
        fees_paid_amount: parseFloat(paidAmount),
      });
      alert('Fee record updated successfully!');
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update partial fee record');
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(val || 0);

  const defaultFees = selectedStudent?.fees_amount || 0;
  const remainingAmount = Math.max(0, defaultFees - (parseFloat(paidAmount) || 0));

  const statusColor = (status, paid) => {
    const s = status || (paid ? 'Paid' : 'Pending');
    if (s === 'Paid') return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', light: 'bg-emerald-50' };
    if (s === 'Partially Paid') return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', light: 'bg-blue-50' };
    return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', light: 'bg-amber-50' };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Partial Fee Records</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage and track partial fee payments for students.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</span>
          <select
            className="min-w-0 border-none bg-transparent font-medium text-slate-700 text-sm focus:outline-none cursor-pointer"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departmentOptions.map((department) => (
              <option key={department.value} value={department.value}>
                {department.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</span>
          <select
            className="min-w-0 border-none bg-transparent font-medium text-slate-700 text-sm focus:outline-none cursor-pointer"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="all">All Classes</option>
            {classOptions.map((classItem) => (
              <option key={classItem.value} value={classItem.value}>
                {classItem.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sort&nbsp;By</span>
          <select
            className="min-w-0 border-none bg-transparent font-medium text-slate-700 text-sm focus:outline-none cursor-pointer"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="roll_asc">Roll No. (Low → High)</option>
            <option value="roll_desc">Roll No. (High → Low)</option>
            <option value="dept_asc">Department (A–Z)</option>
            <option value="dept_desc">Department (Z-A)</option>
            <option value="class_asc">Class (A-Z)</option>
            <option value="class_desc">Class (Z-A)</option>
          </select>
        </div>
      </div>

      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left — Student List */}
        <div className="w-full lg:w-1/3 flex flex-col">
          <Card className="p-4 flex flex-col h-[75vh]">
            <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Search by name, roll, enrollment, department or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {filtered.length} student{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="text-center p-8 text-slate-400 text-sm">Loading students…</div>
              ) : filtered.length === 0 ? (
                <div className="text-center p-8 text-slate-400 text-sm">No students found.</div>
              ) : (
                filtered.map((s) => {
                  const sc = statusColor(s.fee_status, s.fees_paid);
                  const isSelected = selectedStudent?._id === s._id;
                  return (
                    <button
                      key={s._id}
                      onClick={() => handleSelect(s)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-150 ${
                        isSelected
                          ? 'border-violet-400 bg-violet-50 shadow-sm'
                          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className={`font-semibold truncate ${isSelected ? 'text-violet-800' : 'text-slate-800'}`}>
                            {s.name || 'Unnamed'}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {s.department_name || s.enrollment_no || s.email || '—'}
                          </p>
                          {getStudentClassValue(s) && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                              {getStudentClassValue(s)}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${sc.bg} ${sc.text}`}>
                          {s.fee_status || (s.fees_paid ? 'Paid' : 'Pending')}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          </Card>
        </div>

        {/* Right — Details + Form */}
        <div className="w-full lg:w-2/3">
          <Card className="p-6 min-h-[70vh]">
            {!selectedStudent ? (
              <div className="h-full min-h-[60vh] flex flex-col items-center justify-center text-slate-300">
                <UserCircle className="w-24 h-24 mb-4" />
                <h3 className="text-lg font-semibold text-slate-400">No Student Selected</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Select a student from the list to manage their fee record.
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
                {/* Student Header */}
                <div className="flex items-start justify-between pb-6 border-b border-slate-100 gap-4">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-black text-slate-900 truncate">{selectedStudent.name}</h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-sm">
                      <InfoChip label="Enrollment" value={selectedStudent.enrollment_no} />
                      <InfoChip label="Category" value={selectedStudent.category} highlight />
                      <InfoChip label="Department" value={selectedStudent.department_name} />
                      <InfoChip label="Class" value={getStudentClassValue(selectedStudent)} />
                      <InfoChip label="Email" value={selectedStudent.email} />
                      <InfoChip
                        label="Phone"
                        value={selectedStudent.phone_no || selectedStudent.phone || selectedStudent.mobile}
                      />
                      <InfoChip label="Batch Year" value={selectedStudent.batch_year} />
                    </div>
                  </div>

                  {(() => {
                    const sc = statusColor(selectedStudent.fee_status, selectedStudent.fees_paid);
                    return (
                      <div className={`shrink-0 px-4 py-2 rounded-xl text-center border ${sc.light} ${sc.border}`}>
                        <p className={`text-[10px] uppercase font-black tracking-widest opacity-60 ${sc.text}`}>Status</p>
                        <p className={`font-bold mt-0.5 ${sc.text}`}>
                          {selectedStudent.fee_status || (selectedStudent.fees_paid ? 'Paid' : 'Pending')}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Fee Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-2 right-2 opacity-5">
                      <IndianRupee className="w-20 h-20" />
                    </div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Fees</p>
                    <h3 className="text-3xl font-black text-slate-800">{formatCurrency(defaultFees)}</h3>
                    <p className="text-xs text-slate-400 mt-2">Category: {selectedStudent.category || '—'}</p>
                  </div>

                  <div
                    className={`rounded-2xl p-6 border shadow-sm relative overflow-hidden transition-colors ${
                      remainingAmount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'
                    }`}
                  >
                    <div className="absolute top-2 right-2 opacity-5">
                      <AlertCircle className="w-20 h-20" />
                    </div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                        remainingAmount > 0 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      Remaining Amount
                    </p>
                    <h3
                      className={`text-3xl font-black ${
                        remainingAmount > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatCurrency(remainingAmount)}
                    </h3>
                    <p
                      className={`text-xs mt-2 ${
                        remainingAmount > 0 ? 'text-amber-500' : 'text-emerald-500'
                      }`}
                    >
                      {remainingAmount > 0 ? 'Amount still pending' : 'Fully cleared ✓'}
                    </p>
                  </div>
                </div>

                {/* Update Panel */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-4">Update Paid Amount</h3>
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="w-full sm:w-2/3">
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Enter total amount paid so far
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <Input
                          type="number"
                          min="0"
                          className="pl-9 h-12 text-lg font-bold"
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="w-full sm:w-1/3">
                      <Button
                        className="w-full h-12 font-bold bg-violet-600 hover:bg-violet-700 text-white"
                        onClick={handleUpdate}
                        disabled={updating}
                      >
                        {updating ? 'Saving…' : 'Save Record'}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-3">
                    * Status (Paid / Partially Paid / Pending) will be auto-updated based on the amount entered.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// Small helper chip
function InfoChip({ label, value, highlight }) {
  return (
    <div className="flex gap-1 items-center">
      <span className="text-slate-400">{label}:</span>
      <strong
        className={
          highlight
            ? 'text-violet-600 bg-violet-50 px-2 rounded-md'
            : 'text-slate-700'
        }
      >
        {value || '—'}
      </strong>
    </div>
  );
}
