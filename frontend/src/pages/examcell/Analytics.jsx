import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, Trophy, TrendingUp, PieChart as PieIcon, Activity } from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip 
} from 'recharts';
import api from '../../services/api';

const COLORS = ['#10b981', '#ef4444', '#6366f1', '#f59e0b', '#3b82f6'];

export default function Analytics() {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [summary, setSummary] = useState(null);
  const [toppers, setToppers] = useState([]);
  const [subjectAnalysis, setSubjectAnalysis] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { 
    api.get('/exam-setup/')
      .then(r => {
        const data = Array.isArray(r.data) ? r.data : [];
        setExams(data);
        if (data.length > 0 && !selectedExam) {
          setSelectedExam(data[0]._id);
        }
      })
      .catch(console.error); 
  }, []);

  useEffect(() => {
    if (!selectedExam) return;
    setLoading(true);
    Promise.all([
      api.get(`/analytics/exam/${selectedExam}/summary`),
      api.get(`/analytics/exam/${selectedExam}/toppers?limit=10`),
      api.get(`/analytics/exam/${selectedExam}/subject-analysis`)
    ]).then(([s, t, sa]) => { 
      setSummary(s.data); 
      setToppers(t.data); 
      setSubjectAnalysis(sa.data); 
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, [selectedExam]);

  const pieData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: 'Passed', value: summary.passed || 0 },
      { name: 'Failed', value: summary.failed || 0 }
    ];
  }, [summary]);

  const barData = useMemo(() => {
    return subjectAnalysis.map(s => ({
      name: s.subject_name.length > 15 ? s.subject_name.substring(0, 15) + '...' : s.subject_name,
      fullName: s.subject_name,
      rate: parseFloat(s.pass_rate) || 0
    }));
  }, [subjectAnalysis]);

  return (
    <div className="space-y-8 p-8 bg-slate-50/30 min-h-screen animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-8 h-8 text-violet-600" />
            Performance Analytics
          </h1>
          <p className="text-slate-500 text-sm mt-1">Deep dive into exam results, subject trends, and student excellence.</p>
        </div>

        <select 
          value={selectedExam} 
          onChange={e => setSelectedExam(e.target.value)} 
          className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all min-w-[280px]"
        >
          <option value="">— Select Exam Session —</option>
          {exams.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Generating Reports...</p>
        </div>
      ) : summary ? (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Students', value: summary.total_students, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Total Passed', value: summary.passed, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Total Failed', value: summary.failed, icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50' },
              { label: 'Average SGPA', value: summary.average_sgpa?.toFixed(2) || '0.00', icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50' }
            ].map(c => (
              <div key={c.label} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl ${c.bg} ${c.color}`}><c.icon className="w-6 h-6" /></div>
                  <div className="text-3xl font-black text-slate-800 tracking-tight">{c.value}</div>
                </div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Overall Pass/Fail Pie Chart */}
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <PieIcon className="w-5 h-5 text-violet-500" />
                  Overall Pass/Fail Distribution
                </h3>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={8}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1500}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50 text-center">
                  <div className="text-2xl font-black text-emerald-600">{summary.pass_rate}%</div>
                  <div className="text-[10px] font-bold uppercase text-emerald-500 tracking-wider">Pass Rate</div>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50 text-center">
                  <div className="text-2xl font-black text-rose-600">{summary.fail_rate}%</div>
                  <div className="text-[10px] font-bold uppercase text-rose-500 tracking-wider">Fail Rate</div>
                </div>
              </div>
            </div>

            {/* Subject Pass Rate Bar Chart */}
            <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Subject-wise Pass Rates
                </h3>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} unit="%" />
                    <RechartsTooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value) => [`${value}%`, 'Pass Rate']}
                    />
                    <Bar dataKey="rate" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-4 text-center text-xs text-slate-400 italic font-medium">Comparison of pass percentages across all subjects in this exam.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Subject Analysis Table */}
            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
              <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white">
                <h3 className="font-black text-slate-800 text-lg tracking-tight">Subject Detail Matrix</h3>
                <div className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">{subjectAnalysis.length} Subjects Analyzed</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 text-slate-500 uppercase tracking-widest text-[10px] font-black">
                    <tr>{['Subject', 'Total', 'Passed', 'Failed', 'Pass Rate', 'Avg Marks', 'Absent'].map(h => <th key={h} className="px-8 py-4 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {subjectAnalysis.map(s => (
                      <tr key={s.subject_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-4 font-bold text-slate-800">{s.subject_name}</td>
                        <td className="px-8 py-4 text-slate-500">{s.total}</td>
                        <td className="px-8 py-4 text-emerald-600 font-black">{s.passed}</td>
                        <td className="px-8 py-4 text-rose-500 font-black">{s.failed}</td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-violet-500 h-full" style={{ width: `${s.pass_rate}%` }} />
                            </div>
                            <span className="font-black text-violet-700">{s.pass_rate}%</span>
                          </div>
                        </td>
                        <td className="px-8 py-4 font-mono text-slate-600">{s.average_marks}</td>
                        <td className="px-8 py-4 text-orange-500 font-bold">{s.absent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Toppers Section */}
            {toppers.length > 0 && (
              <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                <div className="px-8 py-6 border-b border-slate-50 bg-white flex items-center justify-between">
                  <h3 className="font-black text-slate-800 text-lg tracking-tight flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-amber-500" />
                    Top Performing Students
                  </h3>
                  <div className="text-xs font-bold text-slate-400">Merit List (Top 10)</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 text-slate-500 uppercase tracking-widest text-[10px] font-black">
                      <tr>{['Rank', 'Student Name', 'Enrollment', 'SGPA Result', 'Final Status'].map(h => <th key={h} className="px-8 py-4 text-left">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {toppers.map(t => (
                        <tr key={t.rank} className="hover:bg-violet-50/30 transition-colors">
                          <td className="px-8 py-4">
                            <span className={`h-8 w-8 rounded-xl flex items-center justify-center font-black ${t.rank === 1 ? 'bg-amber-100 text-amber-700' : t.rank === 2 ? 'bg-slate-100 text-slate-600' : t.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'}`}>
                              #{t.rank}
                            </span>
                          </td>
                          <td className="px-8 py-4 font-black text-slate-800">{t.student_name}</td>
                          <td className="px-8 py-4 font-mono text-xs text-slate-400 tracking-wider">{t.enrollment_no}</td>
                          <td className="px-8 py-4 font-black text-violet-700 text-lg">{t.sgpa?.toFixed(2)}</td>
                          <td className="px-8 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${t.status === 'PASS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[2rem] border border-dashed border-slate-200 p-24 text-center">
          <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="h-10 w-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-black text-slate-800">No Analytics Data</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 text-sm leading-relaxed">Select an exam session from the dropdown above to generate comprehensive performance reports and visualizations.</p>
        </div>
      )}
    </div>
  );
}
