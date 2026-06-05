import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import { Bell, Send, Users, User, Share2, Trash2, Megaphone } from 'lucide-react';
import api from '../../services/api';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        target_role: 'All',
        target_email: ''
    });
    const [status, setStatus] = useState(null);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const res = await api.get('/reports/notifications');
            setNotifications(res.data.items || res.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleBroadcast = async (e) => {
        e.preventDefault();
        try {
            await api.post('/reports/notifications', formData);
            setStatus({ type: 'success', message: 'Notification broadcasted successfully!' });
            setFormData({ title: '', message: '', target_role: 'All', target_email: '' });
            fetchNotifications();
            setTimeout(() => setStatus(null), 3000);
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: 'Failed to send notification' });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Announcements</h1>
                <p className="text-slate-500 mt-1">Broadcast important updates to students, faculty, or individual users.</p>
            </div>

            <div className="max-w-3xl">
                <Card className="p-8 border-none shadow-xl shadow-slate-200/50">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                        <Megaphone className="h-5 w-5 mr-3 text-orange-500" />
                        Compose Announcement
                    </h3>
                    
                    <form onSubmit={handleBroadcast} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Subject / Title</label>
                            <Input 
                                required 
                                placeholder="e.g. Campus Holiday Notice"
                                className="h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-orange-500/20"
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Target Audience</label>
                            <div className="grid grid-cols-2 gap-4">
                                <select 
                                    className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    value={formData.target_role}
                                    onChange={(e) => setFormData({...formData, target_role: e.target.value})}
                                >
                                    <option value="All">Everyone</option>
                                    <option value="Student">All Students</option>
                                    <option value="Faculty">All Faculty</option>
                                    <option value="Exam Cell">Exam Cell Only</option>
                                    <option value="Accountant">Accountant Only</option>
                                    <option value="Direct">Specific User</option>
                                </select>
                                {formData.target_role === 'Direct' && (
                                    <Input 
                                        required
                                        placeholder="User email address"
                                        className="h-12 rounded-xl border-slate-200"
                                        value={formData.target_email}
                                        onChange={(e) => setFormData({...formData, target_email: e.target.value})}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Message Content</label>
                            <textarea 
                                required
                                rows={5}
                                className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                                placeholder="Type your announcement here..."
                                value={formData.message}
                                onChange={(e) => setFormData({...formData, message: e.target.value})}
                            />
                        </div>

                        {status && (
                            <div className={`p-4 rounded-xl flex items-center space-x-3 ${
                                status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                                <p className="text-sm font-bold">{status.message}</p>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button size="lg" className="rounded-2xl font-bold bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-200 px-10 h-14">
                                Send Broadcast <Send className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default Notifications;
