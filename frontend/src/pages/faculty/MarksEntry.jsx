import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button } from '../../components/common/UI';
import { Loader2, BookOpen, Filter, AlertCircle, Download, Upload, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import * as XLSX from 'xlsx';

export default function MarksEntry() {
  const [examSessions, setExamSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [examMode, setExamMode] = useState('internal');
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedInternalExam, setSelectedInternalExam] = useState('');
  const [sortOn, setSortOn] = useState('name');
  const [classFilter, setClassFilter] = useState('all');

  const [students, setStudents] = useState([]);
  const [hasExistingMarks, setHasExistingMarks] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const internalExamOptions = [
    { value: 'periodic_test_1', label: 'Periodic Test 1' },
    { value: 'mid_semester_exam', label: 'Mid Semester Exam' },
    { value: 'periodic_test_2', label: 'Periodic Test 2' }
  ];
  const externalExamOptions = [
    { value: 'end_semester', label: 'End Semester' }
  ];
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [lockingAll, setLockingAll] = useState(false);
  const [forwardingAll, setForwardingAll] = useState(false);
  const [editingRows, setEditingRows] = useState({});
  const [rowDrafts, setRowDrafts] = useState({});
  const [savingRows, setSavingRows] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [hasShownData, setHasShownData] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const examTypeOptions = examMode === 'external' ? externalExamOptions : internalExamOptions;

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [examRes, subRes] = await Promise.all([
          api.get('/exam-setup/'),
          api.get('/academic/faculty/my-subjects')
        ]);
        // Filter for active/recent exams
        const activeExams = examRes.data.filter(e => ['Upcoming', 'Ongoing', 'Completed'].includes(e.status));
        setExamSessions(activeExams);
        if (activeExams.length > 0) {
          // Keep one active exam session selected internally for API calls.
          setSelectedExam(activeExams[0]._id);
        }
        setSubjects(subRes.data);
      } catch (err) { console.error('Data fetch failed', err); }
    };
    fetchInitial();
  }, []);

  // Class division config (kept in sync with Students pages).
  const CLASS_DIVISION = {
    CSE: { fy: 1, total: 208, sections: 3 },
    IT: { fy: 2, total: 121, sections: 2 },
    AIML: { fy: 3, total: 69, sections: 1 },
    'A&R': { fy: 4, total: 64, sections: 1 },
    CIVIL: { fy: 5, total: 73, sections: 1 },
    MECH: { fy: 6, total: 59, sections: 1 },
    'E&TC': { fy: 7, total: 69, sections: 1 }
  };

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

    // Order matters: avoid "it" matching inside long AI strings.
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

  const selectedSubjectObj = useMemo(() => {
    return subjects.find((s) => s._id === selectedSubject);
  }, [subjects, selectedSubject]);

  const classOptions = useMemo(() => {
    const allClasses = Object.entries(CLASS_DIVISION)
      .sort((a, b) => a[1].fy - b[1].fy)
      .flatMap(([deptKey, cfg]) => {
        const sizes = computeSectionSizes(deptKey);
        return sizes.map((_sz, i) => {
          const letter = String.fromCharCode('A'.charCodeAt(0) + i);
          const value = `FY ${cfg.fy} ${letter}`;
          const label = `${value} (${deptKey})`;
          return { value, label };
        });
      });

    if (selectedSubjectObj && selectedSubjectObj.allocated_classes && selectedSubjectObj.allocated_classes.length > 0) {
      return allClasses.filter((opt) => selectedSubjectObj.allocated_classes.includes(opt.value));
    }

    // If no specific class is allocated, do not show all classes.
    return [];
  }, [selectedSubjectObj]);

  const classIndexMap = useMemo(() => {
    // Deterministic ordering within department: roll/enrollment/name
    const groups = new Map();
    for (const s of students) {
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
  }, [students]);

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

  const studentsWithClass = useMemo(() => {
    let computedStudents = students.map((s) => ({ ...s, __computed_class: getClassForStudent(s) }));
    if (selectedSubjectObj && selectedSubjectObj.allocated_classes && selectedSubjectObj.allocated_classes.length > 0) {
      computedStudents = computedStudents.filter(
        (s) =>
          !s.__computed_class ||
          selectedSubjectObj.allocated_classes.includes(s.__computed_class)
      );
    }
    return computedStudents;
  }, [students, classIndexMap, selectedSubjectObj]);

  const sortedStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const classFiltered =
      classFilter === 'all' || !classFilter
        ? studentsWithClass
        : studentsWithClass.filter((s) => (s.__computed_class || '') === classFilter);

    const filtered = term
      ? classFiltered.filter((s) => {
        return [s.student_name, s.roll_no, s.enrollment_no, s.student_id, s.__computed_class]
          .filter(Boolean)
          .some(value => value.toString().toLowerCase().includes(term));
      })
      : classFiltered;

    const data = [...filtered];
    if (sortOn === 'name') {
      data.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
    } else if (sortOn === 'id') {
      data.sort((a, b) => (a.student_id || '').localeCompare(b.student_id || ''));
    } else if (sortOn === 'roll') {
      data.sort((a, b) => (a.roll_no || '').toString().localeCompare((b.roll_no || '').toString()));
    } else if (sortOn === 'department') {
      data.sort((a, b) => (a.department || '').localeCompare(b.department || ''));
    }
    return data;
  }, [studentsWithClass, sortOn, searchTerm, classFilter]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const endpoint = examMode === 'external'
        ? `/external-marks/faculty/students-to-mark/${selectedExam}/${selectedSubject}`
        : `/internal-marks/faculty/students-to-mark/${selectedExam}/${selectedSubject}?exam_type=${selectedInternalExam}`;
      const res = await api.get(endpoint);
      let nextStudents = res.data || [];

      // Auto-pre-fill 100% attendance for Practical Labs if not already set
      if (examMode === 'internal' && (selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical')) {
        nextStudents = nextStudents.map(s => {
          const hasMarks = s.components?.journal || s.components?.project || s.components?.performance || s.components?.assessment;
          if (hasMarks) return s; // Don't overwrite existing

          // Random marks between 8 and 12
          const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
          const j = rnd(8, 12);
          const p = rnd(8, 12);
          const perf = rnd(8, 12);
          const a = rnd(8, 12);

          const newComponents = {
            ...(s.components || {}),
            theory_att_pct: '100',
            theory_att_marks: 6,
            prac_att_pct: '100',
            prac_att_marks: 6,
            journal: j.toString(),
            project: p.toString(),
            performance: perf.toString(),
            assessment: a.toString()
          };

          const total = 6 + 6 + j + p + perf + a;

          return { ...s, components: newComponents, marks: total.toString() };
        });
      }

      // Auto-pre-fill random marks for External Practical Labs if not already set
      if (examMode === 'external' && (selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical')) {
        nextStudents = nextStudents.map(s => {
          if (s.marks !== undefined && s.marks !== null && s.marks !== '') return s;

          // Random marks between 30 and 40
          const rndMarks = Math.floor(Math.random() * (40 - 30 + 1)) + 30;
          return { ...s, marks: rndMarks.toString(), max_marks: 40 };
        });
      }

      // Ensure every student record has a sensible `max_marks` so backend
      // validation matches frontend expectations (practical internals = 60).
      nextStudents = nextStudents.map(s => ({
        ...s,
        max_marks: parseFloat(s.max_marks) || (examMode === 'internal'
          ? (selectedInternalExam === 'practical_internal' ? 60 : getInternalMaxMarks())
          : ((selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') ? 40 : 60))
      }));

      setStudents(nextStudents);
      setEditingRows(
        Object.fromEntries(nextStudents.map((student) => [student.student_id, false]))
      );
      setHasExistingMarks(
        Object.fromEntries(
          nextStudents.map((student) => {
            const v = student.marks;
            const present = !(v === '' || v === null || v === undefined);
            return [student.student_id, present];
          })
        )
      );
      setRowDrafts({});
      setSavingRows({});
      setHasShownData(true);
    } catch (err) {
      console.error('Failed to fetch student list:', err);
      const errorText = err.response?.data?.message || err.message || 'Failed to fetch student list';
      showMessage('error', errorText);
    } finally {
      setLoading(false);
    }
  };

  const handleShow = async () => {
    if (!selectedExam) {
      showMessage('error', 'Please select an active exam session. If none appear, ask Exam Cell to activate the exam.');
      return;
    }
    if (!selectedSubject) {
      showMessage('error', 'Please select a subject.');
      return;
    }
    if (examMode === 'internal' && !selectedInternalExam) {
      showMessage('error', 'Please select an internal exam type.');
      return;
    }
    await fetchStudents();
  };

  const handleCancel = () => {
    setExamMode('internal');
    setSelectedExam(examSessions[0]?._id || '');
    setSelectedSubject('');
    setSelectedInternalExam('');
    setSortOn('name');
    setClassFilter('all');
    setStudents([]);
    setHasShownData(false);
  };

  useEffect(() => {
    if (examMode === 'internal' && (selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical')) {
      setSelectedInternalExam('practical_internal');
    } else if (selectedInternalExam === 'practical_internal') {
      setSelectedInternalExam('');
    }
  }, [selectedSubjectObj, examMode]);

  useEffect(() => {
    setSelectedInternalExam('');
    setHasShownData(false);
    setStudents([]);
  }, [examMode]);

  useEffect(() => {
    // Only re-calculate sortedStudents, do not re-fetch from backend.
  }, [classFilter]);

  const showMessage = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const getInternalMaxMarks = () => {
    if (selectedInternalExam === 'ca1' || selectedInternalExam === 'ca2') {
      return 10;
    }
    if (selectedInternalExam === 'practical_internal') {
      return 60; // Practical internals are out of 60
    }
    return 20;
  };

  const calcAttMarks = (pct) => {
    const p = parseFloat(pct);
    if (isNaN(p)) return 0;
    if (p >= 100) return 6;
    if (p > 85) return 5;
    if (p >= 71) return 4;
    if (p >= 50) return 3;
    return 2;
  };

  const handleComponentChange = (studentId, componentField, value) => {
    // Basic number validation
    if (value !== '' && isNaN(parseFloat(value))) return;

    // Domain validation for Practical Lab
    if (selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') {
      const num = parseFloat(value);
      if (componentField.endsWith('_pct') && num > 100) return;
      if (['journal', 'project', 'performance', 'assessment'].includes(componentField) && num > 12) return;
    }

    setStudents(prev => prev.map(s => {
      if (s.student_id !== studentId) return s;

      const newComponents = { ...(s.components || {}), [componentField]: value };

      // Auto-calculate attendance marks if percent changes
      if (componentField === 'theory_att_pct') {
        newComponents.theory_att_marks = calcAttMarks(value);
      }
      if (componentField === 'prac_att_pct') {
        newComponents.prac_att_marks = calcAttMarks(value);
      }

      // Calculate new total
      const total = (parseFloat(newComponents.theory_att_marks) || 0) +
        (parseFloat(newComponents.prac_att_marks) || 0) +
        (parseFloat(newComponents.journal) || 0) +
        (parseFloat(newComponents.project) || 0) +
        (parseFloat(newComponents.performance) || 0) +
        (parseFloat(newComponents.assessment) || 0);

      return { ...s, components: newComponents, marks: total.toString() };
    }));
  };

  const handleMarkAll100 = () => {
    setStudents(prev => prev.map(s => {
      if (s.is_locked || s.is_submitted_by_faculty) return s;

      const newComponents = {
        ...(s.components || {}),
        theory_att_pct: '100',
        theory_att_marks: 6,
        prac_att_pct: '100',
        prac_att_marks: 6
      };

      const total = 6 + 6 +
        (parseFloat(newComponents.journal) || 0) +
        (parseFloat(newComponents.project) || 0) +
        (parseFloat(newComponents.performance) || 0) +
        (parseFloat(newComponents.assessment) || 0);

      return { ...s, components: newComponents, marks: total.toString() };
    }));
  };

  const handleChange = (id, field, value) => {
    if (field === 'marks') {
      const numValue = parseFloat(value);
      const maxMarks = examMode === 'internal' ? getInternalMaxMarks() : ((selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') ? 40 : 60);
      if (value !== '' && !isNaN(numValue)) {
        if (numValue > maxMarks) {
          showMessage('error', `Marks cannot be greater than ${maxMarks}`);
          return;
        }
        if (numValue < 0) {
          showMessage('error', 'Marks cannot be less than 0');
          return;
        }
      }

      // Auto-update status based on marks for internal exams only when marks are entered
      // Skip status update for CA1 and CA2 as they don't have defined criteria
      if (examMode === 'internal' && value !== '' && !isNaN(numValue) && selectedInternalExam !== 'ca1' && selectedInternalExam !== 'ca2') {
        const newStatus = numValue >= 8 ? 'PASSED' : 'FAILED';
        setStudents(prev => prev.map(s => s.student_id === id ? { ...s, marks: value, status: newStatus } : s));
        return;
      }

      // If marks are empty/cleared, just update marks without changing status (allows manual status selection)
      if (examMode === 'internal' && (value === '' || isNaN(numValue))) {
        setStudents(prev => prev.map(s => s.student_id === id ? { ...s, marks: value } : s));
        return;
      }
    }
    setStudents(prev => prev.map(s => s.student_id === id ? { ...s, [field]: value } : s));
  };

  const handleEditRow = (studentId) => {
    const student = students.find((item) => item.student_id === studentId);
    if (!student || student.is_locked) return;

    const isEditing = !!editingRows[studentId];
    if (isEditing) return;

    setRowDrafts((prev) => ({
      ...prev,
      [studentId]: {
        marks: student.marks ?? '',
        status: student.status || 'PASSED',
        remarks: student.remarks || ''
      }
    }));
    setEditingRows((prev) => ({ ...prev, [studentId]: true }));
    showMessage('success', `Editing enabled for ${student.student_name}`);
  };

  const handleCancelEditRow = (studentId) => {
    const draft = rowDrafts[studentId];
    if (draft) {
      setStudents((prev) =>
        prev.map((s) =>
          s.student_id === studentId
            ? { ...s, marks: draft.marks, status: draft.status, remarks: draft.remarks }
            : s
        )
      );
    }
    setEditingRows((prev) => ({ ...prev, [studentId]: false }));
    setRowDrafts((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  };

  const saveMarkRecord = async (student) => {
    if (examMode === 'external') {
      return api.post('/external-marks/', {
        exam_id: selectedExam,
        student_id: student.student_id,
        subject_id: selectedSubject,
        marks: student.marks ?? 0,
        max_marks: student.max_marks ? parseFloat(student.max_marks) : 60,
        special_case: student.special_case || 'None'
      });
    }
    // Allow saving for ABSENT status even without marks
    const isAbsent = student.status === 'ABSENT';
    if (!isAbsent && (student.marks === '' || isNaN(student.marks))) return null;
    return api.post('/internal-marks/', {
      exam_id: selectedExam,
      student_id: student.student_id,
      subject_id: selectedSubject,
      exam_type: selectedInternalExam,
      marks: isAbsent ? 0 : parseFloat(student.marks),
      // Always send the canonical max marks for the selected internal exam type
      max_marks: getInternalMaxMarks(),
      status: student.status || 'PASSED',
      remarks: student.remarks || '',
      components: student.components || {}
    });
  };

  const handleSaveRow = async (studentId) => {
    const student = students.find((s) => s.student_id === studentId);
    if (!student || student.is_locked) return;

    const isAbsent = student.status === 'ABSENT';
    if (!isAbsent && (student.marks === '' || student.marks === null || student.marks === undefined || isNaN(student.marks))) {
      showMessage('error', 'Please enter valid marks before saving.');
      return;
    }

    setSavingRows((prev) => ({ ...prev, [studentId]: true }));
    try {
      const response = await saveMarkRecord(student);
      if (!response) {
        showMessage('error', 'Unable to save marks for this student.');
        return;
      }

      setEditingRows((prev) => ({ ...prev, [studentId]: false }));
      setRowDrafts((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      setHasExistingMarks((prev) => ({ ...prev, [studentId]: true }));
      setStudents((prev) => prev.map((s) =>
        s.student_id === studentId
          ? {
              ...s,
              marks: isAbsent ? '0' : student.marks?.toString(),
              status: student.status || 'PASSED',
              remarks: student.remarks || ''
            }
          : s
      ));

      await fetchStudents();
      showMessage('success', `Saved marks for ${student.student_name}`);
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Save failed');
    } finally {
      setSavingRows((prev) => ({ ...prev, [studentId]: false }));
      setEditingRows((prev) => ({ ...prev, [studentId]: false }));
      setRowDrafts((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  };

  const handleSaveAll = async () => {
    if (!students.length) return;
    setSavingAll(true);
    try {
      const editable = students.filter(s =>
        !s.is_locked && (
          s.status === 'ABSENT' || (s.marks !== '' && !isNaN(s.marks))
        )
      );
      if (!editable.length) {
        showMessage('error', 'No editable records with valid marks or ABSENT status to save.');
        return;
      }
      await Promise.all(editable.map(saveMarkRecord));
      await fetchStudents();
      showMessage('success', 'All marks saved successfully.');
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Save failed');
    } finally {
      setSavingAll(false);
    }
  };

  const handleSearch = () => {
    setSearchTerm(searchTerm.trim());
  };

  const handleLockAll = async () => {
    if (!students.length) return;
    if (!selectedExam || !selectedSubject) {
      showMessage('error', 'Please select an exam and subject before locking marks.');
      return;
    }

    setLockingAll(true);
    try {
      if (examMode === 'external') {
        await api.post('/external-marks/lock-subject', {
          exam_id: selectedExam,
          subject_id: selectedSubject
        });
      } else {
        await api.post('/internal-marks/lock', {
          exam_id: selectedExam,
          subject_id: selectedSubject,
          exam_type: selectedInternalExam
        });
      }
      await fetchStudents();
      showMessage('success', 'All marks locked successfully.');
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Lock failed';
      showMessage('error', message);
    } finally {
      setLockingAll(false);
    }
  };

  const handleForwardAll = async () => {
    if (!students.length) return;

    // Check if any marks are entered
    const hasAnyMarks = students.some(s => s.status === 'ABSENT' || (s.marks !== '' && !isNaN(s.marks)));
    if (!hasAnyMarks) {
      showMessage('error', 'Please enter marks before forwarding to Exam Cell.');
      return;
    }

    if (!window.confirm('Are you sure you want to forward these marks to the Exam Cell? This will lock them for further editing.')) {
      return;
    }

    setForwardingAll(true);
    try {
      await api.post('/marks-verify/forward', {
        exam_id: selectedExam,
        subject_id: selectedSubject,
        exam_type: selectedInternalExam,
        exam_mode: examMode
      });
      await fetchStudents();
      showMessage('success', 'Marks forwarded to Exam Cell successfully.');
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Forwarding failed');
    } finally {
      setForwardingAll(false);
    }
  };

  const handleExportExcel = () => {
    if (!sortedStudents.length) {
      showMessage('error', 'No data to export. Please load student records first.');
      return;
    }

    const selectedSubjectObj = subjects.find((s) => s._id === selectedSubject);
    const subjectName = selectedSubjectObj ? `${selectedSubjectObj.name} (${selectedSubjectObj.code})` : 'Unknown Subject';
    const examTypeLabel = internalExamOptions.find(opt => opt.value === selectedInternalExam)?.label || selectedInternalExam;
    const classInfo = classFilter !== 'all' ? classFilter : 'All Classes';
    const exportDate = new Date().toLocaleString('en-IN');

    const headerRows = [
      ['Subject', subjectName],
      ['Class', classInfo],
      ['Exam Type', examTypeLabel],
      ['Export Date', exportDate],
      []
    ];

    const dataHeader = [
      'SR. No',
      'Roll No',
      'Enrollment ID',
      'Student Name',
      'Department',
      'Class',
      'Obtained Marks',
      ...(selectedInternalExam === 'periodic_test_1' || selectedInternalExam === 'periodic_test_2' ? [`Calculated ${selectedInternalExam === 'periodic_test_1' ? 'CA1' : 'CA2'}`] : []),
      ...(selectedInternalExam !== 'ca1' && selectedInternalExam !== 'ca2' ? ['Status'] : []),
      'Remarks'
    ];

    const dataRows = sortedStudents.map((student, index) => [
      index + 1,
      student.roll_no || '--',
      student.enrollment_no || '--',
      student.student_name,
      getDeptKeyForStudent(student) || '--',
      student.__computed_class || '--',
      student.marks !== undefined && student.marks !== null ? student.marks : '--',
      ...(selectedInternalExam === 'periodic_test_1' || selectedInternalExam === 'periodic_test_2' ? [student.marks !== undefined && student.marks !== null ? Math.ceil((parseFloat(student.marks) * 5) / 20) : '--'] : []),
      ...(selectedInternalExam !== 'ca1' && selectedInternalExam !== 'ca2' ? [(student.marks !== undefined && student.marks !== null && student.marks !== '') ? (student.status || 'PASSED') : ''] : []),
      student.remarks || ''
    ]);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ...headerRows,
      dataHeader,
      ...dataRows
    ]);

    const columnWidths = [
      { wch: 8 },
      { wch: 12 },
      { wch: 15 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      ...(selectedInternalExam === 'periodic_test_1' || selectedInternalExam === 'periodic_test_2' ? [{ wch: 15 }] : []),
      { wch: 12 },
      { wch: 20 }
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Marks');

    // Create filename with subject and exam type
    const timestamp = new Date().toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/[/,:\s]/g, '_');
    const filename = `Marks_${selectedInternalExam}_${timestamp}.xlsx`;

    XLSX.writeFile(workbook, filename);
    showMessage('success', 'Excel file exported successfully!');
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedExam || !selectedSubject) {
      showMessage('error', 'Please select exam and subject first.');
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('exam_id', selectedExam);
    formData.append('subject_id', selectedSubject);
    if (examMode === 'internal') {
      formData.append('exam_type', selectedInternalExam);
    }

    try {
      const endpoint = examMode === 'internal'
        ? '/internal-marks/import-excel'
        : '/external-marks/import-excel';

      const res = await api.post(endpoint, formData);

      showMessage('success', res.data.message);
      if (res.data.failed_count > 0) {
        showMessage('warning', `Note: ${res.data.failed_count} records could not be matched. Check console for details.`);
        console.warn('Failed identifiers:', res.data.failed_identifiers);
      }

      // Refresh student list to show new marks
      await fetchStudents();
    } catch (err) {
      console.error('Import error:', err);
      showMessage('error', err.response?.data?.message || 'Failed to import Excel file. Please check the format.');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportExcel}
        accept=".xlsx, .xls"
        className="hidden"
        style={{ display: 'none' }}
      />
      {statusMessage && (
        <div className="fixed top-6 right-6 z-50 w-[min(420px,calc(100vw-3rem))]">
          <div
            className={`rounded-2xl p-4 text-sm shadow-lg border backdrop-blur bg-white/90 ${statusMessage.type === 'success'
                ? 'text-emerald-800 border-emerald-100'
                : 'text-rose-800 border-rose-100'
              }`}
          >
            {statusMessage.text}
          </div>
        </div>
      )}
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Internal Marks Entry</h1>
          <p className="text-slate-500">Record and manage sessional marks for your assigned subjects.</p>
        </div>
        <div className="flex items-center space-x-3 text-sm text-slate-500 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
          <BookOpen className="h-5 w-5 text-indigo-500" />
          <span className="font-medium">Academic Portal</span>
        </div>
      </div>

      {/* Control Panel */}
      <Card className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end border-b border-slate-200 pb-4">
          <div className="lg:col-span-3 flex flex-wrap gap-6">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="examMode"
                value="internal"
                checked={examMode === 'internal'}
                onChange={(e) => setExamMode(e.target.value)}
              />
              Internal Examination
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="examMode"
                value="external"
                checked={examMode === 'external'}
                onChange={(e) => setExamMode(e.target.value)}
              />
              External Examination
            </label>
          </div>
          <div className="lg:col-span-3 space-y-2">
            <label className="text-sm font-semibold text-slate-700">Exam Session</label>
            <select
              value={selectedExam}
              onChange={e => setSelectedExam(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="">-- Select Session --</option>
              {examSessions.map(exam => (
                <option key={exam._id} value={exam._id}>
                  {exam.name} {exam.status ? `(${exam.status})` : ''}
                </option>
              ))}
            </select>
          </div>
          {!((examMode === 'internal' || examMode === 'external') && (selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical')) && (
            <div className="lg:col-span-3 space-y-2">
              <label className="text-sm font-semibold text-slate-700">{examMode === 'external' ? 'Exam Type' : 'Internal Exam Type'}</label>
              <select
                value={selectedInternalExam}
                onChange={e => setSelectedInternalExam(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              >
                <option value="">-- Select Exam --</option>
                {examTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="lg:col-span-3 flex gap-3 justify-start lg:justify-end">
            <Button className="px-7 py-2.5" onClick={handleShow}>Show</Button>
            <Button variant="danger" className="px-7 py-2.5" onClick={handleCancel}>Cancel</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-6 border-b border-slate-100 pb-6">
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Assign Subject</label>
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

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Class</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="all">All Classes</option>
              {classOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sort</label>
            <select
              value={sortOn}
              onChange={(e) => setSortOn(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="name">Name</option>
              <option value="roll">Roll No</option>
              <option value="id">ID</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Save</label>
            <Button onClick={handleSaveAll} disabled={!hasShownData || loading || savingAll || lockingAll || !students.length} className="w-full py-2.5">
              {savingAll ? 'Saving...' : 'Save All'}
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lock</label>
            <Button variant="secondary" onClick={handleLockAll} disabled={!hasShownData || loading || savingAll || lockingAll || !students.length} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
              {lockingAll ? 'Locking...' : 'Lock All'}
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Data</label>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={!hasShownData || loading || importing} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white border-0">
                <Upload className="h-4 w-4" />
              </Button>
              <Button variant="secondary" onClick={handleExportExcel} disabled={!hasShownData || loading || !sortedStudents.length} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white border-0">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Grid Card */}
      <Card className="overflow-hidden border-slate-100 shadow-xl shadow-slate-100/50">
        {!hasShownData ? (
          <div className="p-20 text-center">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Filter className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-900 font-bold">Selection Required</h3>
            <p className="text-slate-400 text-sm max-w-xs mx-auto mt-2">Select examination type, exam, and subject, then click Show to begin recording marks.</p>
          </div>
        ) : loading ? (
          <div className="p-20 text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-600 mb-4" />
            <p className="text-slate-500 font-medium">Fetching student records...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 px-4 py-4">
              <div>
                <p className="text-sm text-slate-500">Showing {sortedStudents.length} of {studentsWithClass.length} students</p>
                <p className="text-xs text-slate-400 mt-1">Fill marks normally, and use Edit only when a saved entry needs correction.</p>
              </div>
              <div className="flex w-full md:w-auto gap-2 flex-col sm:flex-row">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, roll, enrollment..."
                  className="w-full md:w-80 pl-4 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
                <Button onClick={handleSearch} className="px-4 py-2.5">Search</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  {(selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') && examMode !== 'external' ? (
                    <>
                      <tr>
                        <th rowSpan="2" className="w-12 px-2 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px] border-r border-slate-100">SR.</th>
                        <th rowSpan="2" className="w-24 px-4 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px] border-r border-slate-100">Roll No.</th>
                        <th rowSpan="2" className="w-36 px-4 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px] border-r border-slate-100">Enrollment ID</th>
                        <th rowSpan="2" className="min-w-[200px] px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px] border-r border-slate-100">Student Name</th>
                        <th colSpan="2" className="px-2 py-2 text-center font-bold text-slate-500 uppercase tracking-widest text-[9px] border-r border-slate-100 bg-violet-50/30">
                          (1) Theory Att (6 marks)
                        </th>
                        <th colSpan="2" className="px-2 py-2 text-center font-bold text-slate-500 uppercase tracking-widest text-[9px] border-r border-slate-100 bg-emerald-50/30">
                          (2) Practical Att (6 marks)
                        </th>
                        <th rowSpan="2" className="w-24 px-2 py-2 text-center font-bold text-slate-500 uppercase tracking-widest text-[9px] border-r border-slate-100 bg-amber-50/30">(3) Journal (12 marks)</th>
                        <th rowSpan="2" className="w-24 px-2 py-2 text-center font-bold text-slate-500 uppercase tracking-widest text-[9px] border-r border-slate-100 bg-amber-50/30">(3) Project (12 marks)</th>
                        <th rowSpan="2" className="w-24 px-2 py-2 text-center font-bold text-slate-500 uppercase tracking-widest text-[9px] border-r border-slate-100 bg-blue-50/30">(4) Prac Perf (12 marks)</th>
                        <th rowSpan="2" className="w-24 px-2 py-2 text-center font-bold text-slate-500 uppercase tracking-widest text-[9px] border-r border-slate-100 bg-rose-50/30">(5) Teach Assess (12 marks)</th>
                        <th rowSpan="2" className="w-28 px-6 py-4 text-center font-bold text-slate-600 uppercase tracking-widest text-[10px] bg-slate-100/80">Total (60 marks)</th>
                        <th rowSpan="2" className="w-24 px-6 py-4 text-center font-bold text-slate-400 uppercase tracking-widest text-[10px]">Action</th>
                      </tr>
                      <tr className="bg-slate-50/20">
                        <th className="w-20 px-1 py-2 text-center font-bold text-slate-400 uppercase tracking-widest text-[8px] border-r border-slate-100">% Att</th>
                        <th className="w-16 px-1 py-2 text-center font-bold text-slate-400 uppercase tracking-widest text-[8px] border-r border-slate-100">Marks</th>
                        <th className="w-20 px-1 py-2 text-center font-bold text-slate-400 uppercase tracking-widest text-[8px] border-r border-slate-100">% Att</th>
                        <th className="w-16 px-1 py-2 text-center font-bold text-slate-400 uppercase tracking-widest text-[8px] border-r border-slate-100">Marks</th>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px]">SR.</th>
                      <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px]">Roll No.</th>
                      <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px]">Enrollment ID</th>
                      <th className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-widest text-[10px]">Student Name</th>
                      <th className="px-6 py-4 text-center font-bold text-slate-400 uppercase tracking-widest text-[10px]">
                        Obtained Marks ({examMode === 'external' && (selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') ? 40 : 60})
                      </th>
                      {(selectedInternalExam === 'periodic_test_1' || selectedInternalExam === 'periodic_test_2') && (
                        <th className="px-6 py-4 text-center font-bold text-slate-400 uppercase tracking-widest text-[10px]">
                          Calculated {selectedInternalExam === 'periodic_test_1' ? 'CA1' : 'CA2'}
                        </th>
                      )}
                      {selectedInternalExam !== 'ca1' && selectedInternalExam !== 'ca2' && (
                        <th className="px-6 py-4 text-center font-bold text-slate-400 uppercase tracking-widest text-[10px]">Status</th>
                      )}
                      <th className="px-6 py-4 text-center font-bold text-slate-400 uppercase tracking-widest text-[10px]">Action</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedStudents.map((s, idx) => (
                    <tr
                      key={s.student_id}
                      className={`group transition-colors ${s.is_locked || s.is_submitted_by_faculty
                          ? 'bg-green-50/10 cursor-not-allowed'
                          : editingRows[s.student_id]
                            ? 'bg-amber-50/60 ring-1 ring-amber-200'
                            : 'hover:bg-indigo-50/20'
                        }`}
                    >
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs border-r border-slate-100">{idx + 1}</td>
                      <td className="px-6 py-4 text-slate-800 font-semibold border-r border-slate-100">{s.roll_no || '--'}</td>
                      <td className="px-6 py-4 text-slate-800 font-semibold border-r border-slate-100">{s.enrollment_no || '--'}</td>
                      <td className="px-6 py-4 text-slate-800 font-semibold border-r border-slate-100">{s.student_name}</td>

                      {(selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') && examMode !== 'external' ? (
                        <>
                          <td className="p-1 border-r border-slate-100 bg-violet-50/10">
                            <input
                              type="text"
                              placeholder="%"
                              value={s.components?.theory_att_pct || ''}
                              onChange={e => handleComponentChange(s.student_id, 'theory_att_pct', e.target.value)}
                              disabled={s.is_locked}
                              className="w-full h-10 text-center bg-white/50 border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg transition-all outline-none font-bold text-slate-700 shadow-inner px-0"
                            />
                          </td>
                          <td className="p-1 border-r border-slate-100 bg-violet-50/30 text-center font-black text-violet-700 text-base">
                            {s.components?.theory_att_marks || 0}
                          </td>
                          <td className="p-1 border-r border-slate-100 bg-emerald-50/10">
                            <input
                              type="text"
                              placeholder="%"
                              value={s.components?.prac_att_pct || ''}
                              onChange={e => handleComponentChange(s.student_id, 'prac_att_pct', e.target.value)}
                              disabled={s.is_locked}
                              className="w-full h-10 text-center bg-white/50 border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg transition-all outline-none font-bold text-slate-700 shadow-inner px-0"
                            />
                          </td>
                          <td className="p-1 border-r border-slate-100 bg-emerald-50/30 text-center font-black text-emerald-700 text-base">
                            {s.components?.prac_att_marks || 0}
                          </td>
                          <td className="p-1 border-r border-slate-100 bg-amber-50/10">
                            <input
                              type="number"
                              value={s.components?.journal || ''}
                              onChange={e => handleComponentChange(s.student_id, 'journal', e.target.value)}
                              disabled={s.is_locked}
                              className="w-full h-10 text-center bg-white/50 border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg transition-all outline-none font-bold text-slate-700 shadow-inner"
                            />
                          </td>
                          <td className="p-1 border-r border-slate-100 bg-amber-50/10">
                            <input
                              type="number"
                              value={s.components?.project || ''}
                              onChange={e => handleComponentChange(s.student_id, 'project', e.target.value)}
                              disabled={s.is_locked}
                              className="w-full h-10 text-center bg-white/50 border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg transition-all outline-none font-bold text-slate-700 shadow-inner"
                            />
                          </td>
                          <td className="p-1 border-r border-slate-100 bg-blue-50/10">
                            <input
                              type="number"
                              value={s.components?.performance || ''}
                              onChange={e => handleComponentChange(s.student_id, 'performance', e.target.value)}
                              disabled={s.is_locked}
                              className="w-full h-10 text-center bg-white/50 border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg transition-all outline-none font-bold text-slate-700 shadow-inner"
                            />
                          </td>
                          <td className="p-1 border-r border-slate-100 bg-rose-50/10">
                            <input
                              type="number"
                              value={s.components?.assessment || ''}
                              onChange={e => handleComponentChange(s.student_id, 'assessment', e.target.value)}
                              disabled={s.is_locked}
                              className="w-full h-10 text-center bg-white/50 border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg transition-all outline-none font-bold text-slate-700 shadow-inner"
                            />
                          </td>
                          <td className="px-6 py-4 text-center font-black text-slate-900 bg-slate-100/50 border-r border-slate-100">
                            {s.marks || 0}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              {s.is_locked || s.is_submitted_by_faculty ? (
                                <span className="w-20 inline-block text-center text-slate-900 font-bold">{s.marks !== undefined && s.marks !== null ? s.marks : '--'}</span>
                              ) : (
                                <input
                                  type="number"
                                  value={s.marks ?? ''}
                                  onChange={e => handleChange(s.student_id, 'marks', e.target.value)}
                                  disabled={(!editingRows[s.student_id] && !!hasExistingMarks[s.student_id]) || (s.status === 'ABSENT' && !editingRows[s.student_id]) || s.is_submitted_by_faculty}
                                  min="0"
                                  max={examMode === 'internal' ? getInternalMaxMarks() : ((selectedSubjectObj?.type === 'Practical Lab' || selectedSubjectObj?.type === 'Practical') ? 40 : 60)}
                                  step="1"
                                  className={`w-20 text-center h-10 rounded-xl font-bold border focus:bg-white focus:border-slate-700 focus:ring-2 ${s.status === 'ABSENT' && !editingRows[s.student_id]
                                      ? 'bg-red-50 border-red-300'
                                      : editingRows[s.student_id]
                                        ? 'bg-slate-50 border-amber-400 focus:ring-amber-200'
                                        : 'bg-slate-50 border-slate-400 focus:ring-slate-200'
                                    }`}
                                />
                              )}
                            </div>
                          </td>
                          {(selectedInternalExam === 'periodic_test_1' || selectedInternalExam === 'periodic_test_2') && (
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <span className="w-20 inline-block text-center text-indigo-600 font-black text-base">
                                  {s.marks !== undefined && s.marks !== null && s.marks !== ''
                                    ? Math.ceil((parseFloat(s.marks) * 5) / 20)
                                    : '--'}
                                </span>
                              </div>
                            </td>
                          )}
                          {selectedInternalExam !== 'ca1' && selectedInternalExam !== 'ca2' && (
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                {s.is_locked || s.is_submitted_by_faculty || (examMode === 'external' && s.is_verified) ? (
                                  <span className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-700">
                                    {examMode === 'external' ? (s.special_case || 'None') : (s.status || 'PASSED')}
                                  </span>
                                ) : (
                                  <select
                                    value={examMode === 'external' ? (s.special_case || 'None') : (s.status || 'PASSED')}
                                    onChange={e => handleChange(s.student_id, examMode === 'external' ? 'special_case' : 'status', e.target.value)}
                                    disabled={examMode === 'internal' && (s.marks !== '' && s.marks !== null && s.marks !== undefined) || (examMode === 'external' && !editingRows[s.student_id] && !!hasExistingMarks[s.student_id])}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest outline-none bg-slate-50 border focus:bg-white ${(examMode === 'internal' && (s.marks === '' || s.marks === null || s.marks === undefined)) || (editingRows[s.student_id] && examMode === 'external')
                                        ? 'border-amber-300 hover:border-amber-400'
                                        : 'border-slate-200 hover:border-slate-300'
                                      }`}
                                  >
                                    {examMode === 'external' ? (
                                      <>
                                        <option value="None">None</option>
                                        <option value="Absent">Absent</option>
                                        <option value="Malpractice">Malpractice</option>
                                        <option value="Withheld">Withheld</option>
                                      </>
                                    ) : (
                                      <>
                                        <option value="PASSED">Passed</option>
                                        <option value="FAILED">Failed</option>
                                        <option value="ABSENT">Absent</option>
                                      </>
                                    )}
                                  </select>
                                )}
                              </div>
                            </td>
                          )}
                        </>
                      )}

                      <td className="px-6 py-4 text-center space-y-2">
                        {s.is_locked || s.is_submitted_by_faculty || (examMode === 'external' && s.is_verified) ? (
                          <span className="text-[10px] uppercase text-green-600 font-bold">
                            {s.is_submitted_by_faculty ? 'Forwarded' : (examMode === 'external' && s.is_verified ? 'Verified' : 'Locked')}
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            {editingRows[s.student_id] ? (
                              <>
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
                                  Editing
                                </span>
                                <Button
                                  onClick={() => handleSaveRow(s.student_id)}
                                  disabled={!!savingRows[s.student_id]}
                                  className="px-3 py-2"
                                >
                                  {savingRows[s.student_id] ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => handleCancelEditRow(s.student_id)}
                                  disabled={!!savingRows[s.student_id]}
                                  className="px-3 py-2"
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button onClick={() => handleEditRow(s.student_id)} className="px-3 py-2">
                                Edit
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Info Alert */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex gap-4">
        <AlertCircle className="w-6 h-6 text-indigo-500 shrink-0" />
        <div className="text-sm text-indigo-800">
          <p className="font-bold mb-0.5 uppercase tracking-tight">Real-time Visibility</p>
          <p className="opacity-80 font-medium">Entered marks are saved and become visible to students on their dashboard immediately. The Exam Cell will lock these marks later for official record padding.</p>
        </div>
      </div>
    </div>
  );
}
