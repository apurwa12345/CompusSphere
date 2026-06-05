import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button } from '../../components/common/UI';
import { Loader2, BookOpen, Filter, Download, FileSpreadsheet, Calculator } from 'lucide-react';
import api from '../../services/api';
import * as XLSX from 'xlsx';

export default function MarksOverview() {
  const [examSessions, setExamSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Class division config (to match other pages)
  const CLASS_DIVISION = {
    CSE: { fy: 1, total: 208, sections: 3 },
    IT: { fy: 2, total: 121, sections: 2 },
    AIML: { fy: 3, total: 69, sections: 1 },
    'A&R': { fy: 4, total: 64, sections: 1 },
    CIVIL: { fy: 5, total: 73, sections: 1 },
    MECH: { fy: 6, total: 59, sections: 1 },
    'E&TC': { fy: 7, total: 69, sections: 1 }
  };

  const INTERNAL_FORWARD_TYPES = ['periodic_test_1', 'periodic_test_2', 'mid_semester_exam', 'practical_internal'];

  const normalizeText = (value) => {
    if (value === null || value === undefined) return '';
    return value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 &]/g, '');
  };

  const normalizeDeptKey = (value) => normalizeText(value).replace(/\s+/g, '');

  const getDeptKeyForStudent = (student) => {
    const raw = [
      student?.department,
      student?.department_name,
      student?.department_code,
      student?.dept,
      student?.dept_name,
      student?.dept_code
    ]
      .filter(Boolean)
      .join(' ');

    const candidate = normalizeDeptKey(raw);
    if (!candidate) return '';

    const matches = (keys) => keys.some((k) => {
      const nk = normalizeDeptKey(k);
      return candidate === nk || candidate.includes(nk) || nk.includes(candidate);
    });

    if (matches(['aiml', 'artificialintelligence', 'machinelearning', 'artificialintelligencemachinelearning'])) return 'AIML';
    if (matches(['etc', 'entc', 'electronic', 'telecommunication', 'electronicstelecommunication'])) return 'E&TC';
    if (matches(['automation', 'robotics', 'automationrobotics'])) return 'A&R';
    if (matches(['cse', 'computerscience', 'computerscienceengineering'])) return 'CSE';
    if (matches(['it', 'informationtechnology'])) return 'IT';
    if (matches(['civil', 'civilengineering'])) return 'CIVIL';
    if (matches(['mech', 'mechanical', 'mechanicalengineering'])) return 'MECH';

    return '';
  };

  const getRollValue = (student) => (student?.roll_no || student?.enrollment_no || student?.student_id || '').toString();

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

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [examRes, subRes] = await Promise.all([
          api.get('/exam-setup/'),
          api.get('/academic/faculty/my-subjects')
        ]);
        const activeExams = examRes.data.filter(e => ['Upcoming', 'Ongoing', 'Completed'].includes(e.status));
        setExamSessions(activeExams);
        if (activeExams.length > 0) setSelectedExam(activeExams[0]._id);
        const subjectsData = subRes.data || [];
        setSubjects(subjectsData);
        if (subjectsData.length === 1) {
          setSelectedSubject(subjectsData[0]._id);
        }
      } catch (err) {
        console.error('Data fetch failed', err);
        showMessage('error', 'Failed to load initial data');
      } finally {
        setInitialLoading(false);
      }
    };
    fetchInitial();
  }, []);

  const selectedSubjectObj = useMemo(() => {
    return subjects.find((s) => s._id === selectedSubject);
  }, [subjects, selectedSubject]);

  useEffect(() => {
    if (!selectedSubjectObj || !selectedSubjectObj.allocated_classes) return;
    if (selectedSubjectObj.allocated_classes.length === 1 && classFilter === 'all') {
      setClassFilter(selectedSubjectObj.allocated_classes[0]);
    }
  }, [selectedSubjectObj, classFilter]);

  useEffect(() => {
    setData([]);
    setClassFilter('all');
  }, [selectedExam, selectedSubject]);

  const classOptions = useMemo(() => {
    if (!selectedSubjectObj || !selectedSubjectObj.allocated_classes) return [];

    return selectedSubjectObj.allocated_classes
      .map((cls) => ({ value: cls, label: cls }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedSubjectObj]);

  const classIndexMap = useMemo(() => {
    const groups = new Map();
    for (const s of data) {
      const deptKey = getDeptKeyForStudent(s) || '__UNKNOWN__';
      if (!groups.has(deptKey)) groups.set(deptKey, []);
      groups.get(deptKey).push(s);
    }

    const map = new Map();
    for (const [deptKey, list] of groups.entries()) {
      const sorted = [...list].sort((a, b) => {
        const ar = getRollValue(a);
        const br = getRollValue(b);
        const cmpRoll = ar.localeCompare(br, undefined, { numeric: true, sensitivity: 'base' });
        if (cmpRoll !== 0) return cmpRoll;
        const an = (a.student_name || a.name || '').toString().toLowerCase();
        const bn = (b.student_name || b.name || '').toString().toLowerCase();
        return an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' });
      });
      sorted.forEach((s, idx) => {
        map.set(s.student_id, idx);
      });
    }
    return map;
  }, [data]);

  const getClassForStudent = (student) => {
    const deptKey = getDeptKeyForStudent(student);
    const cfg = CLASS_DIVISION[deptKey];
    if (!cfg) return '';

    const sizes = computeSectionSizes(deptKey);
    const indexWithinDept = classIndexMap.get(student.student_id);
    if (indexWithinDept === null || indexWithinDept === undefined) return '';

    let idx = indexWithinDept;
    let sectionIndex = 0;
    while (sectionIndex < sizes.length && idx >= sizes[sectionIndex]) {
      idx -= sizes[sectionIndex];
      sectionIndex += 1;
    }
    const letter = String.fromCharCode('A'.charCodeAt(0) + Math.min(sectionIndex, 25));
    return `FY ${cfg.fy} ${letter}`;
  };

  const showMessage = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const fetchOverviewData = async () => {
    if (!selectedExam || !selectedSubject) {
      showMessage('error', 'Please select an exam session and subject before loading the overview.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/internal-marks/subject-overview/${selectedExam}/${selectedSubject}`);
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const serverMessage = err?.response?.data?.message || err.message || 'Failed to fetch student marks overview';
      console.error('Failed to fetch overview data:', err?.response?.data || err);
      showMessage('error', serverMessage);
    } finally {
      setLoading(false);
    }
  };

  // Logic for Attendance Marks
  const calculateAttendanceMarks = (percentage) => {
    if (percentage >= 75) return 4;
    if (percentage >= 51) return 3;
    return 2;
  };

  const studentsWithComputedMarks = useMemo(() => {
    // Note: We are hardcoding 100% attendance and 6 marks assignment for now as requested
    return data.map((s) => {
      const marks = s.marks || {};
      const pt1 = parseFloat(marks.periodic_test_1) || 0;
      const pt2 = parseFloat(marks.periodic_test_2) || 0;

      // CA1/CA2 from DB if available, otherwise calculate on the fly (though backend should have them if locked)
      const ca1 = marks.ca1 !== '' && marks.ca1 !== undefined ? parseFloat(marks.ca1) : Math.ceil((pt1 * 5) / 20);
      const ca2 = marks.ca2 !== '' && marks.ca2 !== undefined ? parseFloat(marks.ca2) : Math.ceil((pt2 * 5) / 20);

      const attendanceMarks = calculateAttendanceMarks(100); // 100% attendance -> 4 marks
      const assignmentMarks = 6; // Constant 6 marks as requested

      const totalCA = ca1 + ca2 + attendanceMarks + assignmentMarks;

      return {
        ...s,
        marks,
        computed: {
          ca1,
          ca2,
          attendance: attendanceMarks,
          assignment: assignmentMarks,
          totalCA
        }
      };
    });
  }, [data]);

  const filteredStudents = useMemo(() => {
    let computed = studentsWithComputedMarks.map(s => ({
      ...s,
      __computed_class: getClassForStudent(s)
    }));

    if (classFilter !== 'all') {
      computed = computed.filter(s => s.__computed_class === classFilter);
    }

    return computed;
  }, [studentsWithComputedMarks, classFilter, classIndexMap]);

  const handleExportExcel = () => {
    if (!filteredStudents.length) return;

    const subjectName = selectedSubjectObj ? `${selectedSubjectObj.name} (${selectedSubjectObj.code})` : 'Subject';
    const exportDate = new Date().toLocaleString('en-IN');

    const headerRows = [
      ['Subject', subjectName],
      ['Report', 'Internal Marks Overview'],
      ['Export Date', exportDate],
      []
    ];

    const dataHeader = [
      'SR. No',
      'Roll No',
      'Enrollment ID',
      'Student Name',
      'PT1 Marks',
      'PT2 Marks',
      'CA1',
      'CA2',
      'Attendance',
      'Assignment',
      'Total CA',
      'Mid Sem',
      'External Marks'
    ];

    const dataRows = filteredStudents.map((s, index) => [
      index + 1,
      s.roll_no || '--',
      s.enrollment_no || '--',
      s.student_name,
      s.marks.periodic_test_1 || 0,
      s.marks.periodic_test_2 || 0,
      s.computed.ca1,
      s.computed.ca2,
      s.computed.attendance,
      s.computed.assignment,
      s.computed.totalCA,
      s.marks.mid_semester_exam || 0,
      s.marks.external_exam || 0
    ]);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([...headerRows, dataHeader, ...dataRows]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Overview');
    XLSX.writeFile(workbook, `Marks_Overview_${selectedSubjectObj?.code || 'Subject'}.xlsx`);
  };

  const handleForwardToExamCell = async () => {
    if (!selectedExam || !selectedSubject || !filteredStudents.length) {
      showMessage('error', 'Load the overview first before forwarding marks to the Exam Cell.');
      return;
    }

    if (!window.confirm('Are you sure you want to forward all assessment marks (Internal & External) to the Exam Cell? This will lock them for further editing.')) {
      return;
    }

    setForwarding(true);
    try {
      await Promise.all(INTERNAL_FORWARD_TYPES.map((exam_type) =>
        api.post('/marks-verify/forward', {
          exam_id: selectedExam,
          subject_id: selectedSubject,
          exam_mode: 'internal',
          exam_type
        })
      ));

      await api.post('/marks-verify/forward', {
        exam_id: selectedExam,
        subject_id: selectedSubject,
        exam_mode: 'external'
      });

      await fetchOverviewData();
      showMessage('success', 'All marks forwarded to Exam Cell successfully!');
    } catch (err) {
      console.error('Forwarding failed:', err?.response?.data || err);
      showMessage('error', err.response?.data?.message || err.message || 'Failed to forward marks');
    } finally {
      setForwarding(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-6">
      {statusMessage && (
        <div className="fixed top-6 right-6 z-50 w-[min(420px,calc(100vw-3rem))]">
          <div className={`rounded-2xl p-4 text-sm shadow-lg border backdrop-blur bg-white/90 ${statusMessage.type === 'success' ? 'text-emerald-800 border-emerald-100' : 'text-rose-800 border-rose-100'
            }`}>
            {statusMessage.text}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Marks Overview</h1>
          <p className="text-slate-500">Comprehensive summary of all assessments.</p>
        </div>
        <div className="flex items-center space-x-3 text-sm text-slate-500 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
          <Calculator className="h-5 w-5 text-indigo-500" />
          <span className="font-medium">Marks Aggregator</span>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-3 space-y-2">
            <label className="text-sm font-semibold text-slate-700">Exam Session</label>
            <select
              value={selectedExam}
              onChange={e => setSelectedExam(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="">-- Select Session --</option>
              {examSessions.map(exam => (
                <option key={exam._id} value={exam._id}>{exam.name}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3 space-y-2">
            <label className="text-sm font-semibold text-slate-700">Subject</label>
            <div className="relative">
              <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none"
              >
                <option value="">Choose Subject</option>
                {subjects.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-2">
            <label className="text-sm font-semibold text-slate-700">Class (Allocated)</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              disabled={!selectedSubject}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none disabled:opacity-50"
            >
              <option value="all">Select Class</option>
              {classOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3 flex gap-2">
            <Button className="flex-1 py-2.5" onClick={fetchOverviewData} disabled={!selectedSubject || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Show Overview'}
            </Button>
            <Button
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white border-0"
              onClick={handleForwardToExamCell}
              disabled={!filteredStudents.length || forwarding}
            >
              {forwarding ? 'Forwarding...' : 'Forward to Exam Cell'}
            </Button>
            <Button variant="secondary" className="bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={handleExportExcel} disabled={!filteredStudents.length}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-slate-100 shadow-xl shadow-slate-100/50">
        {!filteredStudents.length ? (
          <div className="p-20 text-center">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Filter className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-900 font-bold">No Data Loaded</h3>
            <p className="text-slate-400 text-sm max-w-xs mx-auto mt-2">Select a subject and click "Show Overview" to see the comprehensive marks table.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px]">SR.</th>
                  <th className="px-4 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px]">Roll No.</th>
                  <th className="px-4 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px]">Enrollment ID</th>
                  <th className="px-4 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px]">Student Name</th>
                  
                  {(selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') ? (
                    <>
                      <th className="px-2 py-4 text-center font-bold text-violet-500 uppercase tracking-widest text-[9px] bg-violet-50/30">Theory Att</th>
                      <th className="px-2 py-4 text-center font-bold text-emerald-500 uppercase tracking-widest text-[9px] bg-emerald-50/30">Prac Att</th>
                      <th className="px-2 py-4 text-center font-bold text-amber-500 uppercase tracking-widest text-[9px] bg-amber-50/30">Journal</th>
                      <th className="px-2 py-4 text-center font-bold text-amber-500 uppercase tracking-widest text-[9px] bg-amber-50/30">Project</th>
                      <th className="px-2 py-4 text-center font-bold text-blue-500 uppercase tracking-widest text-[9px] bg-blue-50/30">Prac Perf</th>
                      <th className="px-2 py-4 text-center font-bold text-rose-500 uppercase tracking-widest text-[9px] bg-rose-50/30">Teach Assess</th>
                      <th className="px-4 py-4 text-center font-bold text-indigo-700 uppercase tracking-widest text-[10px] bg-slate-100">Internal Total</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-4 text-center font-bold text-slate-400 uppercase tracking-widest text-[10px] bg-blue-50/30">PT1</th>
                      <th className="px-4 py-4 text-center font-bold text-slate-400 uppercase tracking-widest text-[10px] bg-blue-50/30">PT2</th>
                      <th className="px-4 py-4 text-center font-bold text-indigo-500 uppercase tracking-widest text-[10px]">CA1</th>
                      <th className="px-4 py-4 text-center font-bold text-indigo-500 uppercase tracking-widest text-[10px]">CA2</th>
                      <th className="px-4 py-4 text-center font-bold text-slate-400 uppercase tracking-widest text-[10px]">Atten.</th>
                      <th className="px-4 py-4 text-center font-bold text-slate-400 uppercase tracking-widest text-[10px]">Assign.</th>
                      <th className="px-4 py-4 text-center font-bold text-rose-600 uppercase tracking-widest text-[10px] bg-rose-50/30">Total CA</th>
                      <th className="px-4 py-4 text-center font-bold text-slate-400 uppercase tracking-widest text-[10px]">Mid Sem</th>
                    </>
                  )}
                  <th className="px-4 py-4 text-center font-bold text-slate-600 uppercase tracking-widest text-[10px] bg-indigo-50/50 border-l border-slate-200">External ({(selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') ? 40 : 60})</th>
                  <th className="px-4 py-4 text-center font-bold text-slate-900 uppercase tracking-widest text-[10px] bg-amber-100 border-l border-amber-200">Final Total (100)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStudents.map((s, idx) => (
                  <tr
                    key={s.student_id}
                    className={`hover:bg-indigo-50/10 transition-colors ${s.is_submitted.internal && s.is_submitted.external ? 'bg-green-50/20' : ''
                      }`}
                  >
                    <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3.5 text-slate-800 font-semibold">{s.roll_no || '--'}</td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">{s.enrollment_no || '--'}</td>
                    <td className="px-4 py-3.5 text-slate-900 font-bold">{s.student_name}</td>
                    {(selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') ? (
                      <>
                        <td className="px-2 py-3.5 text-center font-bold text-violet-700 bg-violet-50/10">{s.marks.practical_components?.theory_att_marks || '0'}</td>
                        <td className="px-2 py-3.5 text-center font-bold text-emerald-700 bg-emerald-50/10">{s.marks.practical_components?.prac_att_marks || '0'}</td>
                        <td className="px-2 py-3.5 text-center font-bold text-amber-700 bg-amber-50/10">{s.marks.practical_components?.journal || '0'}</td>
                        <td className="px-2 py-3.5 text-center font-bold text-amber-700 bg-amber-50/10">{s.marks.practical_components?.project || '0'}</td>
                        <td className="px-2 py-3.5 text-center font-bold text-blue-700 bg-blue-50/10">{s.marks.practical_components?.performance || '0'}</td>
                        <td className="px-2 py-3.5 text-center font-bold text-rose-700 bg-rose-50/10">{s.marks.practical_components?.assessment || '0'}</td>
                        <td className="px-4 py-3.5 text-center font-black text-indigo-900 bg-slate-100">{s.marks.practical_internal || '0'}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3.5 text-center font-medium text-slate-600 bg-blue-50/10">{s.marks.periodic_test_1 || '0'}</td>
                        <td className="px-4 py-3.5 text-center font-medium text-slate-600 bg-blue-50/10">{s.marks.periodic_test_2 || '0'}</td>
                        <td className="px-4 py-3.5 text-center font-black text-indigo-600">{s.computed.ca1}</td>
                        <td className="px-4 py-3.5 text-center font-black text-indigo-600">{s.computed.ca2}</td>
                        <td className="px-4 py-3.5 text-center font-bold text-slate-700">{s.computed.attendance}</td>
                        <td className="px-4 py-3.5 text-center font-bold text-slate-700">{s.computed.assignment}</td>
                        <td className="px-4 py-3.5 text-center font-black text-rose-700 bg-rose-50/10 text-base">{s.computed.totalCA}</td>
                        <td className="px-4 py-3.5 text-center font-medium text-slate-600">{s.marks.mid_semester_exam || '0'}</td>
                      </>
                    )}
                    <td className="px-4 py-3.5 text-center font-black text-indigo-800 bg-indigo-50/20 border-l border-slate-200">
                      {s.marks.external_exam !== '' ? s.marks.external_exam : '--'}
                      {s.locks.external_exam && (
                        <div className="text-[8px] text-green-600 uppercase mt-1 tracking-tighter">Verified</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center font-black text-slate-900 bg-amber-50 border-l border-amber-200 text-lg">
                      {(() => {
                        const internal = (selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') 
                          ? (parseFloat(s.marks.practical_internal) || 0)
                          : (parseFloat(s.computed.totalCA) || 0) + (parseFloat(s.marks.mid_semester_exam) || 0);
                        const external = parseFloat(s.marks.external_exam) || 0;
                        return Math.round(internal + external);
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-4">
        <Calculator className="w-6 h-6 text-amber-500 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-bold mb-0.5 uppercase tracking-tight">Calculation Logic</p>
          {(selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') ? (
            <ul className="list-disc list-inside opacity-90 space-y-0.5 text-xs">
              <li><strong>Internal (60)</strong>: Theory Att(6) + Prac Att(6) + Journal(12) + Project(12) + Perf(12) + Assess(12).</li>
              <li><strong>External (40)</strong>: Terminal practical examination.</li>
              <li><strong>Total</strong>: Internal (60) + External (40) = 100 Marks.</li>
            </ul>
          ) : (
            <ul className="list-disc list-inside opacity-90 space-y-0.5 text-xs">
              <li><strong>CA1/CA2</strong>: Ceil((PT marks * 5) / 20). Max 5 each.</li>
              <li><strong>Attendance</strong>: {`>=75%: 4, >=51%: 3, <51%: 2`}. (Defaulting to 100% attendance).</li>
              <li><strong>Assignment</strong>: Fixed 6 marks for all students as per current policy.</li>
              <li><strong>Total CA</strong>: CA1 + CA2 + Attendance + Assignment. Max 20.</li>
              <li><strong>Internal (40)</strong>: Theory internal marks (CA1 + CA2 + Attendance + Assignment = 20 marks, Mid Sem = 20 marks).</li>
              <li><strong>External (60)</strong>: End Semester examination (Theory).</li>
              <li><strong>Total</strong>: Internal (40) + External (60) = 100 Marks.</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
