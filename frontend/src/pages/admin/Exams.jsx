import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { Plus, Calendar, Clock, MapPin, MoreHorizontal, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const Exams = () => {
    const [exams, setExams] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Applications Modal state
    const [isAppModalOpen, setIsAppModalOpen] = useState(false);
    const [applications, setApplications] = useState([]);
    const [selectedExamForApps, setSelectedExamForApps] = useState(null);
    const [appsLoading, setAppsLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        department_id: '',
        semester: 1,
        start_date: '',
        end_date: '',
        status: 'Upcoming'
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [exRes, dRes] = await Promise.all([
                api.get('/exam/'),
                api.get('/academic/departments')
            ]);
            setExams(exRes.data || []);
            setDepartments(dRes.data || []);
        } catch (error) {
            console.error(error);
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
            await api.post('/exam/', formData);
            setIsModalOpen(false);
            setFormData({ name: '', department_id: '', semester: 1, start_date: '', end_date: '', status: 'Upcoming' });
            fetchData();
        } catch (error) {
            console.error(error);
            alert('Failed to create exam session');
        }
    };

    const fetchApplications = async (exam) => {
        setSelectedExamForApps(exam);
        setIsAppModalOpen(true);
        setAppsLoading(true);
        try {
            const res = await api.get(`/exam/${exam._id}/applications`);
            setApplications(res.data || []);
        } catch (e) {
            console.error(e);
            alert('Failed to fetch applications');
        } finally {
            setAppsLoading(false);
        }
    };

    const handleUpdateAppStatus = async (appId, status) => {
        try {
            await api.patch(`/exam/application/${appId}/status`, { status });
            // Refresh
            const res = await api.get(`/exam/${selectedExamForApps._id}/applications`);
            setApplications(res.data || []);
        } catch (e) {
            console.error(e);
            alert('Failed to update status');
        }
    };

    const columns = [
        { 
            header: 'Exam Session', 
            cell: (row) => (
                <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shadow-sm shadow-indigo-100">
                        <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">{row.name}</p>
                        <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">Sem {row.semester}</p>
                    </div>
                </div>
            )
        },
        { 
            header: 'Schedule', 
            cell: (row) => (
                <div className="text-xs font-medium text-slate-600 flex flex-col space-y-1">
                    <span className="flex items-center"><Clock className="h-3 w-3 mr-1.5 text-slate-400" /> Starts: {row.start_date}</span>
                    <span className="flex items-center"><Clock className="h-3 w-3 mr-1.5 text-slate-400" /> Ends: {row.end_date}</span>
                </div>
            )
        },
        { 
            header: 'Status', 
            cell: (row) => {
                const statusStyles = {
                    'Upcoming': 'bg-blue-100 text-blue-700',
                    'Ongoing': 'bg-amber-100 text-amber-700',
                    'Completed': 'bg-emerald-100 text-emerald-700',
                    'Results Declared': 'bg-violet-100 text-violet-700'
                };
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${statusStyles[row.status] || 'bg-slate-100 text-slate-700'}`}>
                        {row.status === 'Completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {row.status}
                    </span>
                );
            }
        },
        {
            header: 'Actions',
            cell: (row) => (
                <button 
                    onClick={() => fetchApplications(row)}
                    className="px-3 py-1 bg-indigo-50 text-indigo-600 outline-none text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                >
                    View Applications
                </button>
            )
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Examination Management</h1>
                    <p className="text-slate-500 mt-1">Control exam windows, schedules, and result declarations.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-200">
                    <Plus className="h-4 w-4 mr-2" /> Schedule New Exam
                </Button>
            </div>

            <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
                <div className="bg-white">
                    {loading ? (
                        <div className="p-20 text-center">
                            <Calendar className="h-12 w-12 text-slate-200 mx-auto mb-4 animate-bounce" />
                            <p className="text-slate-400 font-medium">Loading session data...</p>
                        </div>
                    ) : (
                        <Table 
                            columns={columns} 
                            data={exams} 
                            keyField="_id" 
                            headerClassName="bg-slate-50/50 text-slate-500 uppercase tracking-widest text-[10px] font-black"
                            rowClassName="hover:bg-indigo-50/30 transition-colors border-b border-slate-50 last:border-0"
                        />
                    )}
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule Exam Period">
                <form onSubmit={handleCreate} className="space-y-6 pt-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Session Name</label>
                        <Input 
                            required 
                            placeholder="e.g. End Semester - Fall 2025"
                            className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-indigo-500/20"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Department</label>
                                {formData.semester <= 2 && (
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData({...formData, department_id: 'ALL'})}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-full transition-colors"
                                    >
                                        Set to ALL (1st Year)
                                    </button>
                                )}
                            </div>
                            <select 
                                required
                                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                value={formData.department_id}
                                onChange={(e) => setFormData({...formData, department_id: e.target.value})}
                            >
                                <option value="">Select Department</option>
                                {formData.semester <= 2 && (
                                    <option value="ALL" className="font-bold text-indigo-600 bg-indigo-50">All Departments (First Year)</option>
                                )}
                                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Semester</label>
                            <Input 
                                required type="number" min="1" max="8"
                                className="h-11 rounded-xl border-slate-200"
                                value={formData.semester}
                                onChange={(e) => setFormData({...formData, semester: parseInt(e.target.value)})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Start Date</label>
                            <Input 
                                required type="date"
                                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-indigo-500/20"
                                value={formData.start_date}
                                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">End Date</label>
                            <Input 
                                required type="date"
                                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-indigo-500/20"
                                value={formData.end_date}
                                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                            />
                        </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-8">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-bold">Cancel</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 px-8">Confirm Schedule</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isAppModalOpen} onClose={() => setIsAppModalOpen(false)} title="Student Exam Applications" size="2xl">
                <div className="pt-4 space-y-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <h3 className="font-bold text-slate-800">{selectedExamForApps?.name}</h3>
                        <p className="text-sm text-slate-500">Review pending exam forms and fees.</p>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto pr-2">
                        {appsLoading ? (
                            <p className="text-center text-slate-400 py-10">Loading applications...</p>
                        ) : applications.length === 0 ? (
                            <p className="text-center text-slate-400 py-10">No applications submitted yet.</p>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="py-3 text-xs font-black text-slate-400 uppercase">Student</th>
                                        <th className="py-3 text-xs font-black text-slate-400 uppercase">Fees</th>
                                        <th className="py-3 text-xs font-black text-slate-400 uppercase">Status</th>
                                        <th className="py-3 text-xs font-black text-slate-400 uppercase text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {applications.map(app => (
                                        <tr key={app._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                            <td className="py-3">
                                                <p className="text-sm font-bold text-slate-700">{app.student_name}</p>
                                                <p className="text-xs text-slate-400">{app.enrollment_no}</p>
                                            </td>
                                            <td className="py-3">
                                                {app.fees_paid ? (
                                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-center">Paid</span>
                                                ) : (
                                                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-center">Pending</span>
                                                )}
                                            </td>
                                            <td className="py-3">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                                    app.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                                    app.status === 'Rejected' ? 'bg-rose-100 text-rose-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {app.status}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right space-x-2">
                                                {(app.status === 'Pending' || app.status === 'Rejected') && (
                                                    <>
                                                        <button onClick={() => handleUpdateAppStatus(app._id, 'Approved')} className="text-xs px-3 py-1 font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded">Approve</button>
                                                        {app.status === 'Pending' && (
                                                            <button onClick={() => handleUpdateAppStatus(app._id, 'Rejected')} className="text-xs px-3 py-1 font-bold text-white bg-rose-500 hover:bg-rose-600 rounded">Reject</button>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Exams;
