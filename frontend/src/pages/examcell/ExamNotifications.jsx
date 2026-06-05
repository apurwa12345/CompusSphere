import React, { useState, useEffect } from 'react';
import { Send, Bell, Calendar, Info, Mail } from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

export default function ExamNotifications() {
  const [form, setForm] = useState({ title: '', message: '', target: 'all', type: 'Exam' });
  const [exams, setExams] = useState([]);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);

  const [received, setReceived] = useState([]);
  const [loadingReceived, setLoadingReceived] = useState(true);

  const fetchReceived = async () => {
    try {
      setLoadingReceived(true);
      const res = await api.get('/reports/notifications');
      setReceived(res.data.items || res.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoadingReceived(false);
    }
  };

  useEffect(() => {
    api.get('/exam-setup/').then(r => setExams(r.data)).catch(console.error);
    fetchReceived();
  }, []);

  const getIcon = (role) => {
    if (role === 'All') return <Info className="h-5 w-5 text-blue-500" />;
    if (role === 'Direct') return <Mail className="h-5 w-5 text-violet-500" />;
    return <Bell className="h-5 w-5 text-orange-500" />;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const r = await api.post('/exam-notifications/send', form);
      alert(r.data.message);
      setForm({ title: '', message: '', target: 'all', type: 'Exam' });
    } catch (err) { alert(err.response?.data?.message || 'Failed to send'); } finally { setSending(false); }
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Exam Notifications</h1>
        <p className="text-slate-500 text-sm mt-1">Send targeted alerts to students</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Compose form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-violet-600" /> Compose Notification</h3>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="e.g. Hall Tickets Released" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message *</label>
              <textarea required rows={4} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" placeholder="Notification message..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target</label>
                <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="all">All Students</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={`semester:${n}`}>Semester {n}</option>)}
                  {exams.map(e => <option key={e._id} value={`exam:${e._id}`}>Exam: {e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option>Exam</option><option>Result</option><option>Hall Ticket</option><option>General</option><option>Urgent</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={sending} className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
              <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send Notification'}
            </button>
          </form>
        </div>

        {/* Quick templates */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Quick Templates</h3>
          <div className="space-y-2">
            {[
              { title: 'Hall Tickets Released', message: 'Hall tickets are now available. Please download from your student portal.', type: 'Hall Ticket' },
              { title: 'Exam Tomorrow Reminder', message: 'Your exam is scheduled for tomorrow. Please carry your hall ticket and college ID.', type: 'Exam' },
              { title: 'Results Published', message: 'Exam results are now published. Login to your portal to view your results.', type: 'Result' },
              { title: 'Revaluation Deadline', message: 'Last date to apply for revaluation is approaching. Apply before the deadline.', type: 'Urgent' },
            ].map((t, i) => (
              <button key={i} onClick={() => setForm({ ...form, title: t.title, message: t.message, type: t.type })}
                className="w-full text-left p-3 border border-slate-200 rounded-lg hover:border-violet-300 hover:bg-violet-50 transition-colors group">
                <div className="font-medium text-slate-700 text-sm group-hover:text-violet-700">{t.title}</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">{t.message}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Received Notifications Section */}
      <div className="mt-12 border-t border-slate-200 pt-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Bell className="w-5 h-5 text-violet-600" /> Received Notifications
        </h2>
        
        <div className="grid grid-cols-1 gap-4 max-w-4xl">
          {loadingReceived ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
            </div>
          ) : received.length > 0 ? (
            received.map((n, i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex gap-5">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  n.target_role === 'All' ? 'bg-blue-50' : 
                  n.target_role === 'Direct' ? 'bg-violet-50' : 'bg-orange-50'
                }`}>
                  {getIcon(n.target_role)}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="text-base font-bold text-slate-800">{n.title}</h3>
                    <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(n.created_at, 'Recent')}
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-sm pt-1">{n.message}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-16 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No Notifications</h3>
              <p className="text-slate-500 text-sm mt-1">You're all caught up!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
