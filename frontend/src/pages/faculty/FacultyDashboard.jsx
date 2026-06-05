import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/UI';
import { BookOpen, ClipboardList, Bell, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const FacultyDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ subjects: 0, assigned_evaluations: 0, exams: 0 });
    const [subjects, setSubjects] = useState([]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await api.get('/dashboard/summary');
                setStats(res.data.stats || {});
                setSubjects(res.data.charts?.subjects_preview || []);
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
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome, {user?.name || 'Faculty Member'}!</h1>
                    <p className="text-slate-500">Academic staff portal and evaluation overview.</p>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column (primary) */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6 flex items-center space-x-4">
                        <div className="p-4 rounded-full bg-primary">
                            <BookOpen className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Assigned Subjects</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.subjects}</h3>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                            <BookOpen className="h-5 w-5 mr-3 text-indigo-500" />
                            My Assigned Subjects
                        </h3>
                        <div className="space-y-3">
                            {subjects.length > 0 ? subjects.map((sub, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100/50 hover:bg-slate-100 transition-colors">
                                    <span className="text-sm font-bold text-slate-700">{sub.name} {sub.code ? `(${sub.code})` : ''}</span>
                                    <span className="text-xs text-indigo-600 font-black bg-indigo-50 px-3 py-1 rounded-lg">Sem {sub.semester || 1}</span>
                                </div>
                            )) : (
                                <p className="text-sm text-slate-500 italic py-4">No subjects assigned yet.</p>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right column (actions + feed) */}
                <div className="lg:col-span-1 space-y-6">
                    <button type="button" onClick={() => navigate('/faculty/marks')} className="text-left w-full">
                        <Card className="p-6 h-full hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-200/60">
                                        <ClipboardList className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Marks</p>
                                        <h3 className="text-base font-extrabold text-slate-800 mt-1">Resume Updating Marks</h3>
                                        <p className="text-xs text-slate-500 mt-1">Continue entry for your subjects.</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-400 mt-1" />
                            </div>
                        </Card>
                    </button>

                    <button type="button" onClick={() => navigate('/faculty/notifications')} className="text-left w-full">
                        <Card className="p-6 h-full hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-200/60">
                                        <Bell className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Inbox</p>
                                        <h3 className="text-base font-extrabold text-slate-800 mt-1">Notifications</h3>
                                        <p className="text-xs text-slate-500 mt-1">Announcements and reminders.</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-400 mt-1" />
                            </div>
                        </Card>
                    </button>

                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                            <Bell className="h-5 w-5 mr-3 text-violet-500" />
                            Recent Activity
                        </h3>
                        <div className="space-y-3">
                            {loading ? (
                                <p className="text-sm text-slate-400 italic py-4">Loading activity...</p>
                            ) : activity.length > 0 ? activity.slice(0, 5).map((a, i) => (
                                <div key={i} className="flex items-start space-x-3 pb-3 border-b border-slate-100 last:border-0">
                                    <div className="h-2.5 w-2.5 mt-2 rounded-full bg-violet-500 flex-shrink-0"></div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-slate-700">{a.title || 'Update'}</p>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                                                {formatDate(a.created_at, 'Just now')}
                                            </p>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">{a.message || 'No additional details.'}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                                    <p className="text-sm font-semibold text-slate-700">All caught up</p>
                                    <p className="text-xs text-slate-500 mt-1">No new activity right now.</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default FacultyDashboard;
