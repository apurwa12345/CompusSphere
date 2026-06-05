import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { Plus, Search, Filter, GraduationCap, Mail, Calendar, BookOpen, MoreHorizontal, Phone, Building2, Hash, CreditCard, Users, User, Copy, Check } from 'lucide-react';
import api from '../../services/api';

const Students = () => {
    const [students, setStudents] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [classFilter, setClassFilter] = useState('all');
    const [sortBy, setSortBy] = useState('name'); // name | department | roll
    const [sortDir, setSortDir] = useState('asc'); // asc | desc
    const [showFilters, setShowFilters] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const [copiedPassword, setCopiedPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        enrollment_no: '',
        department_id: '',
        class_name: '',
        current_semester: 1,
        batch_year: new Date().getFullYear().toString(),
        roll_no: '',
        mobile: '',
        gender: '',
        dob: '',
        group: 'A',
        password: ''
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [studentsRes, deptsRes] = await Promise.all([
                api.get('/academic/students'),
                api.get('/academic/departments')
            ]);
            setStudents(studentsRes.data.items || studentsRes.data || []);
            setDepartments(deptsRes.data || []);
        } catch (error) {
            console.error("Error fetching data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const resetFormData = () => {
        setFormData({
            name: '',
            email: '',
            enrollment_no: '',
            department_id: '',
            class_name: '',
            current_semester: 1,
            batch_year: new Date().getFullYear().toString(),
            roll_no: '',
            mobile: '',
            gender: '',
            dob: '',
            group: 'A',
            password: ''
        });
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.enrollment_no) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            setIsCreating(true);
            const response = await api.post('/academic/admin/students', formData);
            
            // Show success modal with temporary password
            setSuccessData(response.data);
            setIsModalOpen(false);
            resetFormData();
            
            // Refresh the student list
            setTimeout(() => fetchData(), 1000);
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || 'Failed to create student. Please check all fields and try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const copyPasswordToClipboard = () => {
        if (successData?.temporary_password) {
            navigator.clipboard.writeText(successData.temporary_password);
            setCopiedPassword(true);
            setTimeout(() => setCopiedPassword(false), 2000);
        }
    };

    const getDepartmentId = (student) => {
        const raw = student?.department_id;
        if (!raw) return '';
        if (typeof raw === 'string' || typeof raw === 'number') return raw.toString();
        if (typeof raw === 'object') {
            // Support Mongo Extended JSON ({ $oid: "..." })
            if (raw.$oid) return raw.$oid.toString();
            if (raw.oid) return raw.oid.toString();
            if (raw._id) return raw._id.toString();
            if (raw.id) return raw.id.toString();
            if (raw.code) return raw.code.toString();
        }
        return '';
    };

    const getDepartmentName = (student) => {
        if (!student) return '';
        if (typeof student.department === 'string' && student.department.trim()) {
            return student.department.trim();
        }
        if (student.department && typeof student.department === 'object') {
            if (student.department.name) return student.department.name.toString();
            if (student.department.code) return student.department.code.toString();
        }

        const deptId = getDepartmentId(student);
        const deptCode = student?.department_code;
        const dept = departments.find(d => 
            (deptId && d._id === deptId) || 
            (deptCode && d.code === deptCode) || 
            (deptId && d.code === deptId) || 
            d._id === student.department_id || 
            d.code === student.department_id
        );
        return (dept ? dept.name : deptId || '').toString();
    };

    const normalizeText = (value) => {
        if (value === null || value === undefined) return '';
        return value.toString().trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');
    };

    const toStr = (v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'number') return v.toString();
        if (typeof v === 'object') {
            // Mongo Extended JSON: { $oid: "..." }
            if (v.$oid) return v.$oid.toString();
            if (v.oid) return v.oid.toString();
            // Common nested form: { _id: { $oid: "..." } }
            if (v._id && typeof v._id === 'object' && (v._id.$oid || v._id.oid)) {
                return (v._id.$oid || v._id.oid).toString();
            }
            if (typeof v.toString === 'function') return v.toString();
            return String(v);
        }
        return String(v);
    };

    const getDepartmentOptionValue = (dept) => {
        if (!dept) return '';
        const id = toStr(dept._id || dept.id);
        const code = toStr(dept.code);
        const name = toStr(dept.name);
        // Prefer stable identifiers first (id/code) so filtering is reliable.
        return id || code || name;
    };

    const getDepartmentCode = (student) => {
        if (!student) return '';
        if (typeof student.department_code === 'string' || typeof student.department_code === 'number') {
            return student.department_code.toString();
        }
        if (student.department && typeof student.department === 'object' && student.department.code) {
            return student.department.code.toString();
        }
        return getDepartmentId(student);
    };

    const getDepartmentIdentifiers = (student) => {
        return {
            id: normalizeText(getDepartmentId(student)),
            code: normalizeText(getDepartmentCode(student)),
            name: normalizeText(getDepartmentName(student))
        };
    };

    const findNormalizedDepartment = (filterKey) => {
        if (!filterKey) return null;
        const normalizedFilterKey = normalizeText(filterKey);
        return departments.find(d => {
            const deptId = normalizeText(toStr(d._id || d.id));
            const deptCode = normalizeText(toStr(d.code));
            const deptName = normalizeText(toStr(d.name));
            return normalizedFilterKey === deptId || normalizedFilterKey === deptCode || normalizedFilterKey === deptName;
        });
    };

    const getRollValue = (student) => {
        return (student.roll_no || student.enrollment_no || '').toString();
    };

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

    const normalizeDeptKey = (value) => normalizeText(value).replace(/\s+/g, '');

    const getDeptKeyForStudent = (student) => {
        const id = normalizeDeptKey(getDepartmentId(student));
        const code = normalizeDeptKey(getDepartmentCode(student));
        const name = normalizeDeptKey(getDepartmentName(student));

        const candidates = [code, name, id].filter(Boolean);

        // Match if candidate exactly equals a keyword, OR if candidate contains a keyword,
        // OR if a keyword contains the candidate. This handles both short codes ("CSE") and
        // full DB names ("Artificial Intelligence & Machine Learning (B.Tech)").
        const matches = (candidate, keys) => keys.some(k => {
            const nk = normalizeDeptKey(k);
            return candidate === nk || candidate.includes(nk) || nk.includes(candidate);
        });

        for (const candidate of candidates) {
            // Check more-specific/longer depts first to avoid false substring hits
            // e.g. "artificialintelligence..." contains "it", so AIML must precede IT
            if (matches(candidate, ['aiml', 'artificialintelligence', 'machinelearning', 'artificialintelligencemachinelearning'])) return 'AIML';
            if (matches(candidate, ['etc', 'entc', 'electronic', 'telecommunication', 'electronicstelecommunication'])) return 'E&TC';
            if (matches(candidate, ['automation', 'robotics', 'automationrobotics'])) return 'A&R';
            if (matches(candidate, ['cse', 'computerscience', 'computerscienceengineering'])) return 'CSE';
            if (matches(candidate, ['it', 'informationtechnology'])) return 'IT';
            if (matches(candidate, ['civil', 'civilengineering'])) return 'CIVIL';
            if (matches(candidate, ['mech', 'mechanical', 'mechanicalengineering'])) return 'MECH';
        }

        return '';
    };

    const computeSectionSizes = (deptKey) => {
        const cfg = CLASS_DIVISION[deptKey];
        if (!cfg) return [];
        const { total, sections } = cfg;
        if (sections <= 1) return [total];

        if (deptKey === 'CSE' && sections === 3) {
            // Keep ~70 per class (as requested). For 208 -> 70,70,68.
            return [70, 70, Math.max(0, total - 140)];
        }

        const base = Math.floor(total / sections);
        const rem = total % sections;
        return Array.from({ length: sections }, (_v, i) => base + (i < rem ? 1 : 0));
    };

    const getClassForStudent = (student, indexWithinDept) => {
        const deptKey = getDeptKeyForStudent(student);
        const cfg = CLASS_DIVISION[deptKey];
        if (!cfg) return '';

        const sizes = computeSectionSizes(deptKey);
        let idx = indexWithinDept;
        let sectionIndex = 0;
        while (sectionIndex < sizes.length && idx >= sizes[sectionIndex]) {
            idx -= sizes[sectionIndex];
            sectionIndex += 1;
        }
        const letter = String.fromCharCode('A'.charCodeAt(0) + Math.min(sectionIndex, 25));
        return `FY ${cfg.fy} ${letter}`;
    };

    const classOptions = (() => {
        const entries = Object.entries(CLASS_DIVISION)
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
        return entries;
    })();

    const classIndexMap = (() => {
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
                const an = (a.name || '').toString().toLowerCase();
                const bn = (b.name || '').toString().toLowerCase();
                return an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' });
            });
            sorted.forEach((s, idx) => {
                const key = toStr(s._id || s.id || s.enrollment_no || s.email || `${deptKey}:${idx}`);
                map.set(key, idx);
            });
        }
        return map;
    })();

    const filteredStudents = students
        .filter(s =>
            s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.enrollment_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.roll_no?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .filter(s => {
            if (departmentFilter === 'all' || !departmentFilter) return true;

            const filterKey = normalizeText(departmentFilter);
            if (!filterKey) return true;

            const studentDept = getDepartmentIdentifiers(s);
            if ([studentDept.id, studentDept.code, studentDept.name].includes(filterKey)) return true;

            const selectedDept = findNormalizedDepartment(filterKey);
            if (!selectedDept) {
                return studentDept.name === filterKey;
            }

            const selectedDeptId = normalizeText(toStr(selectedDept._id || selectedDept.id));
            const selectedDeptCode = normalizeText(toStr(selectedDept.code));
            const selectedDeptName = normalizeText(toStr(selectedDept.name));

            return [studentDept.id, studentDept.code, studentDept.name].some(value =>
                value && [selectedDeptId, selectedDeptCode, selectedDeptName].includes(value)
            );
        })
        .filter(s => {
            if (classFilter === 'all' || !classFilter) return true;
            const key = toStr(s._id || s.id || s.enrollment_no || s.email || '');
            const deptIndex = classIndexMap.get(key);
            if (deptIndex === null || deptIndex === undefined) return false;
            const computedClass = getClassForStudent(s, deptIndex);
            return computedClass === classFilter;
        });

    const sortedStudents = [...filteredStudents].sort((a, b) => {
        let av = '';
        let bv = '';

        if (sortBy === 'department') {
            av = getDepartmentName(a).toLowerCase();
            bv = getDepartmentName(b).toLowerCase();
        } else if (sortBy === 'roll') {
            av = getRollValue(a);
            bv = getRollValue(b);
        } else {
            av = (a.name || '').toString().toLowerCase();
            bv = (b.name || '').toString().toLowerCase();
        }

        const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
        return sortDir === 'desc' ? -cmp : cmp;
    });

    const columns = [
        {
            header: 'S.No',
            cell: (_row, rowIndex) => (
                <span className="text-sm font-mono text-slate-500">{rowIndex + 1}</span>
            )
        },
        {
            header: 'Roll No',
            cell: (row) => (
                <span className="text-sm font-mono bg-violet-50 px-2 py-1 rounded text-violet-700 font-semibold">
                    {row.roll_no || row.enrollment_no || '—'}
                </span>
            )
        },
        { 
            header: 'Student', 
            cell: (row) => (
                <div 
                    className="flex items-center space-x-3 cursor-pointer group"
                    onClick={() => setSelectedStudent(row)}
                >
                    <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold group-hover:bg-violet-200 transition-colors">
                        {row.name?.charAt(0)}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800 group-hover:text-violet-600 transition-colors">{row.name}</p>
                        <p className="text-xs text-slate-500 flex items-center"><Mail className="h-3 w-3 mr-1" /> {row.email}</p>
                    </div>
                </div>
            )
        },
        { 
            header: 'ID / Enrollment', 
            accessor: 'enrollment_no',
            cell: (row) => <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">{row.enrollment_no}</span>
        },
        {
            header: 'Department', 
            cell: (row) => {
                return <span className="text-sm text-slate-600 font-medium">{getDepartmentName(row) || 'N/A'}</span>;
            }
        },
        { 
            header: 'Class', 
            cell: (row) => {
                const key = toStr(row._id || row.id || row.enrollment_no || row.email || '');
                const deptIndex = classIndexMap.get(key);
                const computedClass = getClassForStudent(row, deptIndex);
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">{computedClass || `Sem ${row.current_semester}`}</span>;
            }
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Student Management</h1>
                    <p className="text-slate-500 mt-1">Manage academic records and profiles for all students.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200">
                    <Plus className="h-4 w-4 mr-2" /> Add Student
                </Button>
            </div>

            <Card className="border-none shadow-xl shadow-slate-200/50 overflow-visible">
                <div className="p-6 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center bg-white overflow-visible">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            className="pl-11 h-11 bg-slate-50/50 border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20" 
                            placeholder="Search by name or enrollment number..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                            Showing <span className="text-slate-800">{sortedStudents.length}</span> / <span className="text-slate-800">{students.length}</span>
                        </div>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowFilters(v => !v)}
                                className="flex items-center space-x-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                <Filter className="h-4 w-4" />
                                <span>Filters</span>
                            </button>

                            {showFilters && (
                                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Department</label>
                                            <select
                                                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                                value={departmentFilter}
                                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                                disabled={loading || departments.length === 0}
                                            >
                                                <option value="all">All Departments</option>
                                                {departments && departments.length > 0 ? (
                                                    departments.map(d => (
                                                        <option
                                                            key={getDepartmentOptionValue(d) || d.name || d.code || toStr(d._id)}
                                                            value={getDepartmentOptionValue(d)}
                                                        >
                                                            {d.name || d.code || toStr(d._id)}
                                                        </option>
                                                    ))
                                                ) : (
                                                    <option disabled>{loading ? 'Loading departments...' : 'No departments available'}</option>
                                                )}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Class</label>
                                            <select
                                                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                                value={classFilter}
                                                onChange={(e) => setClassFilter(e.target.value)}
                                                disabled={loading}
                                            >
                                                <option value="all">All Classes</option>
                                                {classOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sort by</label>
                                                <select
                                                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                                    value={sortBy}
                                                    onChange={(e) => setSortBy(e.target.value)}
                                                >
                                                    <option value="department">Department</option>
                                                    <option value="name">Name</option>
                                                    <option value="roll">Roll No</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Order</label>
                                                <select
                                                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                                    value={sortDir}
                                                    onChange={(e) => setSortDir(e.target.value)}
                                                >
                                                    <option value="asc">Ascending</option>
                                                    <option value="desc">Descending</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                                            <button
                                                type="button"
                                                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                                                onClick={() => {
                                                    setDepartmentFilter('all');
                                                    setClassFilter('all');
                                                    setSortBy('name');
                                                    setSortDir('asc');
                                                }}
                                            >
                                                Reset
                                            </button>
                                            <button
                                                type="button"
                                                className="px-3 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700"
                                                onClick={() => setShowFilters(false)}
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="bg-white">
                    {loading ? (
                        <div className="p-20 text-center">
                            <GraduationCap className="h-12 w-12 text-slate-200 mx-auto mb-4 animate-bounce" />
                            <p className="text-slate-400 font-medium animate-pulse">Fetching records...</p>
                        </div>
                    ) : (
                        <Table 
                            columns={columns} 
                            data={sortedStudents} 
                            keyField="_id" 
                            containerClassName="border-none"
                            headerClassName="bg-slate-50/50 text-slate-500 uppercase tracking-widest text-[10px] font-black"
                            rowClassName="hover:bg-violet-50/30 transition-colors border-b border-slate-50 last:border-0"
                        />
                    )}
                </div>

                {!loading && students.length === 0 && (
                    <div className="p-20 text-center bg-white">
                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <GraduationCap className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">No students found</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mt-2 text-sm leading-relaxed">It looks like there are no student records yet. Start by adding your first student.</p>
                        <Button variant="ghost" className="mt-6 text-violet-600 font-bold" onClick={() => setIsModalOpen(true)}>Add Student Record</Button>
                    </div>
                )}
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => {setIsModalOpen(false); resetFormData();}} title="Add New Student Profile">
                <form onSubmit={handleCreate} className="space-y-6 pt-4 max-h-96 overflow-y-auto pr-4">
                    {/* Required Fields */}
                    <div className="bg-violet-50/50 border border-violet-200 rounded-xl p-4 mb-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-violet-700 mb-3">Required Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Full Name *</label>
                                <Input 
                                    required 
                                    placeholder="Student's legal name" 
                                    className="h-10 rounded-lg border-slate-200 focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Email Address *</label>
                                <Input 
                                    required 
                                    type="email"
                                    placeholder="student@mgmcen.ac.in" 
                                    className="h-10 rounded-lg border-slate-200 focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Enrollment Number *</label>
                                <Input 
                                    required 
                                    placeholder="e.g. 21BCE001" 
                                    className="h-10 rounded-lg border-slate-200 focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.enrollment_no}
                                    onChange={(e) => setFormData({...formData, enrollment_no: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Department *</label>
                                <select 
                                    required
                                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.department_id}
                                    onChange={(e) => setFormData({...formData, department_id: e.target.value})}
                                    disabled={loading || departments.length === 0}
                                >
                                    <option value="">{loading ? 'Loading...' : 'Select Department'}</option>
                                    {departments && departments.length > 0 ? (
                                        departments.map(d => (
                                            <option
                                                key={getDepartmentOptionValue(d) || d.name || d.code || toStr(d._id)}
                                                value={getDepartmentOptionValue(d)}
                                            >
                                                {d.name || d.code || toStr(d._id)}
                                            </option>
                                        ))
                                    ) : !loading ? (
                                        <option disabled>No departments available</option>
                                    ) : null}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Academic Information */}
                    <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-blue-700 mb-3">Academic Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Class</label>
                                <select 
                                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.class_name}
                                    onChange={(e) => setFormData({...formData, class_name: e.target.value})}
                                >
                                    <option value="">Select Class</option>
                                    {classOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Current Semester</label>
                                <Input 
                                    type="number"
                                    min="1"
                                    max="8"
                                    className="h-10 rounded-lg border-slate-200 focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.current_semester}
                                    onChange={(e) => setFormData({...formData, current_semester: parseInt(e.target.value) || 1})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Batch Year</label>
                                <Input 
                                    placeholder="e.g. 2021" 
                                    className="h-10 rounded-lg border-slate-200 focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.batch_year}
                                    onChange={(e) => setFormData({...formData, batch_year: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Roll No</label>
                                <Input 
                                    placeholder="e.g. 001" 
                                    className="h-10 rounded-lg border-slate-200 focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.roll_no}
                                    onChange={(e) => setFormData({...formData, roll_no: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Group</label>
                                <select 
                                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.group}
                                    onChange={(e) => setFormData({...formData, group: e.target.value})}
                                >
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                    <option value="D">D</option>
                                    <option value="E">E</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Personal Information */}
                    <div className="bg-green-50/50 border border-green-200 rounded-xl p-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-green-700 mb-3">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Mobile / Phone</label>
                                <Input 
                                    type="tel"
                                    placeholder="e.g. 98XXXXXXXX" 
                                    className="h-10 rounded-lg border-slate-200 focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.mobile}
                                    onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Gender</label>
                                <select 
                                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.gender}
                                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                                >
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Date of Birth</label>
                                <Input 
                                    type="date"
                                    className="h-10 rounded-lg border-slate-200 focus:ring-2 focus:ring-violet-500/20"
                                    value={formData.dob}
                                    onChange={(e) => setFormData({...formData, dob: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Login Credentials */}
                    <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-3">Login Credentials</h3>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Password (Optional - Auto-generated if empty)</label>
                            <Input 
                                type="password"
                                placeholder="Leave empty to auto-generate" 
                                className="h-10 rounded-lg border-slate-200 focus:ring-2 focus:ring-violet-500/20"
                                value={formData.password}
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                            />
                            <p className="text-xs text-slate-500 mt-2">Auto-generated passwords will be shown after creation.</p>
                        </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 mt-8">
                        <Button type="button" variant="ghost" onClick={() => {setIsModalOpen(false); resetFormData();}} className="rounded-lg font-bold">Cancel</Button>
                        <Button type="submit" disabled={isCreating} className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-bold shadow-lg shadow-violet-200 px-8">
                            {isCreating ? 'Creating...' : 'Create Student'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Success Modal */}
            <Modal isOpen={!!successData} onClose={() => setSuccessData(null)} title="✅ Student Created Successfully">
                {successData && (
                    <div className="space-y-6 pt-4">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold text-green-900 mb-2">Student Profile Created</h3>
                            <p className="text-sm text-green-700">The student account and profile have been successfully created in the system.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Name</p>
                                <p className="text-sm font-bold text-slate-800">{successData.name || successData.email}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Email</p>
                                <p className="text-sm font-bold text-slate-800 font-mono">{successData.email}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Enrollment Number</p>
                                <p className="text-sm font-bold text-slate-800 font-mono">{successData.enrollment_no}</p>
                            </div>
                        </div>

                        {successData.temporary_password && (
                            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-amber-700 mb-3">Temporary Login Password</p>
                                <div className="flex items-center space-x-2 bg-white border border-amber-200 rounded-lg p-3">
                                    <code className="flex-1 text-sm font-mono font-bold text-amber-900 select-all">{successData.temporary_password}</code>
                                    <button
                                        type="button"
                                        onClick={copyPasswordToClipboard}
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        {copiedPassword ? (
                                            <>
                                                <Check className="h-4 w-4" />
                                                <span>Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-4 w-4" />
                                                <span>Copy</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs text-amber-700 mt-3 font-semibold">⚠️ Share this password with the student. They will be prompted to change it on first login.</p>
                            </div>
                        )}

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-blue-700 mb-2">User IDs</p>
                            <div className="space-y-2">
                                <div className="text-xs">
                                    <span className="text-blue-600 font-semibold">User ID:</span>
                                    <code className="text-blue-900 font-mono ml-2">{successData.user_id}</code>
                                </div>
                                <div className="text-xs">
                                    <span className="text-blue-600 font-semibold">Student ID:</span>
                                    <code className="text-blue-900 font-mono ml-2">{successData.student_id}</code>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                            <Button onClick={() => setSuccessData(null)} className="bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold px-8">Done</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Student Details Component/Modal */}
            <Modal isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)} title="Student Profile Overview">
                {selectedStudent && (
                    <div className="space-y-6 pt-4">
                        <div className="flex flex-col items-center justify-center border-b border-slate-100 pb-6">
                            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center text-violet-600 font-black text-4xl shadow-inner border-4 border-white mb-4">
                                {selectedStudent.name?.charAt(0)}
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">{selectedStudent.name}</h3>
                            <p className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-mono mt-2">{selectedStudent.enrollment_no}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* EMAIL */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Email</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.email}</p>
                                </div>
                            </div>

                            {/* MOBILE */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <Phone className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Mobile</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.mobile || selectedStudent.mobile_number || selectedStudent.phone || 'Not provided'}</p>
                                </div>
                            </div>

                            {/* DEPARTMENT */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Department</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">
                                        {selectedStudent.department || departments.find(d => d._id === selectedStudent.department_id || d.code === selectedStudent.department_id)?.name || selectedStudent.department_id || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {/* DEPARTMENT ID */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Department ID</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.department_id || 'N/A'}</p>
                                </div>
                            </div>

                            {/* PRN */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <CreditCard className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">PRN</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.enrollment_no || 'Not provided'}</p>
                                </div>
                            </div>

                            {/* CURRENT SEMESTER */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <Hash className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Current Semester</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.current_semester || 'Not provided'}</p>
                                </div>
                            </div>

                            {/* CLASS */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <BookOpen className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Class</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">
                                        {(() => {
                                            const key = toStr(selectedStudent._id || selectedStudent.id || selectedStudent.enrollment_no || selectedStudent.email || '');
                                            const deptIndex = classIndexMap.get(key);
                                            return getClassForStudent(selectedStudent, deptIndex) || 'Not provided';
                                        })()}
                                    </p>
                                </div>
                            </div>

                            {/* BATCH YEAR */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <Calendar className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Batch Year</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.batch_year || 'Not provided'}</p>
                                </div>
                            </div>

                            {/* DATE OF BIRTH */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <Calendar className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Date of Birth</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.dob || 'Not provided'}</p>
                                </div>
                            </div>

                            {/* GENDER */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Gender</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.gender || 'Not provided'}</p>
                                </div>
                            </div>

                            {/* ROLL NO */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <Hash className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Roll No</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.roll_no || 'Not provided'}</p>
                                </div>
                            </div>

                            {/* GROUP */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Group</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.group || 'Not provided'}</p>
                                </div>
                            </div>

                            {/* ABC ID */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <CreditCard className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">ABC ID</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.abc_id || 'Not provided'}</p>
                                </div>
                            </div>

                            {/* YEAR */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <User className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Year</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.year || 'Not provided'}</p>
                                </div>
                            </div>

                            {/* SEMESTER */}
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-violet-100 flex flex-shrink-0 items-center justify-center text-violet-600 mr-4">
                                    <User className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Semester</p>
                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedStudent.semester || selectedStudent.current_semester || 'Not provided'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-100 mt-6">
                            <Button onClick={() => setSelectedStudent(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold">
                                Close Profile
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Students;
