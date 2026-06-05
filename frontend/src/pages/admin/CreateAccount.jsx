import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { Plus, Search, UserPlus, Mail } from 'lucide-react';
import api from '../../services/api';

const STAFF_ROLES = ['Faculty', 'Exam Cell', 'Accountant'];

const roleBadgeClass = {
  Faculty: 'bg-blue-100 text-blue-700',
  'Exam Cell': 'bg-violet-100 text-violet-700',
  Accountant: 'bg-emerald-100 text-emerald-700',
};

const loginHint = {
  Faculty: '/faculty/login',
  'Exam Cell': '/examcell/login',
  Accountant: '/accountant/login',
};

export default function CreateAccount() {
  const [accounts, setAccounts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirm_password: '',
    role: 'Faculty',
    mobile: '',
    dept: '',
    employee_id: '',
    department_id: '',
    designation: '',
  });

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const params = roleFilter !== 'all' ? { role: roleFilter } : {};
      const res = await api.get('/auth/admin/staff', { params });
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [roleFilter]);

  useEffect(() => {
    api.get('/academic/departments')
      .then((r) => setDepartments(Array.isArray(r.data) ? r.data : []))
      .catch(console.error);
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirm_password: '',
      role: 'Faculty',
      mobile: '',
      dept: '',
      employee_id: '',
      department_id: '',
      designation: '',
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      alert('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        mobile: formData.mobile.trim(),
        dept: formData.dept.trim(),
      };
      if (formData.role === 'Faculty') {
        payload.employee_id = formData.employee_id.trim();
        payload.department_id = formData.department_id;
        payload.designation = formData.designation.trim();
      }
      const res = await api.post('/auth/admin/staff', payload);
      alert(res.data?.message || 'Account created and saved to database.');
      setIsModalOpen(false);
      resetForm();
      fetchAccounts();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        (a.name || '').toLowerCase().includes(q)
        || (a.email || '').toLowerCase().includes(q)
        || (a.role || '').toLowerCase().includes(q)
    );
  }, [accounts, searchTerm]);

  const columns = [
    {
      header: 'Name',
      cell: (row) => (
        <div>
          <p className="text-sm font-bold text-slate-800">{row.name}</p>
          <p className="text-xs text-slate-500 flex items-center mt-0.5">
            <Mail className="h-3 w-3 mr-1" /> {row.email}
          </p>
        </div>
      ),
    },
    {
      header: 'Role',
      cell: (row) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${roleBadgeClass[row.role] || 'bg-slate-100 text-slate-600'}`}>
          {row.role}
        </span>
      ),
    },
    { header: 'Department', cell: (row) => <span className="text-sm text-slate-600">{row.dept || '—'}</span> },
    { header: 'Mobile', cell: (row) => <span className="text-sm text-slate-600">{row.mobile || '—'}</span> },
    {
      header: 'Login URL',
      cell: (row) => (
        <span className="text-xs font-mono text-violet-600">{loginHint[row.role] || '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Create Account</h1>
          <p className="text-slate-500 mt-1">
            Create login credentials for Exam Cell, Accountant, and Faculty. Accounts are saved directly in the database.
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200"
        >
          <UserPlus className="h-4 w-4 mr-2" /> New Account
        </Button>
      </div>

      <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
        <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-10 h-10 bg-slate-50 border-none rounded-xl"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="all">All roles</option>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="bg-white">
          {loading ? (
            <div className="p-16 text-center text-slate-400 italic">Loading accounts...</div>
          ) : filtered.length > 0 ? (
            <Table
              columns={columns}
              data={filtered}
              keyField="_id"
              headerClassName="bg-slate-50/50 text-slate-500 uppercase tracking-widest text-[10px] font-black"
              rowClassName="hover:bg-violet-50/30 border-b border-slate-50 last:border-0"
            />
          ) : (
            <div className="p-20 text-center">
              <UserPlus className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-800">No staff accounts yet</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                Use &quot;New Account&quot; to add Exam Cell, Accountant, or Faculty logins.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Account">
        <form onSubmit={handleCreate} className="space-y-5 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Role *</label>
              <select
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Full name *</label>
              <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Email *</label>
              <Input
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.replace(/\s/g, '') })}
                className="h-11 rounded-xl"
                placeholder="name@mgmcen.ac.in"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Password *</label>
              <Input
                required
                type="password"
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Confirm password *</label>
              <Input
                required
                type="password"
                minLength={6}
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Mobile</label>
              <Input value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Department note</label>
              <Input value={formData.dept} onChange={(e) => setFormData({ ...formData, dept: e.target.value })} className="h-11 rounded-xl" placeholder="e.g. CSE" />
            </div>
          </div>

          {formData.role === 'Faculty' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <p className="md:col-span-2 text-xs font-bold text-blue-800 uppercase tracking-wider">Faculty profile (optional)</p>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-1">Employee ID</label>
                <Input value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} className="h-11 rounded-xl bg-white" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-1">Designation</label>
                <Input value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} className="h-11 rounded-xl bg-white" placeholder="Assistant Professor" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 ml-1">Academic department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">— Select later —</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500">
            User will sign in at: <span className="font-mono text-violet-600">{loginHint[formData.role]}</span>
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-8 rounded-xl">
              {saving ? 'Saving...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
