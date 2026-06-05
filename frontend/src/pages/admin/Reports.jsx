import React, { useState, useEffect } from 'react';
import { Card, Button } from '../../components/common/UI';
import { FileText, Download, BarChart3, PieChart, TrendingUp, Users, BookOpen, GraduationCap } from 'lucide-react';
import api from '../../services/api';

const Reports = () => {
    const [stats, setStats] = useState({
        students: 0,
        faculty: 0,
        departments: 0,
        courses: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const res = await api.get('/dashboard/summary');
                setStats(res.data.stats || {});
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const handleExport = async (type) => {
        try {
            const res = await api.get(`/reports/${type}?export=true`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${type}_report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error(error);
            alert('Export failed');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reports & Analytics</h1>
                    <p className="text-slate-500 mt-1">Export data and visualize academic performance metrics.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-8 bg-white border-none shadow-xl shadow-slate-100 flex flex-col justify-between">
                    <div>
                        <div className="h-12 w-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mb-6">
                            <FileText className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Student Directory</h3>
                        <p className="text-slate-500 text-sm mt-2">Comprehensive list of all enrolled students with contact info and department data.</p>
                    </div>
                    <Button onClick={() => handleExport('students')} className="mt-8 rounded-xl font-bold bg-slate-800 hover:bg-black text-white py-6">
                        <Download className="h-4 w-4 mr-2" /> Export CSV
                    </Button>
                </Card>

                <Card className="p-8 bg-white border-none shadow-xl shadow-slate-100 flex flex-col justify-between">
                    <div>
                        <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6">
                            <Users className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Faculty Payroll Prep</h3>
                        <p className="text-slate-500 text-sm mt-2">List of all faculty members, designations, and employee IDs for administrative use.</p>
                    </div>
                    <Button onClick={() => handleExport('faculty')} className="mt-8 rounded-xl font-bold bg-slate-800 hover:bg-black text-white py-6">
                        <Download className="h-4 w-4 mr-2" /> Generate View
                    </Button>
                </Card>

                <Card className="p-8 bg-white border-none shadow-xl shadow-slate-100 flex flex-col justify-between">
                    <div>
                        <div className="h-12 w-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-6">
                            <BookOpen className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Academic Catalog</h3>
                        <p className="text-slate-500 text-sm mt-2">Export current subjects, credit distributions, and departmental course mappings.</p>
                    </div>
                    <Button onClick={() => handleExport('subjects')} className="mt-8 rounded-xl font-bold bg-slate-800 hover:bg-black text-white py-6">
                        <Download className="h-4 w-4 mr-2" /> Download Catalog
                    </Button>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-8 border-none shadow-xl shadow-slate-200/50">
                    <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center">
                        <BarChart3 className="h-5 w-5 mr-3 text-violet-500" />
                        Enrollment Snapshot
                    </h3>
                    <div className="space-y-6">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                            <div className="flex items-center">
                                <GraduationCap className="h-10 w-10 text-violet-200 mr-4" />
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total Students</p>
                                    <p className="text-2xl font-black text-slate-800">{stats.students}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">+12% vs last year</p>
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                            <div className="flex items-center">
                                <Users className="h-10 w-10 text-emerald-200 mr-4" />
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total Faculty</p>
                                    <p className="text-2xl font-black text-slate-800">{stats.faculty}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">+3.5% vs last year</p>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="p-8 border-none shadow-xl shadow-slate-200/50 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <TrendingUp className="h-40 w-40" />
                    </div>
                    <div className="relative">
                        <h3 className="text-xl font-bold mb-2">Performance Insights</h3>
                        <p className="text-slate-400 text-sm mb-12">Aggregate academic performance across all departments.</p>
                        
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <p className="text-3xl font-black">{stats.performance?.completion_rate || 0}%</p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Completion Rate</p>
                            </div>
                            <div>
                                <p className="text-3xl font-black">{stats.performance?.avg_cgpa?.toFixed(2) || '0.00'}</p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Average CGPA</p>
                            </div>
                            <div>
                                <p className="text-3xl font-black">{stats.performance?.publications || 0}</p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Research Publications</p>
                            </div>
                            <div>
                                <p className="text-3xl font-black">
                                    {stats.performance?.total_exams > 999 ? `${(stats.performance.total_exams / 1000).toFixed(1)}k` : stats.performance?.total_exams || 0}
                                </p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total Exams Taken</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Reports;
