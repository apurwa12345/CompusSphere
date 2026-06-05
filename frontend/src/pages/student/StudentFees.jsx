import React, { useEffect, useState } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import { CheckCircle2, Clock3 } from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const categories = ['General', 'OBC', 'SC', 'ST'];
const categoryFeeMap = {
  General: 100000,
  OBC: 60000,
  SC: 10000,
  ST: 5000,
  EWS: 90000,
  TFWS: 20000
};

export default function StudentFees() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone_no: '',
    category: 'General',
    scheme_applied: '',
    fees_amount: 100000
  });
  const [receipt, setReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('success');
  const [latestSubmission, setLatestSubmission] = useState(null);
  const [feeStatus, setFeeStatus] = useState(null);

  const loadData = async () => {
    try {
      const [profileRes, submissionRes, feeStatusRes] = await Promise.all([
        api.get('/auth/profile'),
        api.get('/accountant/my-fee-submission'),
        api.get('/accountant/my-fee-status')
      ]);
      const profile = profileRes.data || {};
      setFeeStatus(feeStatusRes.data || null);
      const profileCategory = profile.category || 'General';
      const schemeFromProfile = ['EWS', 'TFWS'].includes(String(profileCategory).toUpperCase())
        ? String(profileCategory).toUpperCase()
        : '';
      const normalizedProfileCategory = schemeFromProfile ? 'General' : profileCategory;
      const effectiveProfileCategory = schemeFromProfile || normalizedProfileCategory;
      setForm((prev) => ({
        ...prev,
        name: profile.name || '',
        email: profile.email || '',
        phone_no: profile.phone_no || profile.phone || '',
        category: normalizedProfileCategory || prev.category,
        scheme_applied: schemeFromProfile,
        fees_amount: categoryFeeMap[effectiveProfileCategory] || 100000
      }));
      if (submissionRes.data?.exists) {
        setLatestSubmission(submissionRes.data);
        const subCat = submissionRes.data.submissions[0]?.category || '';
        const schemeFromSubmission = ['EWS', 'TFWS'].includes(String(subCat).toUpperCase())
          ? String(subCat).toUpperCase()
          : '';
        const normalizedSubmissionCategory = schemeFromSubmission ? 'General' : (subCat || 'General');
        const effectiveSubmissionCategory = schemeFromSubmission || normalizedSubmissionCategory;
        setForm((prev) => ({
          ...prev,
          category: normalizedSubmissionCategory || prev.category,
          scheme_applied: schemeFromSubmission,
          fees_amount: categoryFeeMap[effectiveSubmissionCategory] || prev.fees_amount
        }));
      } else {
        setLatestSubmission(null);
      }
    } catch (err) {
      setStatusType('error');
      setStatus('Unable to load fee details.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (field, value) => {
    if (field === 'category') {
      setForm((prev) => {
        const next = { ...prev, category: value };
        if (value !== 'General') {
          next.scheme_applied = '';
        }
        const effective = next.scheme_applied || next.category;
        next.fees_amount = categoryFeeMap[effective] || 100000;
        return next;
      });
      return;
    }
    if (field === 'scheme_applied') {
      setForm((prev) => {
        const scheme = value || '';
        const next = { ...prev, scheme_applied: scheme };
        const effective = scheme || next.category;
        next.fees_amount = categoryFeeMap[effective] || 100000;
        return next;
      });
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!receipt) {
      setStatusType('error');
      setStatus('Please upload fee receipt document.');
      return;
    }
    setSubmitting(true);
    setStatus('');
    try {
      const payload = new FormData();
      const effectiveCategory = (form.category === 'General' && form.scheme_applied)
        ? form.scheme_applied
        : form.category;
      payload.append('name', form.name);
      payload.append('email', form.email);
      payload.append('phone_no', form.phone_no);
      payload.append('category', effectiveCategory);
      payload.append('receipt', receipt);
      const res = await api.post('/accountant/submit-fee', payload);
      setStatusType('success');
      setStatus(res.data?.message || 'Fee details submitted successfully.');
      await loadData();
      setReceipt(null);
    } catch (err) {
      setStatusType('error');
      setStatus(err.response?.data?.message || 'Failed to submit fee details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fees</h1>
        <p className="text-slate-500">Submit your fee details and upload payment receipt.</p>
      </div>

      <Card className="p-6">
        {feeStatus && (
          <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total Fees</p>
              <p className="text-lg font-extrabold text-slate-800">
                Rs {Number(feeStatus.fees_amount || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Paid So Far</p>
              <p className="text-lg font-extrabold text-slate-800">
                Rs {Number(feeStatus.fees_paid_amount || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div
              className={[
                "rounded-2xl border px-4 py-3",
                Number(feeStatus.remaining_amount || 0) > 0
                  ? "border-amber-200 bg-amber-50/60"
                  : "border-emerald-200 bg-emerald-50/60"
              ].join(' ')}
            >
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Remaining</p>
              <p className={Number(feeStatus.remaining_amount || 0) > 0 ? "text-lg font-extrabold text-amber-900" : "text-lg font-extrabold text-emerald-900"}>
                Rs {Number(feeStatus.remaining_amount || 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        )}

        {latestSubmission && latestSubmission.submissions && (
          <div className="mb-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <p className="text-sm font-bold text-slate-900">Your Fee Submissions ({latestSubmission.submissions.length})</p>
            </div>
            {latestSubmission.submissions.map((submission, idx) => (
              <div
                key={submission._id}
                className={[
                  "rounded-2xl border p-4",
                  submission.status === 'Paid'
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-amber-200 bg-amber-50/60"
                ].join(' ')}
              >
                <div className="flex items-start gap-3 justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-600">Receipt {idx + 1}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Submitted: {formatDate(submission.created_at)}
                    </p>
                    <p className="text-xs text-slate-600">
                      File: {submission.receipt_filename || 'Unknown'}
                    </p>
                    <span
                      className={[
                        "inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-wide mt-2 w-fit",
                        submission.status === 'Paid'
                          ? "bg-emerald-600 text-white"
                          : submission.status === 'Partially Paid'
                          ? "bg-blue-600 text-white"
                          : "bg-amber-600 text-white"
                      ].join(' ')}
                    >
                      {submission.status || 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {status && (
          <div className={`mb-4 rounded-xl p-3 text-sm ${statusType === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
            {status}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <Input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone No.</label>
            <Input value={form.phone_no} onChange={(e) => handleChange('phone_no', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            {latestSubmission ? (
              <div className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 flex items-center font-semibold">
                {form.category}
              </div>
            ) : (
              <select
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            {latestSubmission && <p className="mt-1 text-xs text-amber-600">Category is locked after first submission</p>}
          </div>
          {form.category === 'General' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Scheme Applied</label>
              {latestSubmission ? (
                <div className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 flex items-center font-semibold">
                  {form.scheme_applied || 'None'}
                </div>
              ) : (
                <select
                  value={form.scheme_applied}
                  onChange={(e) => handleChange('scheme_applied', e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                  <option value="">None</option>
                  <option value="EWS">EWS</option>
                  <option value="TFWS">TFWS</option>
                </select>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Available only for General category.
              </p>
              {latestSubmission && <p className="mt-1 text-xs text-amber-600">Scheme is locked after first submission</p>}
            </div>
          )}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Fee Amount</label>
            <Input
              type="number"
              min="1"
              value={form.fees_amount}
              readOnly
              required
            />
          </div>
          <div className="md:col-span-2 overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Category</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Student Pays (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(categoryFeeMap).map(([cat, amount]) => (
                  <tr key={cat} className="border-t border-slate-100">
                    <td className="px-3 py-2">{cat === 'General' ? 'OPEN' : cat}</td>
                    <td className="px-3 py-2">Rs {amount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Add Document (Fee Receipt)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setReceipt(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Fees'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

