import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/UI';
import { Users, BookOpen, GraduationCap, Building, Activity, ArrowUpRight, TrendingUp, Bell } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import api from '../../services/api';

const StatCard = ({ title, value, icon: Icon, color, trend }) => (
    <Card className="p-6 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
        <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-[0.03] group-hover:opacity-[0.06] transition-opacity`} />
        <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-800 mt-1">{value}</h3>
                </div>
            </div>
            {trend && (
                <div className="flex items-center space-x-1 text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-bold">
                    <TrendingUp className="h-3 w-3" />
                    <span>{trend}</span>
                </div>
            )}
        </div>
    </Card>
);

const AdminDashboard = () => {
    const [stats, setStats] = useState({
        students: 0,
        faculty: 0,
        departments: 0,
        courses: 0
    });
    const [chartData, setChartData] = useState([]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                setLoading(true);
                const res = await api.get('/dashboard/summary');
                setStats(res.data.stats || {});
                setChartData(res.data.charts?.students_by_department || []);
                setActivity(res.data.activity || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Overview</h1>
                    <p className="text-slate-500 mt-1 text-lg">Central hub for academic and administrative control.</p>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="px-4 py-2 bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm text-sm font-medium text-slate-600 flex items-center">
                        <Activity className="h-4 w-4 mr-2 text-violet-500" />
                        System Status: <span className="ml-1 text-emerald-500 font-bold">Optimal</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Students" value={stats.students} icon={GraduationCap} color="from-violet-500 to-indigo-600" trend="+12%" />
                <StatCard title="Total Faculty" value={stats.faculty} icon={Users} color="from-blue-500 to-cyan-600" trend="+5%" />
                <StatCard title="Departments" value={stats.departments} icon={Building} color="from-emerald-500 to-teal-600" />
                <StatCard title="Active Courses" value={stats.courses} icon={BookOpen} color="from-amber-500 to-orange-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="p-8 lg:col-span-2 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                        <TrendingUp className="h-32 w-32" />
                    </div>
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Department-wise Result Analysis</h3>
                            <p className="text-sm text-slate-500">Performance distribution across departments</p>
                        </div>
                        <button className="text-violet-600 hover:text-violet-700 font-bold text-sm flex items-center">
                            View Report <ArrowUpRight className="h-4 w-4 ml-1" />
                        </button>
                    </div>
                    {loading ? (
                        <div className="h-80 w-full flex items-center justify-center text-slate-400 italic">Computing data...</div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">This snapshot highlights your strongest departments and helps identify where resource planning should focus next.</p>
                            {chartData.length === 0 ? (
                                <div className="h-72 w-full flex items-center justify-center text-slate-400 italic">No department data available yet.</div>
                            ) : (
                                <div className="space-y-4">
                                    {chartData.slice(0, 5).map((dept, index) => {
                                        const count = dept.students || 0;
                                        const maxCount = Math.max(...chartData.map((item) => item.students || 0), 1);
                                        const width = Math.round((count / maxCount) * 100);
                                        return (
                                            <div key={`${dept.name}-${index}`} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">{dept.name || 'Unknown Department'}</p>
                                                        <p className="text-xs text-slate-500 mt-1">Student strength: <span className="font-semibold text-slate-900">{count}</span></p>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-500">Rank #{index + 1}</span>
                                                </div>
                                                <div className="mt-4 rounded-full bg-slate-200 h-3 overflow-hidden">
                                                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${width}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </Card>
                
                <Card className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center">
                            <Bell className="h-5 w-5 mr-3 text-violet-500" />
                            Recent Activity
                        </h3>
                    </div>
                    <div className="space-y-6">
                        {activity.length > 0 ? activity.slice(0, 6).map((a, i) => (
                            <div key={i} className="flex items-start space-x-4 group cursor-pointer">
                                <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-50 group-hover:border-violet-100 transition-colors">
                                    <Activity className="h-5 w-5 text-slate-400 group-hover:text-violet-500" />
                                </div>
                                <div className="flex-1 pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-bold text-slate-800 group-hover:text-violet-600 transition-colors">{a.title || 'System Update'}</p>
                                        <span className="text-[10px] text-slate-400 font-medium">Just now</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{a.message || 'Automated system task completed successfully.'}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                                <Activity className="h-12 w-12 text-slate-300 mb-4" />
                                <p className="text-sm text-slate-500 italic font-medium">No activity captured yet</p>
                            </div>
                        )}
                    </div>
                    {activity.length > 0 && (
                        <button className="w-full mt-8 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition-colors">
                            VIEW ALL ACTIVITY
                        </button>
                    )}
                </Card>
            </div>

        </div>
    );
};

export default AdminDashboard;
