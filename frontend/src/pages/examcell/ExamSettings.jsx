import React, { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import api from '../../services/api';

export default function ExamSettings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/exam-settings/').then(r => { setSettings(r.data); setForm(r.data); }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/exam-settings/', form);
      alert('Settings saved successfully!');
      const r = await api.get('/exam-settings/');
      setSettings(r.data); setForm(r.data);
    } catch (err) { alert(err.response?.data?.message || 'Error saving settings'); } finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all settings to defaults?')) return;
    try {
      await api.post('/exam-settings/reset');
      const r = await api.get('/exam-settings/');
      setSettings(r.data); setForm(r.data);
      alert('Settings reset to defaults');
    } catch (err) { alert('Reset failed'); }
  };

  if (loading) return <div className="p-12 text-center text-slate-400">Loading settings...</div>;

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Exam Settings</h1><p className="text-slate-500 text-sm mt-1">Configure grading rules, passing marks and policies</p></div>
        <div className="flex gap-2">
          <button onClick={handleReset} className="flex items-center gap-2 text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors"><RotateCcw className="w-4 h-4" /> Reset</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Settings'}</button>
        </div>
      </div>

      <div className="space-y-5">
        {/* Marks config */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Marks Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'passing_percentage', label: 'Passing Percentage %', hint: 'Min % to pass a subject' },
              { key: 'min_internal_marks', label: 'Min. Internal Marks', hint: 'Minimum internal marks required' },
              { key: 'max_internal_marks', label: 'Max Internal Marks', hint: 'Maximum internal marks' },
              { key: 'max_external_marks', label: 'Max External Marks', hint: 'Maximum external marks' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                <input type="number" value={form[f.key] ?? ''} onChange={e => setForm({ ...form, [f.key]: parseFloat(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <p className="text-xs text-slate-400 mt-1">{f.hint}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Policies */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Policies</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <div className="font-medium text-slate-700 text-sm">Allow Revaluation</div>
                <div className="text-xs text-slate-400">Students can apply for revaluation of external marks</div>
              </div>
              <button onClick={() => setForm({ ...form, allow_revaluation: !form.allow_revaluation })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.allow_revaluation ? 'bg-violet-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.allow_revaluation ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Revaluation Fee (₹)</label>
              <input type="number" value={form.revaluation_fee ?? ''} onChange={e => setForm({ ...form, revaluation_fee: parseFloat(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
        </div>

        {/* Grading scheme preview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Grading Scheme (Read-only Preview)</h3>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>{['Min %', 'Grade', 'Grade Points', 'Label'].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-600">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(form.grading_scheme || []).map((g, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-slate-600">{g.min_pct}%+</td>
                    <td className="px-4 py-2 font-bold text-violet-700">{g.grade}</td>
                    <td className="px-4 py-2 text-slate-600">{g.grade_point}</td>
                    <td className="px-4 py-2 text-slate-500">{g.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
