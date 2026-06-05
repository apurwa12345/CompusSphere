import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/UI';
import { Bell, Calendar, Mail, Info, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const UserNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                setLoading(true);
                const res = await api.get('/reports/notifications');
                setNotifications(res.data.items || res.data || []);
            } catch (error) {
                console.error('Failed to fetch notifications:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchNotifications();
    }, []);

    const getIcon = (role) => {
        if (role === 'All') return <Info className="h-5 w-5 text-blue-500" />;
        if (role === 'Direct') return <Mail className="h-5 w-5 text-violet-500" />;
        return <Bell className="h-5 w-5 text-orange-500" />;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Notifications</h1>
                <p className="text-slate-500 mt-1">Stay updated with the latest announcements and personal alerts.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 max-w-4xl">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                    </div>
                ) : notifications.length > 0 ? (
                    notifications.map((n, i) => (
                        <Card key={i} className="p-6 border-none shadow-lg shadow-slate-100 hover:shadow-slate-200 transition-all">
                            <div className="flex gap-6">
                                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                    n.target_role === 'All' ? 'bg-blue-50' : 
                                    n.target_role === 'Direct' ? 'bg-violet-50' : 'bg-orange-50'
                                }`}>
                                    {getIcon(n.target_role)}
                                </div>
                                <div className="space-y-1 flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-lg font-bold text-slate-800">{n.title}</h3>
                                        <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            {formatDate(n.created_at, 'Recent')}
                                        </div>
                                    </div>
                                    <p className="text-slate-600 leading-relaxed text-sm pt-2">{n.message}</p>
                                    <div className="pt-4 flex items-center space-x-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                                            Priority: {n.target_role === 'Direct' ? 'High' : 'Normal'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="py-24 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                        <Bell className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-900">No Notifications</h3>
                        <p className="text-slate-500 mt-1">You're all caught up! Check back later for new updates.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserNotifications;
