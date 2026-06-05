import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, ClipboardList, CheckSquare, Clock, Users, Ticket, 
  FileText, Edit3, ShieldCheck, AlertTriangle, 
  RefreshCcw, Layers, Eye, History, Settings,
  ArrowRight, TrendingUp
} from 'lucide-react';
import api from '../../services/api';
import { Card } from '../../components/common/UI';
import { formatDate } from '../../utils/dateUtils';

const dashboards = [
  { 
    title: 'SETUP & PLANNING',
    items: [
      { name: 'Timetable', path: '/examcell/timetable', icon: Clock, color: 'bg-emerald-500', desc: 'Subject-wise schedule' },
      { name: 'Seating Plan', path: '/examcell/seating', icon: Users, color: 'bg-pink-500', desc: 'Assign rooms and seats' },
    ]
  },
  {
    title: 'MARK ENTRY & VERIFICATION',
    items: [
      { name: 'Marks Verification by Faculty', path: '/examcell/marks-verify', icon: ShieldCheck, color: 'bg-cyan-500', desc: 'Review faculty forwarded marks' },
    ]
  },
  {
    title: 'RESULTS & REPORTING',
    items: [
      { name: 'Backlogs/ATKT', path: '/examcell/backlog', icon: AlertTriangle, color: 'bg-red-500', desc: 'Failed students tracker' },
      { name: 'Revaluation', path: '/examcell/revaluation', icon: RefreshCcw, color: 'bg-amber-500', desc: 'Process re-totaling requests' },
      { name: 'Supplementary', path: '/examcell/supplementary', icon: Layers, color: 'bg-sky-500', desc: 'Manage re-exam cycles' },
      { name: 'Publishing', path: '/examcell/result-publish', icon: Eye, color: 'bg-green-500', desc: 'Release results to portal' },
    ]
  }
];

export default function ExamCellDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_exams: 0, pending_forms: 0, published_results: 0 });
  const [recentApplications, setRecentApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);

  const fetchData = async () => {
    try {
      const res = await api.get('/dashboard/summary');
      setStats(res.data.stats || {});
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRecentApplications = async () => {
    setLoadingApps(true);
    try {
      const res = await api.get('/exam-forms/all?status=');
      const recentApps = (res.data || []).slice(0, 10);
      setRecentApplications(recentApps);
    } catch (e) {
      console.error('Failed to fetch recent applications:', e);
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchRecentApplications();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchData();
      fetchRecentApplications();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-violet-200 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-2">Exam Cell Command Center</h1>
          <div className="flex items-center justify-between mb-6">
            <p className="text-violet-100 max-w-lg">Manage the entire lifecycle of examinations from setup to result declaration.</p>
            <button 
              onClick={() => { fetchData(); fetchRecentApplications(); }}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors border border-white/20 flex items-center gap-2 text-sm font-bold"
            >
              <RefreshCcw className="w-4 h-4" /> Refresh
            </button>
          </div>
          <div className="flex gap-4">
             <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                <div className="text-3xl font-bold">{stats.total_exams || 0}</div>
                <div className="text-xs uppercase tracking-wider text-violet-200 font-bold">Active Exams</div>
             </div>
             <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                <div className="text-3xl font-bold">{stats.pending_forms || 0}</div>
                <div className="text-xs uppercase tracking-wider text-violet-200 font-bold">Pending Applications</div>
             </div>
             <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                <div className="text-3xl font-bold">{stats.published_results || 0}</div>
                <div className="text-xs uppercase tracking-wider text-violet-200 font-bold">Results Released</div>
             </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 scale-150">
           <Layers className="w-64 h-64" />
        </div>
      </div>

      {/* Recent Exam Form Submissions */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Recent Exam Form Submissions</h2>
            <span className="ml-auto text-xs font-semibold text-slate-500">Live Updates</span>
          </div>
          
          {loadingApps ? (
            <div className="text-center py-8 text-slate-500">Loading submissions...</div>
          ) : recentApplications.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No exam form submissions yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Student</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Exam</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Subjects</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Payment Method</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Payment Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">App Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentApplications.map((app) => (
                    <tr key={app._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{app.student_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{app.exam_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                          {(app.subjects || []).length}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          app.payment_method === 'qr' ? 'bg-blue-100 text-blue-700' :
                          app.payment_method === 'upi' ? 'bg-purple-100 text-purple-700' :
                          app.payment_method === 'netbanking' ? 'bg-green-100 text-green-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {app.payment_method === 'qr' ? 'QR Code' : 
                           app.payment_method === 'upi' ? 'UPI' :
                           app.payment_method === 'netbanking' ? 'Net Banking' :
                           'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          app.paymentStatus === 'LIKELY_VALID' ? 'bg-green-100 text-green-700' :
                          app.paymentStatus === 'SUSPICIOUS' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {app.paymentStatus?.replace(/_/g, ' ') || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          (app.status || 'Pending') === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                          app.status === 'Approved' ? 'bg-green-100 text-green-700' :
                          app.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {app.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatDate(app.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="flex justify-center pt-4">
            <button 
              onClick={() => navigate('/examcell/exam-forms')}
              className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              View All Submissions <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {dashboards.map((section, idx) => (
        <section key={idx} className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">{section.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {section.items.map((item, iidx) => (
              <button
                key={iidx}
                onClick={() => navigate(item.path)}
                className="group bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-indigo-50 hover:-translate-y-1 transition-all text-left relative overflow-hidden"
              >
                <div className={`p-2.5 rounded-xl ${item.color} w-fit mb-4 group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">{item.name}</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">{item.desc}</p>
                <div className="flex items-center text-[10px] font-bold text-violet-600 uppercase tracking-wider">
                  Go to module <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="absolute bottom-[-20px] right-[-20px] opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                   <item.icon className="w-24 h-24" />
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
