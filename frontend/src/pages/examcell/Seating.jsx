import React, { useState, useEffect } from 'react';
import { Shuffle, User } from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

export default function Seating() {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoForm, setAutoForm] = useState({ rooms: 'Room 101, Room 102', seats_per_room: 30 });

  useEffect(() => { api.get('/exam-setup/').then(r => setExams(r.data)).catch(console.error); }, []);

  const fetchSeats = async () => {
    if (!selectedExam) return;
    setLoading(true);
    try { const r = await api.get(`/seating/${selectedExam}`); setSeats(r.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchSeats(); }, [selectedExam]);

  const handleAutoAssign = async () => {
    try {
      const rooms = autoForm.rooms.split(',').map(r => r.trim()).filter(Boolean);
      await api.post(`/seating/auto-assign/${selectedExam}`, { rooms, seats_per_room: parseInt(autoForm.seats_per_room) });
      setShowAutoModal(false);
      fetchSeats();
    } catch (err) { alert(err.response?.data?.message || 'Auto-assign failed'); }
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seating Arrangement</h1>
          <p className="text-slate-500 text-sm mt-1">Assign rooms and seat numbers to students</p>
        </div>
        <button onClick={() => setShowAutoModal(true)} disabled={!selectedExam} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Shuffle className="w-4 h-4" /> Auto Assign Seats
        </button>
      </div>

      <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[220px]">
        <option value="">— Select Exam —</option>
        {exams.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
      </select>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!selectedExam ? (
          <div className="p-12 text-center text-slate-400">Select an exam to view seating</div>
        ) : loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : seats.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No seats assigned yet. Use Auto Assign or add manually.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{['Student', 'Enrollment No', 'Room', 'Seat No', 'Assigned At'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {seats.map(s => (
                <tr key={s._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.student_name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.enrollment_no || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{s.room}</td>
                  <td className="px-4 py-3 font-semibold text-violet-700">{s.seat_no}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDate(s.assigned_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAutoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Auto Assign Seats</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rooms (comma separated)</label>
                <input value={autoForm.rooms} onChange={e => setAutoForm({ ...autoForm, rooms: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Seats per Room</label>
                <input type="number" value={autoForm.seats_per_room} onChange={e => setAutoForm({ ...autoForm, seats_per_room: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowAutoModal(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={handleAutoAssign} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
