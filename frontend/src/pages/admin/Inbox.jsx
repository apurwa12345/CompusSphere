import React, { useEffect, useState } from 'react';
import { Card, Button } from '../../components/common/UI';
import { Bell, Send, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const Inbox = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchInbox = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await api.get('/reports/notifications', {
                params: { page: 1, per_page: 50, source: 'contact_form' }
            });

            setItems(res.data?.items || []);
        } catch (e) {
            setError('Failed to load inbox messages.');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInbox();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Inbox</h1>
                    <p className="text-slate-500 mt-1">Messages received from the "Get in Touch" form.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="ghost"
                        className="h-10"
                        onClick={fetchInbox}
                        disabled={loading}
                    >
                        <Send className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 border border-red-100 p-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="space-y-6">
                {loading ? (
                    <div className="py-20 text-center text-slate-400 italic">Retrieving inbox...</div>
                ) : items.length > 0 ? (
                    items.map((m, i) => (
                        <Card
                            key={m?._id || i}
                            className="p-6 border-none shadow-lg shadow-slate-100 hover:shadow-slate-200 transition-all"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center space-x-3">
                                    <Bell className="h-5 w-5 text-violet-500" />
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800">
                                            {m.title || 'Contact Request'}
                                        </h2>
                                        <p className="text-xs text-slate-400">
                                            {formatDate(m.created_at, 'Just now')}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="text-slate-200"
                                    title="Delete (not implemented)"
                                    onClick={() => {}}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <p className="text-slate-500 text-sm mt-3 whitespace-pre-line leading-relaxed">
                                {m.message}
                            </p>
                        </Card>
                    ))
                ) : (
                    <div className="py-20 text-center rounded-3xl border-2 border-dashed border-slate-100">
                        <Bell className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 text-sm font-medium">No inbox messages yet</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inbox;

