import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { Card } from '../../components/common/UI';

const DEPT_MAP = [
  { code: 'CSE', keywords: ['computer', 'cse'] },
  { code: 'IT', keywords: ['information', 'technology', 'it'] },
  { code: 'AIML', keywords: ['artificial', 'machine', 'learning', 'aiml', 'intellinece'] },
  { code: 'A&R', keywords: ['automation', 'robot', 'a&r', 'ar'] },
  { code: 'CIVIL', keywords: ['civil'] },
  { code: 'MECH', keywords: ['mechanical', 'mech'] },
  { code: 'E&TC', keywords: ['telecommunication', 'electronics', 'entc', 'etc', 'electronic'] }
];

const normalize = (value) => (value || '').toString().trim().toLowerCase();
const getDeptKey = (value) => {
  const normalized = normalize(value);
  if (!normalized) return '';
  const match = DEPT_MAP.find((dept) => dept.keywords.some((keyword) => normalized.includes(keyword)));
  return match ? match.code : '';
};

const getAcademicYear = (semester) => {
  const sem = Number(semester) || 0;
  if (sem <= 2) return 1;
  if (sem <= 4) return 2;
  if (sem <= 6) return 3;
  if (sem <= 8) return 4;
  return 1;
};

const getStudentClassLabel = (student) => {
  if (student.class_value) return student.class_value;
  if (student.group) return student.group;

  const semester = Number(student.current_semester || student.semester || 0);
  const year = getAcademicYear(semester);
  const dept = getDeptKey(student.department || student.department_name || student.department_code || student.dept || student.dept_name || '');
  if (dept) {
    return `FY ${year} (${dept})`;
  }
  return `FY ${year}`;
};

const buildDeptNameResolver = (departments) => {
  const aliases = new Map();

  const register = (alias, canonicalName) => {
    if (!alias || !canonicalName) return;
    aliases.set(normalize(alias), canonicalName);
    const key = getDeptKey(alias);
    if (key) aliases.set(key, canonicalName);
  };

  (departments || []).forEach((dept) => {
    const name = (dept.name || '').trim();
    if (!name) return;
    register(name, name);
    if (dept.code) register(dept.code, name);
  });

  return (raw) => {
    const value = (raw || '').toString().trim();
    if (!value) return '';
    const key = getDeptKey(value);
    if (key && aliases.has(key)) return aliases.get(key);
    const norm = normalize(value);
    if (aliases.has(norm)) return aliases.get(norm);
    return value;
  };
};

const getStudentDeptRaw = (student) =>
  student.department
    || student.department_name
    || student.department_code
    || student.dept
    || student.dept_name
    || student.degree
    || '';

const calculateCA = (marks) => {
  const pt1 = Number(marks.periodic_test_1) || 0;
  const pt2 = Number(marks.periodic_test_2) || 0;
  const ca1 = Math.ceil((pt1 * 5) / 20);
  const ca2 = Math.ceil((pt2 * 5) / 20);
  const attendance = 4;
  const assignment = 6;
  return {
    ca1,
    ca2,
    attendance,
    assignment,
    totalCA: ca1 + ca2 + attendance + assignment
  };
};

export default function MarksVerification() {
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [status, setStatus] = useState(null);
  const [studentData, setStudentData] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [examRes, subjectRes, deptRes] = await Promise.all([
          api.get('/exam-setup/'),
          api.get('/academic/subjects'),
          api.get('/academic/departments')
        ]);
        setExams(Array.isArray(examRes.data) ? examRes.data : []);
        setSubjects(Array.isArray(subjectRes.data) ? subjectRes.data : []);
        setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);

        if (!selectedExam && Array.isArray(examRes.data) && examRes.data.length > 0) {
          setSelectedExam(examRes.data[0]._id);
        }
      } catch (err) {
        console.error('Failed to load exams, subjects or departments:', err);
      }
    };

    loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedExam) {
      setStatus(null);
      return;
    }

    setLoadingStatus(true);
    api.get(`/marks-verify/status/${selectedExam}`)
      .then((r) => setStatus(r.data))
      .catch((err) => {
        console.error('Failed to load status:', err);
        setStatus(null);
      })
      .finally(() => setLoadingStatus(false));
  }, [selectedExam]);

  useEffect(() => {
    if (!selectedExam || !selectedSubject) {
      setStudentData([]);
      return;
    }

    setLoadingMarks(true);
    api.get(`/internal-marks/subject-overview/${selectedExam}/${selectedSubject}`)
      .then((r) => setStudentData(Array.isArray(r.data) ? r.data : []))
      .catch((err) => {
        console.error('Failed to fetch marks overview:', err);
        setStudentData([]);
      })
      .finally(() => setLoadingMarks(false));
  }, [selectedExam, selectedSubject]);

  const filteredSubjects = useMemo(() => {
    if (!selectedSemester) return [];
    const semKey = String(parseInt(selectedSemester, 10));
    return subjects
      .filter((subject) => {
        const sem = subject?.semester;
        if (sem === undefined || sem === null || sem === '') return false;
        return String(parseInt(sem, 10)) === semKey;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [subjects, selectedSemester]);

  const selectedSubjectObj = useMemo(
    () => subjects.find((subject) => subject._id === selectedSubject) ?? null,
    [subjects, selectedSubject]
  );

  const resolveDeptName = useMemo(() => buildDeptNameResolver(departments), [departments]);

  const departmentOptions = useMemo(() => {
    const names = departments
      .map((dept) => (dept.name || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return ['all', ...names];
  }, [departments]);

  const visibleStudents = useMemo(() => {
    if (!selectedDepartment || selectedDepartment === 'all') return studentData;
    return studentData.filter(
      (student) => resolveDeptName(getStudentDeptRaw(student)) === selectedDepartment
    );
  }, [studentData, selectedDepartment, resolveDeptName]);

  const forwardedSummary = useMemo(() => {
    let internal = 0;
    let external = 0;
    let both = 0;
    studentData.forEach((student) => {
      const internalSubmitted = student.is_submitted?.internal;
      const externalSubmitted = student.is_submitted?.external;
      if (internalSubmitted) internal += 1;
      if (externalSubmitted) external += 1;
      if (internalSubmitted && externalSubmitted) both += 1;
    });
    return { internal, external, both };
  }, [studentData]);

  const handleApprove = async () => {
    if (!selectedExam) return;
    setApproving(true);
    try {
      await api.post(`/marks-verify/approve/${selectedExam}`);
      alert('Marks verified! You can now compile results.');
      setStatus((prev) => prev ? { ...prev, all_ready: true } : prev);
    } catch (err) {
      console.error('Approve failed:', err);
      alert('Failed to approve marks.');
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Marks Verification</h1>
          <p className="text-slate-500 text-sm mt-1">Review marks forwarded by faculty before final result processing.</p>
        </div>
        {status?.all_ready && (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <ShieldCheck className="w-4 h-4" /> Approve for Result
          </button>
        )}
      </div>

      <Card className="p-6 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-[0.16em]">Exam Session</label>
            <select
              value={selectedExam}
              onChange={(e) => {
                setSelectedExam(e.target.value);
                setSelectedSemester('');
                setSelectedSubject('');
                setSelectedDepartment('all');
              }}
              className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Select exam session</option>
              {exams.map((exam) => (
                <option key={exam._id} value={exam._id}>{exam.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-[0.16em]">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                setSelectedSubject('');
                setSelectedDepartment('all');
              }}
              disabled={!selectedExam}
              className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            >
              <option value="">Select semester</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-[0.16em]">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedDepartment('all');
              }}
              disabled={!selectedExam || !selectedSemester}
              className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            >
              <option value="">Select subject</option>
              {filteredSubjects.map((subject) => (
                <option key={subject._id} value={subject._id}>
                  {subject.name} {subject.code ? `(${subject.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-[0.16em]">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              disabled={!selectedExam || !selectedSubject || departments.length === 0}
              className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            >
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>{dept === 'all' ? 'All Departments' : dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
            <div className="text-3xl font-bold text-slate-900">{status?.total_approved_students ?? '-'}</div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mt-1">Approved Students</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
            <div className="text-3xl font-bold text-slate-900">{selectedSubjectObj?.name ? visibleStudents.length : '-'}</div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mt-1">Rows Loaded</div>
          </div>
        </div>
      </Card>

      {(loadingStatus || loadingMarks) && (
        <div className="p-12 text-center text-slate-400">Loading marks and verification status...</div>
      )}

      {selectedExam && selectedSubject ? (
        <>
          <Card className="overflow-x-auto">
            <table className="min-w-full text-sm border-separate border-spacing-0">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {((selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') 
                    ? ['SR No.', 'Roll No.', 'Enrollment ID', 'Name', 'Internal Total (60)', 'External Total (40)', 'Final Total (100)']
                    : ['SR No.', 'Roll No.', 'Enrollment ID', 'Name', 'Total CA', 'Mid Sem Marks', 'External Exam Marks', 'total marks out of 100']
                  ).map((label) => (
                    <th key={label} className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-[0.12em] whitespace-nowrap">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {visibleStudents.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500">No marks data available for this exam/subject/class yet.</td>
                  </tr>
                ) : (
                  visibleStudents.map((student, index) => {
                    const ca = calculateCA(student.marks || {});
                    const internalTotal = (selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') 
                      ? (Number(student.marks?.practical_internal) || 0)
                      : ca.totalCA + (Number(student.marks?.mid_semester_exam) || 0);
                    const externalTotal = Number(student.marks?.external_exam) || 0;
                    const finalTotal = internalTotal + externalTotal;

                    return (
                      <tr key={student.student_id || index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-700">{index + 1}</td>
                        <td className="px-4 py-3 text-slate-800 font-semibold">{student.roll_no || '--'}</td>
                        <td className="px-4 py-3 text-slate-600">{student.enrollment_no || '--'}</td>
                        <td className="px-4 py-3 text-slate-900 font-medium">{student.student_name || student.name || '—'}</td>
                        
                        {(selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') ? (
                          <>
                            <td className="px-4 py-3 text-indigo-700 font-bold bg-indigo-50/20">{internalTotal}</td>
                            <td className="px-4 py-3 text-slate-600 font-semibold">{student.marks?.external_exam ?? '0'}</td>
                            <td className="px-4 py-3 text-slate-900 font-black bg-amber-50 text-base">{finalTotal}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-slate-800 font-semibold">{ca.totalCA}</td>
                            <td className="px-4 py-3 text-slate-600">{student.marks?.mid_semester_exam ?? '-'}</td>
                            <td className="px-4 py-3 text-slate-600">{student.marks?.external_exam ?? '-'}</td>
                            <td className="px-4 py-3 text-slate-800 font-bold bg-amber-50">{finalTotal}</td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <Card className="p-6 text-slate-500">Select an exam session, semester, and subject to load marks verification data.</Card>
      )}
    </div>
  );
}
