import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/UI';
import { GraduationCap, DollarSign, TrendingUp, Activity, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
import api from '../../services/api';

// eslint-disable-next-line no-unused-vars
const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
    <Card className="p-6 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
        <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-[0.03] group-hover:opacity-[0.06] transition-opacity`} />
        <div className="relative">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-800 mt-2">{value}</h3>
                    {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
                </div>
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg`}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    </Card>
);

const AccountantDashboard = () => {
    const [stats, setStats] = useState({
        total_students: 0,
        fees_paid: 0,
        fees_partially_paid: 0,
        fees_unpaid: 0,
        total_fees_collected: 0,
        total_fees_due: 0,
        collection_percentage: 0
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [deptSummary, setDeptSummary] = useState({});

    const fetchDashboardData = async ({ silent = false } = {}) => {
        try {
            if (silent) setRefreshing(true);
            else setLoading(true);
            const [dashRes, deptRes] = await Promise.all([
                api.get('/accountant/dashboard'),
                api.get('/accountant/fee-summary')
            ]);
            
            setStats(dashRes.data);
            setDeptSummary(deptRes.data || {});
        } catch (error) {
            console.error("Error fetching data", error);
        } finally {
            if (silent) setRefreshing(false);
            else setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();

        // Keep department-wise summary up to date as payments are verified.
        const intervalId = setInterval(() => {
            // Avoid spamming requests if the tab is not visible.
            if (document.visibilityState === 'visible') {
                fetchDashboardData({ silent: true });
            }
        }, 15000);

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchDashboardData({ silent: true });
            }
        };
        window.addEventListener('focus', onVisibility);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', onVisibility);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    const pieData = [
        { name: 'Paid', value: stats.fees_paid, color: '#10b981' },
        { name: 'Partially Paid', value: stats.fees_partially_paid || 0, color: '#3b82f6' },
        { name: 'Unpaid', value: stats.fees_unpaid, color: '#ef4444' }
    ].filter(d => d.value > 0 || d.name !== 'Partially Paid'); // hide if 0 to keep pie clean

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(value);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Fee Collection Dashboard</h1>
                    <p className="text-slate-500 mt-1 text-lg">Track student fee payments and collection status.</p>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="px-4 py-2 bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm text-sm font-medium text-slate-600 flex items-center">
                        <Activity className="h-4 w-4 mr-2 text-violet-500" />
                        Collection Rate: <span className="ml-1 font-bold text-emerald-500">{stats.collection_percentage.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Students" 
                    value={stats.total_students} 
                    icon={GraduationCap} 
                    color="from-violet-500 to-indigo-600"
                    subtext="All enrolled students"
                />
                <StatCard 
                    title="Payment Received" 
                    value={stats.fees_paid + (stats.fees_partially_paid || 0)} 
                    icon={CheckCircle} 
                    color="from-emerald-500 to-teal-600"
                    subtext={`${stats.fees_paid} full / ${stats.fees_partially_paid || 0} partial`}
                />
                <StatCard 
                    title="Total Collected" 
                    value={formatCurrency(stats.total_fees_collected)} 
                    icon={TrendingUp} 
                    color="from-blue-500 to-cyan-600"
                    subtext="Total amount in bank"
                />
                <StatCard 
                    title="Total Dues" 
                    value={formatCurrency(stats.total_fees_due)} 
                    icon={CreditCard} 
                    color="from-amber-500 to-orange-600"
                    subtext="Outstanding balance"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Fee Distribution Pie Chart */}
                <Card className="p-8 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                        <DollarSign className="h-32 w-32" />
                    </div>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Payment Distribution</h3>
                            <p className="text-sm text-slate-500">Fee collection status</p>
                        </div>
                    </div>
                    <div className="h-72 w-full flex items-center justify-center">
                        {loading ? (
                            <div className="text-slate-400 italic">Loading chart...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip 
                                        formatter={(value) => `${value} students`}
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                {/* Summary Stats */}
                <Card className="p-8 lg:col-span-2 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                        <TrendingUp className="h-32 w-32" />
                    </div>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Collection Summary</h3>
                            <p className="text-sm text-slate-500">Department-wise fee collection status</p>
                        </div>
                        <div className="text-xs font-bold text-slate-400">
                            {refreshing ? 'Updating…' : null}
                        </div>
                    </div>
                    <div className="space-y-4">
                        {Object.entries(deptSummary).map(([deptName, data]) => (
                            <div key={deptName} className="group p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-bold text-slate-800 group-hover:text-violet-600 transition-colors">{deptName}</h4>
                                    <span className="text-sm font-bold text-emerald-600">{data.percentage_paid.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2.5">
                                    <div 
                                        className="bg-gradient-to-r from-violet-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500"
                                        style={{width: `${data.percentage_paid}%`}}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-slate-500 mt-2">
                                    <span>{data.fees_paid} paid / {data.total_students} total</span>
                                    <span>{data.fees_unpaid} pending</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <Card className="p-8 text-sm text-slate-600 border border-slate-200 bg-white">
                Student list and fee verification are now available in the <span className="font-semibold text-slate-800">Students</span> section.
            </Card>
        </div>
    );
};

export default AccountantDashboard;
