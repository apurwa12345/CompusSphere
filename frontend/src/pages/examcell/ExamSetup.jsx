import React, { useMemo, useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertTriangle, CalendarClock, Save } from 'lucide-react';
import api from '../../services/api';

const EXAM_TYPES = ['End Semester', 'Supplementary', 'Backlogs'];
const STATUSES = ['Draft', 'Upcoming', 'Ongoing', 'Completed', 'Results Declared'];

const statusColors = {
  Draft: 'bg-slate-100 text-slate-600',
  Upcoming: 'bg-blue-100 text-blue-700',
  Ongoing: 'bg-yellow-100 text-yellow-700',
  Completed: 'bg-green-100 text-green-700',
  'Results Declared': 'bg-purple-100 text-purple-700',
};

export default function ExamSetup() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editExam, setEditExam] = useState(null);
  const [form, setForm] = useState({ name: '', exam_type: 'End Semester', semester: 1, start_date: '', end_date: '', department_id: 'ALL' });
  const [filterType, setFilterType] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [timetableOpen, setTimetableOpen] = useState(false);
  const [timetableSaving, setTimetableSaving] = useState(false);
  const [timetableExam, setTimetableExam] = useState(null);
  const [timetableExisting, setTimetableExisting] = useState([]);
  const [timetableDraft, setTimetableDraft] = useState({}); // subject_id -> { date, start_time, end_time }
  const [openTimetableAfterCreate, setOpenTimetableAfterCreate] = useState(true);
  const [classGroups, setClassGroups] = useState('A,B'); // comma-separated groups/classes

  const fetchExams = async () => {
    setLoading(true);
    try {
      const params = filterType ? `?type=${filterType}` : '';
      const res = await api.get(`/exam-setup/${params}`);
      setExams(res.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchExams(); }, [filterType]);

  useEffect(() => {
    let mounted = true;
    setSubjectsLoading(true);
    api.get('/academic/subjects')
      .then(r => { if (mounted) setSubjects(r.data || []); })
      .catch(console.error)
      .finally(() => { if (mounted) setSubjectsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const ensureSubjectsLoaded = async () => {
    if (!subjectsLoading && (subjects || []).length > 0) return;
    setSubjectsLoading(true);
    try {
      const r = await api.get('/academic/subjects');
      setSubjects(r.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSubjectsLoading(false);
    }
  };

  const openCreate = () => { setEditExam(null); setForm({ name: '', exam_type: 'End Semester', semester: 1, start_date: '', end_date: '', department_id: 'ALL' }); setShowModal(true); };
  const openEdit = (exam) => { setEditExam(exam); setForm({ name: exam.name, exam_type: exam.exam_type, semester: exam.semester, start_date: exam.start_date || '', end_date: exam.end_date || '', department_id: exam.department_id || 'ALL' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editExam) {
        await api.put(`/exam-setup/${editExam._id}`, form);
        setShowModal(false);
        fetchExams();
      } else {
        const res = await api.post('/exam-setup/', form);
        setShowModal(false);
        fetchExams();
        if (openTimetableAfterCreate && res?.data?.id) {
          // Immediately open timetable setup for the newly created exam
          const createdExam = {
            _id: res.data.id,
            name: form.name,
            exam_type: form.exam_type,
            semester: form.semester,
            start_date: form.start_date,
            end_date: form.end_date,
            status: 'Draft',
            timetable: [],
          };
          openTimetable(createdExam);
        }
      }
    } catch (err) { alert(err.response?.data?.message || 'Error saving exam'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this exam?')) return;
    try { await api.delete(`/exam-setup/${id}`); fetchExams(); }
    catch (err) { alert(err.response?.data?.message || 'Cannot delete'); }
  };

  const handleStatusChange = async (id, status) => {
    try { await api.patch(`/exam-setup/${id}/status`, { status }); fetchExams(); }
    catch (err) { alert('Failed to update status'); }
  };

  const semSubjects = useMemo(() => {
    const bySem = {};
    for (const s of subjects || []) {
      const sem = s?.semester;
      const semKey = sem === undefined || sem === null || sem === '' ? 'NA' : String(parseInt(sem));
      if (!bySem[semKey]) bySem[semKey] = [];
      bySem[semKey].push(s);
    }
    return bySem;
  }, [subjects]);

  const normalizeSubjectSemester = (sem) => {
    if (sem === undefined || sem === null || sem === '') return 'NA';
    const n = parseInt(sem);
    return Number.isFinite(n) ? String(n) : String(sem);
  };

  const subjectsForExam = (examSemester) => {
    const semKey = normalizeSubjectSemester(examSemester);
    const semList = semSubjects[semKey] || [];
    const noSemList = semSubjects.NA || [];
    const merged = [...semList, ...noSemList];
    const seen = new Set();
    return merged.filter((s) => {
      const id = String(s?._id || '');
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const parsedGroups = useMemo(() => {
    const groups = (classGroups || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    return groups.length > 0 ? groups : ['A', 'B'];
  }, [classGroups]);

  const draftKey = (subjectId, group) => `${subjectId}__${group || ''}`;

  const openTimetable = async (exam) => {
    setTimetableExam(exam);
    setTimetableOpen(true);
    setTimetableSaving(false);
    // If modal is opened right after creating exam, subjects may not be loaded yet.
    if ((subjects || []).length === 0) {
      await ensureSubjectsLoaded();
    }
    try {
      const r = await api.get(`/timetable/${exam._id}`);
      const existing = r.data || [];
      setTimetableExisting(existing);
      const draft = {};
      for (const entry of existing) {
        if (!entry?.subject_id) continue;
        const g = (entry.class_value || '').trim();
        draft[draftKey(entry.subject_id, g)] = {
          date: entry.date || '',
          start_time: entry.start_time || '10:00',
          end_time: entry.end_time || '13:00',
        };
      }
      // prefill missing subjects with defaults
      for (const s of subjectsForExam(exam?.semester)) {
        for (const g of parsedGroups) {
          const k = draftKey(s._id, g);
          if (!draft[k]) draft[k] = { date: '', start_time: '10:00', end_time: '13:00' };
        }
      }
      setTimetableDraft(draft);
    } catch (e) {
      console.error(e);
      setTimetableExisting([]);
      setTimetableDraft({});
    }
  };

  const saveTimetable = async () => {
    if (!timetableExam?._id) return;
    const subs = subjectsForExam(timetableExam?.semester);
    if (subs.length === 0) {
      alert('No subjects found for this semester. Please add subjects first.');
      return;
    }

    const missing = [];
    for (const s of subs) {
      for (const g of parsedGroups) {
        const k = draftKey(s._id, g);
        if (!(timetableDraft?.[k]?.date)) missing.push(`${s.name} (${g})`);
      }
    }
    if (missing.length > 0) {
      alert('Please set the date for all subjects (and all selected classes/groups) before saving.');
      return;
    }

    const existingBySubjectGroup = new Map(
      (timetableExisting || []).map(e => [draftKey(String(e.subject_id), (e.class_value || '').trim()), e])
    );
    setTimetableSaving(true);
    try {
      const calls = [];
      for (const s of subs) {
        for (const g of parsedGroups) {
          const k = draftKey(s._id, g);
          const row = timetableDraft[k] || {};
          const payload = {
            date: row.date,
            start_time: row.start_time || '10:00',
            end_time: row.end_time || '13:00',
            room: '',
            class_value: g,
          };
          const existing = existingBySubjectGroup.get(k);
          if (existing?._id) calls.push(api.put(`/timetable/${existing._id}`, payload));
          else calls.push(api.post('/timetable/', { exam_id: timetableExam._id, subject_id: s._id, ...payload }));
        }
      }
      await Promise.all(calls);
      const r = await api.get(`/timetable/${timetableExam._id}`);
      setTimetableExisting(r.data || []);
      alert('Timetable saved successfully.');
      setTimetableOpen(false);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to save timetable');
    } finally {
      setTimetableSaving(false);
    }
  };

  const pendingTimetableExams = useMemo(() => {
    const upcoming = (exams || []).filter(e => (e.status === 'Draft' || e.status === 'Upcoming'));
    return upcoming.filter(e => {
      const subs = subjectsForExam(e?.semester);
      if (subs.length === 0) return false;
      // if timetable array in exam doc is empty, it is definitely pending
      const countHint = Array.isArray(e.timetable) ? e.timetable.length : 0;
      return countHint < subs.length;
    });
  }, [exams, semSubjects]);

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exam Setup</h1>
          <p className="text-slate-500 text-sm mt-1">Create and manage exam sessions</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Exam Session
        </button>
      </div>

      {/* Big alert: Timetable not set */}
      {pendingTimetableExams.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-amber-700">Action Required</div>
                <h2 className="text-lg font-bold text-slate-900 mt-1">Set up exam timetable (date & time for every paper)</h2>
                <p className="text-sm text-slate-600 mt-1">
                  {pendingTimetableExams.length} exam session(s) are missing a complete subject-wise schedule. Students can only see the timetable after you set it.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="h-10 rounded-xl border border-amber-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 min-w-[240px]"
                defaultValue=""
                onChange={(e) => {
                  const ex = pendingTimetableExams.find(x => x._id === e.target.value);
                  if (ex) openTimetable(ex);
                  e.target.value = '';
                }}
              >
                <option value="">Select exam to setup…</option>
                {pendingTimetableExams.map(e => (
                  <option key={e._id} value={e._id}>{e.name} (Sem {e.semester})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterType('')} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!filterType ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>All</button>
        {EXAM_TYPES.map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterType === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>{t}</button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : exams.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No exams found. Create one to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Exam Name', 'Type', 'Semester', 'Start', 'End', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exams.map(exam => (
                <tr key={exam._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{exam.name}</td>
                  <td className="px-4 py-3 text-slate-600">{exam.exam_type}</td>
                  <td className="px-4 py-3 text-slate-600">Sem {exam.semester}</td>
                  <td className="px-4 py-3 text-slate-500">{exam.start_date || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{exam.end_date || '—'}</td>
                  <td className="px-4 py-3">
                    <select value={exam.status} onChange={e => handleStatusChange(exam._id, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-violet-500 ${statusColors[exam.status] || 'bg-slate-100'}`}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => openTimetable(exam)}
                        title="Setup timetable"
                        className="text-slate-500 hover:text-amber-700 transition-colors"
                      >
                        <CalendarClock className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(exam)} className="text-slate-500 hover:text-violet-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(exam._id)} className="text-slate-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Timetable setup modal */}
      {timetableOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl p-6 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-amber-700">Exam Timetable Setup</div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{timetableExam?.name}</h2>
                <p className="text-sm text-slate-500 mt-1">Set date & time for every subject paper (Semester {timetableExam?.semester}).</p>
              </div>
              <button
                onClick={() => !timetableSaving && setTimetableOpen(false)}
                className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                disabled={timetableSaving}
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">Important</div>
                  <div className="text-sm text-slate-600 mt-0.5">
                    Students will see this timetable in their dashboard’s <span className="font-semibold">Exam</span> section. Please fill the schedule for all subjects before publishing.
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-700 mb-1">Classes / Groups (comma separated)</div>
                      <input
                        value={classGroups}
                        onChange={(e) => setClassGroups(e.target.value)}
                        className="h-10 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                        placeholder="e.g. A,B"
                      />
                      <div className="text-[11px] text-slate-600 mt-1">
                        Example: <span className="font-semibold">A</span> (10–1) and <span className="font-semibold">B</span> (2–5).
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    {['Subject', 'Code', 'Credits', 'Type', 'Class/Group', 'Date', 'Start', 'End'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjectsForExam(timetableExam?.semester).flatMap((s) => (
                    parsedGroups.map((g) => {
                      const k = draftKey(s._id, g);
                      const row = timetableDraft?.[k] || { date: '', start_time: '10:00', end_time: '13:00' };
                      return (
                        <tr key={k} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.code}</td>
                          <td className="px-4 py-3 text-slate-600">{s.credits ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{s.type || s.subject_type || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{g}</span>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => setTimetableDraft((prev) => ({ ...prev, [k]: { ...row, date: e.target.value } }))}
                              className="h-9 rounded-lg border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                              required
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="time"
                              value={row.start_time || '10:00'}
                              onChange={(e) => setTimetableDraft((prev) => ({ ...prev, [k]: { ...row, start_time: e.target.value } }))}
                              className="h-9 rounded-lg border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="time"
                              value={row.end_time || '13:00'}
                              onChange={(e) => setTimetableDraft((prev) => ({ ...prev, [k]: { ...row, end_time: e.target.value } }))}
                              className="h-9 rounded-lg border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                            />
                          </td>
                        </tr>
                      );
                    })
                  ))}
                  {subjectsLoading && subjects.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-500" colSpan={8}>
                        Loading subjects…
                      </td>
                    </tr>
                  ) : subjectsForExam(timetableExam?.semester).length === 0 && (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-500" colSpan={8}>
                        No subjects found for Semester {timetableExam?.semester}. Please add subjects in Academic → Subjects.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={timetableSaving}
                onClick={() => setTimetableOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={timetableSaving}
                onClick={saveTimetable}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {timetableSaving ? 'Saving…' : 'Save Timetable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">{editExam ? 'Edit Exam Session' : 'Create Exam Session'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <CalendarClock className="w-5 h-5 text-amber-700" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-black uppercase tracking-widest text-amber-700">Next Step</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">Set date & time for each subject paper</div>
                    <div className="text-xs text-slate-600 mt-1">
                      This timetable will be visible to students in their <span className="font-semibold">Exam</span> section.
                    </div>
                    {editExam ? (
                      <button
                        type="button"
                        onClick={() => openTimetable(editExam)}
                        className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
                      >
                        <CalendarClock className="w-4 h-4" /> Setup / Edit Timetable
                      </button>
                    ) : (
                      <label className="mt-3 flex items-center gap-2 text-xs text-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={openTimetableAfterCreate}
                          onChange={(e) => setOpenTimetableAfterCreate(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        Open timetable setup immediately after creating this exam
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Exam Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="e.g. End Semester - Dec 2025" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                  <select value={form.exam_type} onChange={e => setForm({ ...form, exam_type: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Semester *</label>
                  <input type="number" min={1} max={8} value={form.semester} onChange={e => setForm({ ...form, semester: parseInt(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors">{editExam ? 'Save Changes' : 'Create Exam'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
