import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { UserCheck, BookOpen, ArrowRight, Table as TableIcon, CheckCircle2, Pencil, Trash2, Search, GraduationCap } from 'lucide-react';
import api from '../../services/api';

const initialSelection = {
    faculty_id: '',
    subject_id: '',
    classValue: '',
    fyFilter: '',
    semester: ''
};

const Allocation = () => {
    const [faculties, setFaculties] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [courses, setCourses] = useState([]);
    const [allocations, setAllocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selection, setSelection] = useState(initialSelection);
    const [editingAllocation, setEditingAllocation] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [status, setStatus] = useState(null);

    const parseSemester = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        const i = Math.trunc(n);
        return i > 0 ? i : null;
    };

    const parseFyFromClassValue = (classValue) => {
        if (!classValue) return null;
        const match = String(classValue).match(/FY\s*(\d+)/i);
        if (!match) return null;
        const n = Number(match[1]);
        return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
    };

    const fyFromSemester = (semester) => {
        const sem = parseSemester(semester);
        if (!sem) return '';
        return String(Math.max(1, Math.min(4, Math.floor((sem - 1) / 2) + 1)));
    };

    const semestersForFy = (fy) => {
        const n = parseSemester(fy);
        // Allocation currently supports semesters 1..8. If FY isn't 1..4 (e.g. FY 5..7),
        // fall back to showing all semesters so the UI stays usable.
        if (!n || n < 1 || n > 4) return [1, 2, 3, 4, 5, 6, 7, 8];
        const start = (n - 1) * 2 + 1;
        return [start, start + 1].filter((x) => x >= 1 && x <= 8);
    };

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

    const classOptions = useMemo(() => {
        return Object.entries(CLASS_DIVISION)
            .sort((a, b) => a[1].fy - b[1].fy)
            .flatMap(([deptKey, cfg]) => {
                const sizes = computeSectionSizes(deptKey);
                return sizes.map((_sz, i) => {
                    const letter = String.fromCharCode('A'.charCodeAt(0) + i);
                    const value = `FY ${cfg.fy} ${letter}`;
                    const label = `${value} (${deptKey})`;
                    return { value, label, fy: cfg.fy, deptKey };
                });
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const defaultClassValueForFy = (fy) => {
        const n = parseSemester(fy);
        if (!n) return '';
        const match = classOptions.find((o) => o.fy === n);
        return match?.value || `FY ${n} A`;
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const [facRes, subRes, courseRes, allocRes] = await Promise.all([
                api.get('/academic/faculties'),
                api.get('/academic/subjects'),
                api.get('/academic/courses'),
                api.get('/academic/allocations')
            ]);
            setFaculties(facRes.data || []);
            setSubjects(subRes.data || []);
            setCourses(courseRes.data || []);
            setAllocations(allocRes.data || []);
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: 'Failed to load allocation data.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!status) return undefined;
        const timer = setTimeout(() => setStatus(null), 3000);
        return () => clearTimeout(timer);
    }, [status]);

    const getFacultyLabel = (facultyId) => {
        const faculty = faculties.find(f => f._id === facultyId);
        return faculty ? `${faculty.name} (${faculty.employee_id || 'No ID'})` : 'Unknown faculty';
    };

    const getSubjectById = (subjectId) => subjects.find(s => s._id === subjectId);

    const getCourseName = (courseId) => {
        const course = courses.find(c => c._id === courseId);
        return course?.name || course?.code || '';
    };

    const getClassLabel = (allocation) => {
        const cVal = allocation.class_value || allocation.classValue;
        if (cVal) {
            const match = classOptions.find((o) => o.value === cVal);
            return match ? match.label : cVal;
        }
        const subject = getSubjectById(allocation.subject_id);
        const courseName = subject?.course_id ? getCourseName(subject.course_id) : '';
        const semester = subject?.semester || allocation.semester;
        if (courseName && semester) return `${courseName} - Semester ${semester}`;
        if (courseName) return courseName;
        if (semester) return `Semester ${semester}`;
        return 'Not specified';
    };

    const getSubjectLabel = (subjectId) => {
        const subject = getSubjectById(subjectId);
        return subject ? `${subject.name} (${subject.code || 'No code'})` : 'Unknown subject';
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        if (!selection.faculty_id || !selection.subject_id || !selection.classValue || !selection.semester) {
            setStatus({ type: 'error', message: 'Please select class (FY), faculty, subject, and semester.' });
            return;
        }

        try {
            await api.post('/academic/allocate-faculty', {
                faculty_id: selection.faculty_id,
                subject_id: selection.subject_id,
                semester: selection.semester,
                classValue: selection.classValue
            });
            setStatus({ type: 'success', message: 'Faculty allocated successfully.' });
            setSelection((cur) => ({ ...cur, faculty_id: '', subject_id: '', classValue: '', semester: '' }));
            fetchData();
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: error.response?.data?.message || 'Assignment failed' });
        }
    };

    const openEditModal = (allocation) => {
        const fy = fyFromSemester(allocation.semester);
        setEditingAllocation({
            _id: allocation._id,
            faculty_id: allocation.faculty_id,
            subject_id: allocation.subject_id,
            classValue: allocation.class_value || allocation.classValue || defaultClassValueForFy(fy),
            semester: String(allocation.semester || '')
        });
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setEditingAllocation(null);
        setIsEditModalOpen(false);
    };

    const handleUpdateAllocation = async (e) => {
        e.preventDefault();
        if (!editingAllocation?.faculty_id || !editingAllocation?.subject_id || !editingAllocation?.classValue || !editingAllocation?.semester) {
            setStatus({ type: 'error', message: 'Please complete all fields before saving.' });
            return;
        }

        try {
            await api.put(`/academic/allocations/${editingAllocation._id}`, {
                faculty_id: editingAllocation.faculty_id,
                subject_id: editingAllocation.subject_id,
                semester: editingAllocation.semester,
                classValue: editingAllocation.classValue
            });
            setStatus({ type: 'success', message: 'Allocation updated successfully.' });
            closeEditModal();
            fetchData();
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: error.response?.data?.message || 'Failed to update allocation.' });
        }
    };

    const handleDeleteAllocation = async (allocationId) => {
        const confirmed = window.confirm('Delete this faculty allocation?');
        if (!confirmed) return;

        try {
            await api.delete(`/academic/allocations/${allocationId}`);
            setStatus({ type: 'success', message: 'Allocation deleted successfully.' });
            fetchData();
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: error.response?.data?.message || 'Failed to delete allocation.' });
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const filteredAllocations = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const classFilter = selection.fyFilter?.trim() || '';

        const classFiltered = !classFilter
            ? allocations
            : allocations.filter((a) => {
                const assignedClass = a.class_value || a.classValue || '';
                return assignedClass === classFilter;
            });

        if (!query) return classFiltered;

        return classFiltered.filter(allocation => {
            const faculty = getFacultyLabel(allocation.faculty_id).toLowerCase();
            const subject = getSubjectLabel(allocation.subject_id).toLowerCase();
            const classLabel = getClassLabel(allocation).toLowerCase();
            const semesterLabel = `semester ${allocation.semester}`.toLowerCase();
            return [faculty, subject, classLabel, semesterLabel].some(value => value.includes(query));
        });
    }, [allocations, searchTerm, faculties, subjects, courses, selection.fyFilter]);

    const columns = [
        {
            header: 'Faculty',
            cell: (row) => (
                <div className="min-w-[220px]">
                    <p className="text-sm font-bold text-slate-800">{getFacultyLabel(row.faculty_id)}</p>
                    <p className="text-xs text-slate-500">Teaching allocation</p>
                </div>
            )
        },
        {
            header: 'Subject',
            cell: (row) => {
                const subject = getSubjectById(row.subject_id);
                return (
                    <div className="min-w-[220px]">
                        <p className="text-sm font-bold text-slate-800">{subject?.name || 'Unknown subject'}</p>
                        <p className="text-xs text-slate-500">{subject?.code || 'No subject code'}</p>
                    </div>
                );
            }
        },
        {
            header: 'Class',
            cell: (row) => (
                <div className="min-w-[180px]">
                    <p className="text-sm font-semibold text-slate-700">{getClassLabel(row)}</p>
                </div>
            )
        },
        {
            header: 'Semester',
            cell: (row) => (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                    Semester {row.semester}
                </span>
            )
        },
        {
            header: 'Actions',
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => openEditModal(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                    </button>
                    <button
                        type="button"
                        onClick={() => handleDeleteAllocation(row._id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Faculty-Subject Allocation</h1>
                <p className="text-slate-500 mt-1">Map faculty members to subjects, view current class assignments, and update them anytime.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="p-8 lg:col-span-2 shadow-xl shadow-slate-200/50 border-none">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                        <UserCheck className="h-5 w-5 mr-3 text-violet-500" />
                        Create New Allocation
                    </h3>

                    <form onSubmit={handleAssign} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Faculty</label>
                                <select
                                    className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                                    value={selection.faculty_id}
                                    onChange={(e) => setSelection({ ...selection, faculty_id: e.target.value })}
                                >
                                    <option value="">Choose Faculty Member</option>
                                    {faculties.map(f => <option key={f._id} value={f._id}>{f.name} ({f.employee_id})</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Subject</label>
                                <select
                                    className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                                    value={selection.subject_id}
                                    onChange={(e) => setSelection({ ...selection, subject_id: e.target.value })}
                                >
                                    <option value="">Choose Subject</option>
                                    {subjects.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                                </select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Class</label>
                                <select
                                    className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                                    value={selection.classValue}
                                    onChange={(e) => {
                                        const nextClassValue = e.target.value;
                                        const fy = parseFyFromClassValue(nextClassValue);
                                        const allowed = semestersForFy(fy).map(String);
                                        setSelection((cur) => ({
                                            ...cur,
                                            classValue: nextClassValue,
                                            semester: allowed.includes(String(cur.semester)) ? cur.semester : ''
                                        }));
                                    }}
                                >
                                    <option value="">Select Class (FY)</option>
                                    {classOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Semester</label>
                                <select
                                    className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                                    value={selection.semester}
                                    onChange={(e) => {
                                        const nextSemester = e.target.value;
                                        setSelection((cur) => ({
                                            ...cur,
                                            semester: nextSemester,
                                            classValue: cur.classValue || defaultClassValueForFy(fyFromSemester(nextSemester))
                                        }));
                                    }}
                                >
                                    <option value="">Select Semester</option>
                                    {semestersForFy(parseFyFromClassValue(selection.classValue)).map(semester => (
                                        <option key={semester} value={semester}>Semester {semester}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {status && (
                            <div className={`p-4 rounded-xl flex items-center space-x-3 animate-in fade-in zoom-in duration-300 ${
                                status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                                <CheckCircle2 className="h-5 w-5" />
                                <p className="text-sm font-bold">{status.message}</p>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button size="lg" className="rounded-2xl font-bold bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-200 px-10 h-14">
                                Confirm Allocation <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                    </form>
                </Card>

                <div className="space-y-6">
                    <Card className="p-6 bg-gradient-to-br from-violet-600 to-indigo-700 text-white border-none shadow-xl shadow-violet-200/50">
                        <h4 className="font-bold text-lg mb-2">Allocation Logic</h4>
                        <p className="text-violet-100 text-sm leading-relaxed mb-4">Assignments created here now show the faculty, subject, and class mapping in one place so admins can review, edit, or remove them quickly.</p>
                        <div className="bg-white/10 rounded-xl p-4 flex items-center">
                            <TableIcon className="h-8 w-8 text-violet-200 mr-4 opacity-50" />
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-violet-300">Active Mappings</p>
                                <p className="text-xl font-bold">{allocations.length}</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-white border-none shadow-lg shadow-slate-100/50">
                        <h4 className="font-bold text-slate-800 mb-4 flex items-center">
                            <BookOpen className="h-5 w-5 mr-2 text-orange-500" />
                            Quick Stats
                        </h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Total Subjects</span>
                                <span className="font-bold text-slate-800">{subjects.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Available Faculty</span>
                                <span className="font-bold text-slate-800">{faculties.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Mapped Classes</span>
                                <span className="font-bold text-slate-800">{allocations.length}</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center">
                            <GraduationCap className="h-5 w-5 mr-3 text-violet-500" />
                            Current Allocations
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">See which faculty is allocated to which subject and class.</p>
                    </div>
                    <div className="relative w-full md:max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            className="pl-10 h-11 bg-slate-50 border-none rounded-xl"
                            placeholder="Search faculty, subject, class..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-[180px]">
                        <select
                            className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                            value={selection.fyFilter}
                            onChange={(e) => setSelection((cur) => ({ ...cur, fyFilter: e.target.value }))}
                        >
                            <option value="">All Classes</option>
                            {classOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-white">
                    {loading ? (
                        <div className="p-20 text-center">
                            <TableIcon className="h-12 w-12 text-slate-200 mx-auto mb-4 animate-pulse" />
                            <p className="text-slate-400 font-medium">Loading allocations...</p>
                        </div>
                    ) : (
                        <Table
                            columns={columns}
                            data={filteredAllocations}
                            keyField="_id"
                            headerClassName="bg-slate-50/50 text-slate-500 uppercase tracking-widest text-[10px] font-black"
                            rowClassName="hover:bg-violet-50/30 transition-colors border-b border-slate-50 last:border-0"
                        />
                    )}
                </div>
            </Card>

            <Modal isOpen={isEditModalOpen} onClose={closeEditModal} title="Edit Allocation">
                <form onSubmit={handleUpdateAllocation} className="space-y-6 pt-2">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Faculty</label>
                        <select
                            className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                            value={editingAllocation?.faculty_id || ''}
                            onChange={(e) => setEditingAllocation(current => ({ ...current, faculty_id: e.target.value }))}
                        >
                            <option value="">Choose Faculty Member</option>
                            {faculties.map(f => <option key={f._id} value={f._id}>{f.name} ({f.employee_id})</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Subject</label>
                        <select
                            className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                            value={editingAllocation?.subject_id || ''}
                            onChange={(e) => setEditingAllocation(current => ({ ...current, subject_id: e.target.value }))}
                        >
                            <option value="">Choose Subject</option>
                            {subjects.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Class</label>
                        <select
                            className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                            value={editingAllocation?.classValue || ''}
                            onChange={(e) => {
                                const nextClassValue = e.target.value;
                                const fy = parseFyFromClassValue(nextClassValue);
                                const allowed = semestersForFy(fy).map(String);
                                setEditingAllocation((cur) => ({
                                    ...cur,
                                    classValue: nextClassValue,
                                    semester: allowed.includes(String(cur?.semester)) ? cur?.semester : ''
                                }));
                            }}
                        >
                            <option value="">Select Class (FY)</option>
                            {classOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Semester</label>
                        <select
                            className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                            value={editingAllocation?.semester || ''}
                            onChange={(e) => {
                                const nextSemester = e.target.value;
                                setEditingAllocation((cur) => ({
                                    ...cur,
                                    semester: nextSemester,
                                    classValue: cur?.classValue || defaultClassValueForFy(fyFromSemester(nextSemester))
                                }));
                            }}
                        >
                            <option value="">Select Semester</option>
                            {semestersForFy(parseFyFromClassValue(editingAllocation?.classValue)).map(semester => (
                                <option key={semester} value={semester}>Semester {semester}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button type="button" variant="ghost" onClick={closeEditModal}>Cancel</Button>
                        <Button type="submit" className="bg-violet-600 hover:bg-violet-700">Save Changes</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Allocation;
