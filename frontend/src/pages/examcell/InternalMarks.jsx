import React, { useState, useEffect } from 'react';
import { X, Eye } from 'lucide-react';
import api from '../../services/api';

export default function InternalMarks() {
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSubjectType, setSelectedSubjectType] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [subjectsByType, setSubjectsByType] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const SUBJECT_TYPES = ['Theory', 'Practical', 'Practical Lab'];

  const normalize = (v) => (v ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

  // Students data stores department as full name (e.g. "INFORMATION TECHNOLOGY (B.Tech)"),
  // while UI uses short keys (CSE/IT/...). Convert key -> best matching department name.
  const getDepartmentNameForKey = (deptKey) => {
    const key = normalize(deptKey);
    if (!key) return '';

    const deps = Array.isArray(departments) ? departments : [];
    const byCode = deps.find((d) => normalize(d?.code) === key);
    if (byCode?.name) return byCode.name;

    const nameIncludes = (needle) => deps.find((d) => normalize(d?.name).includes(needle));

    if (key === 'cse') return nameIncludes('computer science')?.name || '';
    if (key === 'it') return nameIncludes('information technology')?.name || '';
    if (key === 'aiml') return nameIncludes('artificial intelligence')?.name || nameIncludes('machine learning')?.name || '';
    if (key === 'a&r' || key === 'ar') return nameIncludes('automation')?.name || nameIncludes('robotics')?.name || '';
    if (key === 'civil') return nameIncludes('civil')?.name || '';
    if (key === 'mech') return nameIncludes('mechanical')?.name || '';
    if (key === 'e&tc' || key === 'entc' || key === 'etc') return nameIncludes('telecommunication')?.name || nameIncludes('electronics')?.name || '';

    return '';
  };

  // Class division config (kept in sync with Faculty pages)
  const CLASS_DIVISION = {
    CSE: { fy: 1, sections: 3 },
    IT: { fy: 2, sections: 2 },
    AIML: { fy: 3, sections: 1 },
    'A&R': { fy: 4, sections: 1 },
    CIVIL: { fy: 5, sections: 1 },
    MECH: { fy: 6, sections: 1 },
    'E&TC': { fy: 7, sections: 1 }
  };

  const generateClasses = () => {
    const classList = [];
    Object.entries(CLASS_DIVISION)
      .sort((a, b) => a[1].fy - b[1].fy)
      .forEach(([deptName, config]) => {
      for (let i = 1; i <= config.sections; i++) {
        const section = String.fromCharCode(64 + i); // A, B, C...
        classList.push(`FY ${config.fy} ${section} (${deptName})`);
      }
      });
    return classList;
  };

  useEffect(() => {
    api.get('/academic/departments')
      .then(r => setDepartments(Array.isArray(r.data) ? r.data : []))
      .catch(console.error);
    setClasses(generateClasses());
  }, []);

  // When department changes, reset class only if the selected class doesn't match
  useEffect(() => {
    if (selectedDept && selectedClass) {
      const deptMatch = selectedClass.match(/\(([^)]+)\)/);
      const classDept = deptMatch ? deptMatch[1] : '';
      if (classDept !== selectedDept) {
        setSelectedClass('');
      }
    }
  }, [selectedDept]);

  useEffect(() => {
    if (!selectedSubjectType || !selectedClass) {
      setStudents([]);
      setSubjectsByType([]);
      return;
    }

    // Extract department name from selectedClass (e.g., "FY 1 A (CSE)" → "CSE")
    const deptMatch = selectedClass.match(/\(([^)]+)\)/);
    const deptKeyFromClass = deptMatch ? deptMatch[1] : '';
    const deptKey = selectedDept || deptKeyFromClass;
    const deptName = getDepartmentNameForKey(deptKey);

    // Extract section (e.g., "FY 1 A (CSE)" → "A")
    const sectionMatch = selectedClass.match(/FY \d+ ([A-Z])/);
    const section = sectionMatch ? sectionMatch[1] : '';

    if (!deptKey || !deptName) {
      setStudents([]);
      setSubjectsByType([]);
      return;
    }

    setLoading(true);
    Promise.all([
      // Fetch students by department first. Many imported datasets have inconsistent/missing
      // group values, so we apply section filtering on the client only if it matches.
      api.get(`/academic/students`, { params: { department: deptName } }),
      // Fetch all subjects then filter by selected type in UI (dataset fields vary).
      api.get(`/academic/subjects`)
    ])
      .then(([sRes, subjRes]) => {
        const rawStudents = Array.isArray(sRes.data) ? sRes.data : [];
        const normSection = normalize(section).toUpperCase();
        const hasGroupMatches = normSection
          ? rawStudents.some((s) => (s?.group ?? '').toString().trim().toUpperCase() === normSection)
          : false;

        const studentList = hasGroupMatches
          ? rawStudents.filter((s) => (s?.group ?? '').toString().trim().toUpperCase() === normSection)
          : rawStudents;

        // Sort students by roll_no for consistent display
        const sortedStudents = studentList.sort((a, b) => {
          const rollA = (a?.roll_no ?? '').toString();
          const rollB = (b?.roll_no ?? '').toString();
          return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
        });
        setStudents(sortedStudents);

        const allSubjects = Array.isArray(subjRes.data) ? subjRes.data : [];
        const inferSubjectType = (subj) => {
          const st = subj?.subject_type ?? subj?.type ?? '';
          if (st && SUBJECT_TYPES.includes(st)) return st;
          const name = (subj?.name ?? '').toString();
          if (/lab/i.test(name)) return 'Practical Lab';
          // If no better info, treat as Theory (default)
          return 'Theory';
        };

        const filtered = allSubjects.filter((s) => inferSubjectType(s) === selectedSubjectType);
        const sortedSubjects = filtered.sort((a, b) => (a?.code || '').localeCompare(b?.code || ''));
        setSubjectsByType(sortedSubjects);
        setEditValues({});
      })
      .catch(err => {
        console.error(err);
        setStudents([]);
        setSubjectsByType([]);
      })
      .finally(() => setLoading(false));
  }, [selectedDept, selectedSubjectType, selectedClass]);

  const viewStudentDetails = async (student) => {
    setSelectedStudent(student);
    setDetailLoading(true);
    try {
      const res = await api.get(`/student/${student._id}`);
      setStudentDetail(res.data);
    } catch (err) {
      console.error(err);
      setStudentDetail(student);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeStudentDetail = () => {
    setSelectedStudent(null);
    setStudentDetail(null);
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Internal Marks</h1>
        <p className="text-slate-500 text-sm mt-1">Enter internal marks by department, subject type and class</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Department</label>
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">— All Departments —</option>
            {(departments?.length ? departments : [
              { code: 'CSE', name: 'Computer Science & Engineering' },
              { code: 'IT', name: 'Information Technology' },
              { code: 'AIML', name: 'Artificial Intelligence & Machine Learning' },
              { code: 'A&R', name: 'Automation & Robotics' },
              { code: 'CIVIL', name: 'Civil Engineering' },
              { code: 'MECH', name: 'Mechanical Engineering' },
              { code: 'E&TC', name: 'Electronics & Telecommunication' }
            ]).map((dept) => {
              const value = (dept?.code || dept?.name || '').toString();
              const label = dept?.code ? `${dept.code}${dept?.name ? ` — ${dept.name}` : ''}` : (dept?.name || value);
              if (!value) return null;
              return (
                <option key={value} value={value}>{label}</option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Subject Type</label>
          <select
            value={selectedSubjectType}
            onChange={e => setSelectedSubjectType(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">— Select Type —</option>
            {SUBJECT_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Class</label>
          <select
            value={selectedClass}
            onChange={e => {
              setSelectedClass(e.target.value);
              // Auto-set department from class selection
              if (e.target.value) {
                const match = e.target.value.match(/\(([^)]+)\)/);
                if (match && !selectedDept) {
                  setSelectedDept(match[1]);
                }
              }
            }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">— All Classes —</option>
            {classes
              .map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
          </select>
        </div>

        <div className="flex items-end">
          <div className="w-full h-10 bg-violet-100 rounded-lg text-xs font-bold text-violet-700 flex items-center px-3">
            {selectedSubjectType && selectedClass ? 'Ready to Load' : 'Select Filters'}
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!selectedSubjectType || !selectedClass ? (
          <div className="p-12 text-center text-slate-400">Select subject type and class to view students</div>
        ) : loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No students found for the selected filters</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 w-12">Sr No</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 sticky left-12 bg-slate-50 z-10">Student</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 w-16">Roll No</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Enrollment</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Category</th>
                  {subjectsByType.map(subj => (
                    <th key={subj._id} className="px-4 py-3 text-center font-semibold text-slate-600 bg-slate-50">
                      <div className="text-xs font-bold">{subj.code}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{subj.name.substring(0, 18)}</div>
                      <div className="text-[9px] text-slate-400">{subj.subject_type || '—'}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, idx) => (
                  <tr key={student._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center font-bold text-slate-700 text-sm">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 sticky left-12 bg-white hover:bg-slate-50 z-10">
                      {student.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-slate-700 text-sm">{student.roll_no || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{student.enrollment_no || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
                        {student.category || '—'}
                      </span>
                    </td>
                    {subjectsByType.map(subj => (
                      <td key={`${student._id}_${subj._id}`} className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min={0}
                          max={30}
                          placeholder="—"
                          onChange={e => setEditValues({
                            ...editValues,
                            [`${student._id}_${subj._id}`]: e.target.value
                          })}
                          className="w-16 border border-slate-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => viewStudentDetails(student)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        title="View student details"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
            <div className="sticky top-0 bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="text-xl font-bold">Student Details</h2>
              <button onClick={closeStudentDetail} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailLoading ? (
                <div className="text-center py-8 text-slate-400">Loading student details...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Name</p>
                      <p className="text-lg font-bold text-slate-800">{selectedStudent.name || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Enrollment No</p>
                      <p className="text-lg font-bold text-slate-800">{selectedStudent.enrollment_no || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Department</p>
                      <p className="text-lg font-bold text-slate-800">{selectedStudent.department_name || studentDetail?.department_name || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Class</p>
                      <p className="text-lg font-bold text-slate-800">{selectedClass || '—'}</p>
                    </div>
                  </div>

                  {studentDetail && (
                    <div className="border-t border-slate-200 pt-6">
                      <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Additional Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {studentDetail.email && (
                          <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Email</p>
                            <p className="text-sm text-slate-700">{studentDetail.email}</p>
                          </div>
                        )}
                        {(studentDetail.phone_no || studentDetail.phone || studentDetail.mobile) && (
                          <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Phone</p>
                            <p className="text-sm text-slate-700">{studentDetail.phone_no || studentDetail.phone || studentDetail.mobile}</p>
                          </div>
                        )}
                        {studentDetail.category && (
                          <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Category</p>
                            <p className="text-sm text-slate-700">{studentDetail.category}</p>
                          </div>
                        )}
                        {studentDetail.batch_year && (
                          <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Batch Year</p>
                            <p className="text-sm text-slate-700">{studentDetail.batch_year}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
