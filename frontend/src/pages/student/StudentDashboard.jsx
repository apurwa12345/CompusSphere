import React, { useState, useEffect } from 'react';
import { Card, Button } from '../../components/common/UI';
import { useAuth } from '../../context/AuthContext';
import { GraduationCap, Calendar, FileText, Download, Bell, Wallet } from 'lucide-react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../utils/dateUtils';

const StudentDashboard = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [stats, setStats] = useState({ current_semester: 'N/A', upcoming_exams: 0, cgpa: 0.0 });
    const [currentMarks, setCurrentMarks] = useState([]);
    const [feeStatus, setFeeStatus] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get('/dashboard/summary');
                setStats(res.data.stats || stats);
                setNotifications(res.data.activity || []);
            } catch (e) { console.error(e); }
        };
        fetchData();

        const fetchFeeStatus = async () => {
            try {
                const res = await api.get('/accountant/my-fee-status');
                setFeeStatus(res.data || null);
            } catch (e) {
                // Non-blocking: dashboard should still load even if fee status fails.
                console.error(e);
            }
        };
        fetchFeeStatus();

        const fetchCurrentMarks = async () => {
            try {
                const examRes = await api.get('/exam/');
                let internalExam = examRes.data.find(e => e.exam_type === 'Internal' && ['Upcoming', 'Ongoing'].includes(e.status));
                if (!internalExam) {
                    internalExam = examRes.data.find(e => e.name && e.name.toLowerCase().includes('internal'));
                }
                const examId = internalExam?._id || 'periodic_test_1';
                const marksRes = await api.get(`/internal-marks/my-results/${examId}?exam_type=periodic_test_1`);
                setCurrentMarks(marksRes.data.filter(mark => mark.marks > 0));
            } catch (e) {
                console.error(e);
            }
        };
        fetchCurrentMarks();
    }, []);

    const formatINR = (val) =>
        new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(Number(val || 0));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome, {user?.name || 'Student'}!</h1>
                    <p className="text-slate-500">Your academic portal at a glance.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <Card className="p-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-white opacity-90" />
                    <div className="relative flex items-center space-x-4">
                        <div className="p-4 rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-200/60">
                            <GraduationCap className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400">Current Semester</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.current_semester}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-white opacity-90" />
                    <div className="relative flex items-center space-x-4">
                        <div className="p-4 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-200/60">
                            <Calendar className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400">Upcoming Exams</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.upcoming_exams}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-white opacity-90" />
                    <div className="relative flex items-center space-x-4">
                        <div className="p-4 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200/60">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400">CGPA</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.cgpa}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-white opacity-90" />
                    <div className="relative flex items-center space-x-4">
                        <div className="p-4 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-200/60">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400">Current Marks</p>
                            <h3 className="text-2xl font-bold text-slate-800">{currentMarks.length}</h3>
                            <p className="text-xs text-slate-500">Subjects with marks</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-50 via-white to-white opacity-90" />
                    <div className="relative flex items-center space-x-4">
                        <div className="p-4 rounded-2xl bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-200/60">
                            <Wallet className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400">Remaining Fees</p>
                            <h3 className="text-2xl font-bold text-slate-800">
                                {feeStatus ? formatINR(feeStatus.remaining_amount) : '—'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {feeStatus?.fee_status ? `Status: ${feeStatus.fee_status}` : ' '}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Quick Actions</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => navigate('/student/exams')} className="flex flex-col items-start gap-3 p-4 bg-white/80 border border-white/70 rounded-2xl hover:bg-white transition-colors shadow-sm">
                            <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-semibold text-slate-800">Apply for Exam</span>
                            <span className="text-xs text-slate-500">Open the exam window</span>
                        </button>
                        <button type="button" onClick={() => navigate('/student/exams')} className="flex flex-col items-start gap-3 p-4 bg-white/80 border border-white/70 rounded-2xl hover:bg-white transition-colors shadow-sm">
                            <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                <Download className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-semibold text-slate-800">Hall Ticket</span>
                            <span className="text-xs text-slate-500">Download admit card</span>
                        </button>
                        <button type="button" onClick={() => navigate('/student/results')} className="flex flex-col items-start gap-3 p-4 bg-white/80 border border-white/70 rounded-2xl hover:bg-white transition-colors shadow-sm">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                <FileText className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-semibold text-slate-800">View Results</span>
                            <span className="text-xs text-slate-500">Recent exam results</span>
                        </button>
                        <button type="button" onClick={() => navigate('/student/profile')} className="flex flex-col items-start gap-3 p-4 bg-white/80 border border-white/70 rounded-2xl hover:bg-white transition-colors shadow-sm">
                            <div className="h-10 w-10 rounded-xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center">
                                <GraduationCap className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-semibold text-slate-800">My Profile</span>
                            <span className="text-xs text-slate-500">Personal information</span>
                        </button>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-800 flex items-center"><Bell className="h-5 w-5 mr-2 text-violet-500" /> Notifications</h3>
                    </div>
                    <div className="space-y-3">
                        {notifications.length > 0 ? notifications.slice(0, 5).map((n, i) => (
                            <div key={i} className="flex items-start space-x-3 pb-3 border-b border-slate-100 last:border-0">
                                <div className="h-2.5 w-2.5 mt-2 rounded-full bg-violet-500 flex-shrink-0"></div>
                                <div>
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-slate-700">{n.title}</p>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">{formatDate(n.created_at, 'Just now')}</p>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                                <p className="text-sm font-semibold text-slate-700">All caught up</p>
                                <p className="text-xs text-slate-500 mt-1">No new notifications right now.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default StudentDashboard;