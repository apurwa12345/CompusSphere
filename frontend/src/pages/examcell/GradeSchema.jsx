import React from 'react';
import { Card } from '../../components/common/UI';
import { ShieldCheck, BookOpen } from 'lucide-react';

export default function GradeSchema() {
  const schema = [
    { min: '90%+', grade: 'EX', points: '10', label: 'Outstanding' },
    { min: '80%+', grade: 'AA', points: '9', label: 'Excellent' },
    { min: '75%+', grade: 'AB', points: '8.5', label: 'Very Good (AB)' },
    { min: '70%+', grade: 'BB', points: '8', label: 'Very Good (BB)' },
    { min: '65%+', grade: 'BC', points: '7.5', label: 'Good (BC)' },
    { min: '60%+', grade: 'CC', points: '7', label: 'Good (CC)' },
    { min: '55%+', grade: 'CD', points: '6.5', label: 'Above Average (CD)' },
    { min: '50%+', grade: 'DD', points: '6', label: 'Above Average (DD)' },
    { min: '45%+', grade: 'DE', points: '5.5', label: 'Average (DE)' },
    { min: '40%+', grade: 'EE', points: '5', label: 'Average (EE)' },
    { min: '0%+', grade: 'FF', points: '0', label: 'Fail' },
  ];

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="bg-white/95 rounded-3xl p-8 shadow-xl shadow-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center justify-center rounded-2xl bg-violet-500/10 text-violet-700 p-3 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Grade Schema</h1>
            <p className="text-slate-500 mt-2 max-w-2xl">This page displays the official exam grading scheme for the Exam Cell. Use it to verify grade thresholds, grade points and labels.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
            <BookOpen className="w-5 h-5 text-slate-600" />
            <span className="text-sm font-semibold text-slate-700">Exam Cell Reference</span>
          </div>
        </div>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left font-semibold text-slate-600 uppercase tracking-[0.12em]">Min %</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-600 uppercase tracking-[0.12em]">Grade</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-600 uppercase tracking-[0.12em]">Grade Points</th>
                <th className="px-5 py-4 text-left font-semibold text-slate-600 uppercase tracking-[0.12em]">Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {schema.map((row) => (
                <tr key={row.grade} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-slate-800">{row.min}</td>
                  <td className="px-5 py-4 text-violet-600 font-bold">{row.grade}</td>
                  <td className="px-5 py-4 text-slate-700">{row.points}</td>
                  <td className="px-5 py-4 text-slate-500">{row.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
