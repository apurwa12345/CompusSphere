import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { Plus, Search, Users, Mail, Briefcase, Building, MoreHorizontal } from 'lucide-react';
import api from '../../services/api';

const Faculty = () => {
    const [faculties, setFaculties] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        employee_id: '',
        department_id: '',
        designation: ''
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [facRes, deptsRes] = await Promise.all([
                api.get('/academic/faculties'),
                api.get('/academic/departments')
            ]);
            setFaculties(facRes.data || []);
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

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/academic/faculties', formData);
            setIsModalOpen(false);
            setFormData({ name: '', email: '', employee_id: '', department_id: '', designation: '' });
            fetchData();
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || 'Failed to save faculty profile');
        }
    };

    const filteredFaculties = faculties.filter(f => 
        f.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        f.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
        { 
            header: 'Faculty Member', 
            cell: (row) => (
                <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        {row.name?.charAt(0)}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">{row.name}</p>
                        <p className="text-xs text-slate-500 flex items-center"><Mail className="h-3 w-3 mr-1" /> {row.email}</p>
                    </div>
                </div>
            )
        },
        { 
            header: 'Employee ID', 
            accessor: 'employee_id',
            cell: (row) => <span className="text-sm font-mono text-slate-600 font-bold">{row.employee_id}</span>
        },
        { 
            header: 'Designation', 
            accessor: 'designation',
            cell: (row) => <span className="text-sm text-slate-600 font-medium">{row.designation}</span>
        },
        { 
            header: 'Department', 
            cell: (row) => {
                const dept = departments.find(d => d._id === row.department_id || d.code === row.department_id);
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{dept ? dept.name : (row.department_id || 'N/A')}</span>;
            }
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Faculty Management</h1>
                    <p className="text-slate-500 mt-1">Manage academic staff profiles and department assignments.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200">
                    <Plus className="h-4 w-4 mr-2" /> Add Faculty Profile
                </Button>
            </div>

            <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white">
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            className="pl-10 h-10 bg-slate-50 border-none rounded-xl" 
                            placeholder="Quick search..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="bg-white">
                    {loading ? (
                        <div className="p-20 text-center">
                            <Users className="h-12 w-12 text-slate-200 mx-auto mb-4 animate-pulse" />
                            <p className="text-slate-400 font-medium italic">Syncing with staff database...</p>
                        </div>
                    ) : filteredFaculties.length > 0 ? (
                        <Table 
                            columns={columns} 
                            data={filteredFaculties} 
                            keyField="_id" 
                            headerClassName="bg-slate-50/50 text-slate-500 uppercase tracking-widest text-[10px] font-black"
                            rowClassName="hover:bg-blue-50/30 transition-colors border-b border-slate-50 last:border-0"
                        />
                    ) : (
                        <div className="p-24 text-center">
                            <div className="h-24 w-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 transform -rotate-12 border border-slate-100 shadow-sm">
                                <Users className="h-12 w-12 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">No faculty records found</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mt-3 text-sm leading-relaxed">The faculty directory is currently empty. You can start by adding a new faculty profile or importing data.</p>
                            <div className="mt-8 flex justify-center space-x-3">
                                <Button onClick={() => setIsModalOpen(true)} size="lg" className="rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200">Create First Profile</Button>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Faculty Profile">
                <form onSubmit={handleCreate} className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                            <Input 
                                required 
                                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                            <Input 
                                required type="email"
                                placeholder="faculty@mgmcen.ac.in"
                                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Employee ID</label>
                            <Input 
                                required 
                                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                                value={formData.employee_id}
                                onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Designation</label>
                            <Input 
                                required 
                                placeholder="e.g. Assistant Professor"
                                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                                value={formData.designation}
                                onChange={(e) => setFormData({...formData, designation: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Department</label>
                            <select 
                                required
                                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                value={formData.department_id}
                                onChange={(e) => setFormData({...formData, department_id: e.target.value})}
                            >
                                <option value="">Select Department</option>
                                {departments.map(d => (
                                    <option key={d._id} value={d._id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-8">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-bold">Cancel</Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 px-8">Save Profile</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Faculty;
