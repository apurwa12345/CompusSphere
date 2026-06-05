import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { Plus, Search, BookOpen, Layers, BadgeCheck, MoreHorizontal, Filter, Edit, Trash2 } from 'lucide-react';
import api from '../../services/api';

const Subjects = () => {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        semester: 1,
        credits: 3,
        type: 'Theory'
    });
    const [isEditing, setIsEditing] = useState(false);
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);

    const fetchSubjects = async () => {
        try {
            setLoading(true);
            const res = await api.get('/academic/subjects');
            setSubjects(res.data || []);
        } catch (error) {
            console.error("Error fetching subjects", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubjects();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await api.put(`/academic/subjects/${selectedSubjectId}`, formData);
            } else {
                await api.post('/academic/subjects', formData);
            }
            setIsModalOpen(false);
            setIsEditing(false);
            setSelectedSubjectId(null);
            setFormData({ name: '', code: '', semester: 1, credits: 3, type: 'Theory' });
            fetchSubjects();
        } catch (error) {
            console.error(error);
            alert('Failed to save subject');
        }
    };

    const handleEdit = (subject) => {
        setFormData({
            name: subject.name,
            code: subject.code,
            semester: subject.semester,
            credits: subject.credits,
            type: subject.type || 'Theory'
        });
        setSelectedSubjectId(subject._id);
        setIsEditing(true);
        setIsModalOpen(true);
        setActiveMenuId(null);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this subject?')) {
            try {
                await api.delete(`/academic/subjects/${id}`);
                fetchSubjects();
            } catch (error) {
                console.error(error);
                alert('Failed to delete subject');
            }
        }
        setActiveMenuId(null);
    };

    const filteredSubjects = subjects.filter(s => {
        const matchesSearch = s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              s.code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSemester = selectedSemester === 'All' || parseInt(s.semester) === parseInt(selectedSemester);
        return matchesSearch && matchesSemester;
    });

    const columns = [
        { 
            header: 'Subject Details', 
            cell: (row) => (
                <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                        <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">{row.name}</p>
                        <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">{row.code}</p>
                    </div>
                </div>
            )
        },
        { 
            header: 'Type', 
            accessor: 'type',
            cell: (row) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    row.type === 'Theory' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                    {row.type}
                </span>
            )
        },
        { 
            header: 'Semester', 
            cell: (row) => <span className="text-sm font-bold text-slate-600">Semester {row.semester}</span>
        },
        { 
            header: 'Credits', 
            cell: (row) => (
                <div className="flex items-center">
                    <BadgeCheck className="h-4 w-4 mr-1.5 text-orange-500" />
                    <span className="text-sm font-bold text-slate-800">{row.credits} Units</span>
                </div>
            )
        },
        {
            header: 'Actions',
            cell: (row) => (
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => handleEdit(row)}
                        title="Edit Subject"
                        className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                        <Edit className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => handleDelete(row._id)}
                        title="Delete Subject"
                        className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Academic Subjects</h1>
                    <p className="text-slate-500 mt-1">Manage core curriculum and course credit values.</p>
                </div>
                <Button onClick={() => {
                    setIsEditing(false);
                    setFormData({ name: '', code: '', semester: 1, credits: 3, type: 'Theory' });
                    setIsModalOpen(true);
                }} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200">
                    <Plus className="h-4 w-4 mr-2" /> Define New Subject
                </Button>
            </div>

            <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white">
                    <div className="flex gap-4 items-center w-full max-w-xl">
                        <div className="relative w-full max-w-xs">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                className="pl-10 h-10 bg-slate-50 border-none rounded-xl" 
                                placeholder="Quick search..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select 
                            className="h-10 bg-slate-50 border-none rounded-xl px-4 text-sm text-slate-600 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                            value={selectedSemester}
                            onChange={(e) => setSelectedSemester(e.target.value)}
                        >
                            <option value="All">All Semesters</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                                <option key={sem} value={sem}>Semester {sem}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2.5 rounded-xl border border-slate-100 text-slate-500 hover:bg-slate-50 transition-colors">
                            <Layers className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="bg-white">
                    {loading ? (
                        <div className="p-20 text-center">
                            <BookOpen className="h-12 w-12 text-slate-200 mx-auto mb-4 animate-pulse" />
                            <p className="text-slate-400 font-medium">Loading curriculum...</p>
                        </div>
                    ) : (
                        <Table 
                            columns={columns} 
                            data={filteredSubjects} 
                            keyField="_id" 
                            headerClassName="bg-slate-50/50 text-slate-500 uppercase tracking-widest text-[10px] font-black"
                            rowClassName="hover:bg-orange-50/30 transition-colors border-b border-slate-50 last:border-0"
                        />
                    )}
                </div>
            </Card>

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => {
                    setIsModalOpen(false);
                    setIsEditing(false);
                    setSelectedSubjectId(null);
                }} 
                title={isEditing ? "Edit Subject" : "Define Subject"}
            >
                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Subject Name</label>
                        <Input 
                            required 
                            placeholder="e.g. Advanced Data Structures"
                            className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-orange-500/20"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Subject Code</label>
                            <Input 
                                required placeholder="e.g. CS401"
                                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-orange-500/20"
                                value={formData.code}
                                onChange={(e) => setFormData({...formData, code: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Credits</label>
                            <Input 
                                required type="number"
                                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-orange-500/20"
                                value={formData.credits}
                                onChange={(e) => setFormData({...formData, credits: parseInt(e.target.value)})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Semester</label>
                            <select 
                                required
                                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                value={formData.semester}
                                onChange={(e) => setFormData({...formData, semester: parseInt(e.target.value)})}
                            >
                                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Type</label>
                            <select 
                                required
                                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                value={formData.type}
                                onChange={(e) => setFormData({...formData, type: e.target.value})}
                            >
                                <option value="Theory">Theory</option>
                                <option value="Practical">Practical</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-8">
                        <Button type="button" variant="ghost" onClick={() => {
                            setIsModalOpen(false);
                            setIsEditing(false);
                        }} className="rounded-xl font-bold">Cancel</Button>
                        <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold shadow-lg shadow-orange-200 px-8">
                            {isEditing ? 'Update Subject' : 'Save Subject'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Subjects;
