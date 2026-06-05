import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/common/UI';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { AlertCircle, Clock, CheckCircle, QrCode, DollarSign, Smartphone } from 'lucide-react';

const StudentExams = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [applications, setApplications] = useState([]);
    const [hallTicketMap, setHallTicketMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedExam, setSelectedExam] = useState(null);
    const [studentSubjects, setStudentSubjects] = useState([]);
    const [timetableOpen, setTimetableOpen] = useState(false);
    const [timetableLoading, setTimetableLoading] = useState(false);
    const [timetableExam, setTimetableExam] = useState(null);
    const [timetableEntries, setTimetableEntries] = useState([]);
    const [loadError, setLoadError] = useState('');
    
    // Exam form flow state
    const [verificationModalOpen, setVerificationModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const formatTimeRemaining = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const fetchExams = async () => {
            try {
                setLoadError('');
                const [appsRes, examSetupRes, examRes] = await Promise.allSettled([
                    api.get('/exam-forms/my-applications'),
                    api.get('/exam-setup/'),
                    api.get('/exam/'),
                ]);

                const allApps = appsRes.status === 'fulfilled' ? (appsRes.value.data || []) : [];
                setApplications(allApps);

                const fromSetup = examSetupRes.status === 'fulfilled' ? examSetupRes.value.data : null;
                const fromExam = examRes.status === 'fulfilled' ? examRes.value.data : null;
                const allExams = Array.isArray(fromSetup) ? fromSetup : (Array.isArray(fromExam) ? fromExam : []);

                const semRaw = user?.current_semester ?? user?.semester;
                const semNum = semRaw === undefined || semRaw === null || semRaw === '' ? null : parseInt(String(semRaw), 10);
                const filtered = semNum !== null && Number.isFinite(semNum)
                    ? allExams.filter((e) => parseInt(String(e?.semester), 10) === semNum)
                    : allExams;

                // If semester filtering removes everything, show all (better UX than empty table)
                setExams(filtered.length > 0 ? filtered : allExams);

                if (allExams.length === 0) {
                    const errors = [];
                    if (examSetupRes.status === 'rejected') errors.push(`exam-setup: ${examSetupRes.reason?.response?.status || ''} ${examSetupRes.reason?.message || ''}`.trim());
                    if (examRes.status === 'rejected') errors.push(`exam: ${examRes.reason?.response?.status || ''} ${examRes.reason?.message || ''}`.trim());
                    if (errors.length) setLoadError(errors.join(' | '));
                }

                const checks = await Promise.all(
                    (filtered.length > 0 ? filtered : allExams).map(async (exam) => {
                        try {
                            const checkRes = await api.get(`/hall-ticket/check/${exam._id}`);
                            return [exam._id, checkRes.data];
                        } catch (error) {
                            return [exam._id, { available: false }];
                        }
                    })
                );
                setHallTicketMap(Object.fromEntries(checks));
            } catch (e) {
                console.error(e);
                setLoadError(e?.response?.data?.message || e?.message || 'Failed to load exams');
            } finally { setLoading(false); }
        };
        fetchExams();
    }, [user]);

    const handleViewTimetable = async (exam) => {
        setTimetableExam(exam);
        setTimetableEntries([]);
        setTimetableOpen(true);
        setTimetableLoading(true);
        try {
            const classValue = (user?.group || '').trim();
            const qs = classValue ? `?class_value=${encodeURIComponent(classValue)}` : '';
            const r = await api.get(`/timetable/${exam._id}${qs}`);
            const entries = r.data || [];
            if (entries.length > 0) {
                setTimetableEntries(entries);
            } else if (Array.isArray(exam?.timetable) && exam.timetable.length > 0) {
                // fallback (legacy)
                const filtered = classValue
                    ? exam.timetable.filter((x) => {
                        const cv = (x.class_value || '').trim();
                        return cv === '' || cv === classValue;
                      })
                    : exam.timetable;
                setTimetableEntries(filtered.map((x, idx) => ({
                    _id: x._id || `${idx}`,
                    subject_name: x.subject_name || x.subject || '—',
                    subject_code: x.subject_code || x.code || '',
                    date: x.date || '',
                    start_time: x.start_time || x.time || '',
                    end_time: x.end_time || '',
                    room: x.room || '',
                })));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setTimetableLoading(false);
        }
    };

    const handleOpenApply = async (exam) => {
        setSelectedExam(exam);
        setVerificationModalOpen(true);
        try {
            const res = await api.get('/academic/student/subjects');
            setStudentSubjects(res.data);
        } catch (e) { console.error('Failed to fetch subjects'); }
    };

    const handleProceedToPayment = async () => {
        setSubmitting(true);
        const res = await loadRazorpayScript();
        if (!res) {
            alert('Razorpay SDK failed to load. Are you online?');
            setSubmitting(false);
            return;
        }

        try {
            const orderRes = await api.post('/exam-forms/create-razorpay-order', { amount: 1 });
            const options = {
                key: orderRes.data.key_id, // Fetching the key dynamically from backend
                amount: orderRes.data.amount,
                currency: orderRes.data.currency,
                name: "MGMCEN Exam Cell",
                description: "Exam Form Fee",
                order_id: orderRes.data.id,
                handler: async function (response) {
                    try {
                        setSubmitting(true);
                        const payload = {
                            exam_id: selectedExam._id,
                            transaction_id: response.razorpay_payment_id,
                            subjects: studentSubjects.map(s => s._id),
                            fee_acknowledged: true,
                            payment_method: 'razorpay',
                            payment_initiated_at: new Date().toISOString(),
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        };
                        const submitRes = await api.post('/exam-forms/apply', payload);
                        
                        setVerificationModalOpen(false);
                        alert('✓ Exam form submitted successfully!\n\nApplication ID: ' + submitRes.data.application_id + '\n\nYour application has been submitted and auto-approved.');
                        
                        // Refresh applications list
                        const appRes = await api.get('/exam-forms/my-applications');
                        setApplications(appRes.data || []);
                        
                        // Refresh hall ticket status
                        if (selectedExam?._id) {
                            const checkRes = await api.get(`/hall-ticket/check/${selectedExam._id}`);
                            setHallTicketMap((prev) => ({ ...prev, [selectedExam._id]: checkRes.data }));
                        }
                    } catch (err) {
                        alert(err.response?.data?.message || 'Failed to submit exam form');
                    } finally {
                        setSubmitting(false);
                    }
                },
                prefill: {
                    name: user?.name || 'Student',
                    email: user?.email || '',
                },
                theme: {
                    color: "#16a34a",
                },
            };

            const paymentObject = new window.Razorpay(options);
            paymentObject.on('payment.failed', function (response) {
                alert('Payment failed. Reason: ' + response.error.description);
            });
            paymentObject.open();
        } catch (e) {
            alert('Failed to initiate payment.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenHallTicket = (applicationId) => {
        if (!applicationId) return;
        navigate('/student/hall-ticket');
    };

    const columns = [
        { header: 'Exam Name', accessor: 'name' },
        { header: 'Semester', accessor: 'semester' },
        { header: 'Start Date', accessor: 'start_date' },
        { header: 'Status', cell: (row) => {
            const colors = { 'Upcoming': 'bg-blue-100 text-blue-700', 'Ongoing': 'bg-yellow-100 text-yellow-700', 'Completed': 'bg-green-100 text-green-700' };
            return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[row.status] || 'bg-slate-100 text-slate-700'}`}>{row.status}</span>;
        }},
        {
            header: 'Actions',
            cell: (row) => {
                const app = applications.find((a) => a.exam_id === row._id);
                const hallTicket = hallTicketMap[row._id] || {};
                return (
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => handleViewTimetable(row)}>
                            View Timetable
                        </Button>
                        {!app ? (
                            <Button size="sm" onClick={() => handleOpenApply(row)}>Apply Form</Button>
                        ) : (
                            <span className="text-xs font-semibold text-slate-500 px-2 py-1 bg-slate-100 rounded">Applied</span>
                        )}
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={!hallTicket.available}
                            onClick={() => handleOpenHallTicket(app?._id || hallTicket.application_id)}
                        >
                            {hallTicket.available ? 'Preview Hall Ticket' : 'Hall Ticket Locked'}
                        </Button>
                    </div>
                );
            }
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Examinations</h1>
                <p className="text-slate-500">Apply for upcoming exams and download hall tickets.</p>
            </div>
            {loadError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {loadError}
                </div>
            )}
            <Card>
                {loading ? <div className="p-8 text-center text-slate-500">Loading...</div> : <Table columns={columns} data={exams} keyField="_id" />}
            </Card>

            <Modal isOpen={timetableOpen} onClose={() => setTimetableOpen(false)} title="Exam Timetable">
                <div className="space-y-4 pt-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <h3 className="font-bold text-slate-800">{timetableExam?.name || 'Exam'}</h3>
                        <p className="text-sm text-slate-500">Semester: {timetableExam?.semester}</p>
                    </div>
                    {timetableLoading ? (
                        <div className="p-6 text-center text-slate-500">Loading timetable…</div>
                    ) : timetableEntries.length === 0 ? (
                        <div className="p-6 text-center text-slate-500">Timetable not published yet.</div>
                    ) : (
                        <div className="overflow-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        {['Subject', 'Code', 'Date', 'Start', 'End'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {timetableEntries.map((e) => (
                                        <tr key={e._id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-800">{e.subject_name || '—'}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.subject_code || '—'}</td>
                                            <td className="px-4 py-3 text-slate-700">{e.date || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{e.start_time || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{e.end_time || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Modal>

            {/* ===== STUDENT VERIFICATION MODAL ===== */}
            <Modal isOpen={verificationModalOpen} onClose={() => !submitting && setVerificationModalOpen(false)} title="Verify Student Information" size="3xl">
                <div className="space-y-6 pt-4 max-h-[75vh] overflow-y-auto">
                    {/* Alert Box */}
                    <div className="w-full flex items-start gap-5 px-8 py-8 min-h-[130px] bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-md">
                        <AlertCircle className="w-10 h-10 text-amber-500 flex-shrink-0 mt-1" />
                        <div className="space-y-2 flex-1">
                            <h3 className="text-lg font-extrabold text-amber-900 leading-snug">⚠️ Please verify your information carefully</h3>
                            <p className="text-base text-amber-800 leading-relaxed">
                                Ensure all details below are <strong>correct and up-to-date</strong> before proceeding with payment.
                            </p>
                            <p className="text-sm text-amber-700 font-medium">
                                ❌ Once submitted, <span className="underline">changes cannot be made</span> to your exam application.
                            </p>
                        </div>
                    </div>

                    {/* Exam Details */}
                    <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <h3 className="font-bold text-blue-900 text-sm uppercase tracking-widest">Exam Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-blue-600 font-semibold">Exam Name</span>
                                <p className="text-blue-900 font-bold">{selectedExam?.name}</p>
                            </div>
                            <div>
                                <span className="text-blue-600 font-semibold">Semester</span>
                                <p className="text-blue-900 font-bold">{selectedExam?.semester}</p>
                            </div>
                        </div>
                    </div>

                    {/* Student Details */}
                    <div className="space-y-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                        <h3 className="font-bold text-indigo-900 text-sm uppercase tracking-widest">Your Information</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-indigo-600 font-semibold">Name</span>
                                <p className="text-indigo-900 font-bold">{user?.name || '—'}</p>
                            </div>
                            <div>
                                <span className="text-indigo-600 font-semibold">Enrollment No</span>
                                <p className="text-indigo-900 font-bold">{user?.enrollment_no || '—'}</p>
                            </div>
                            <div>
                                <span className="text-indigo-600 font-semibold">Email</span>
                                <p className="text-indigo-900 font-bold text-xs">{user?.email || '—'}</p>
                            </div>
                            <div>
                                <span className="text-indigo-600 font-semibold">Current Semester</span>
                                <p className="text-indigo-900 font-bold">{user?.current_semester || '—'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Subjects for Semester 1 */}
                    <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                        <h3 className="font-bold text-green-900 text-sm uppercase tracking-widest">Registered Subjects (Sem {user?.current_semester})</h3>
                        {studentSubjects.length === 0 ? (
                            <p className="text-sm text-green-700 italic">No subjects assigned for this semester.</p>
                        ) : (
                            <div className="space-y-2">
                                {studentSubjects.map((subject, idx) => (
                                    <div key={subject._id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-100">
                                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 text-xs font-bold rounded-full flex-shrink-0">{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-green-900 text-sm">{subject.name}</p>
                                            <p className="text-xs text-green-600">{subject.code} • {subject.credits} Credits</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Exam Fee */}
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-purple-900 text-sm uppercase tracking-widest">Exam Form Fee</h3>
                                <p className="text-xs text-purple-600 mt-1">Non-refundable registration fee</p>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-bold text-purple-900">₹1</p>
                                <p className="text-xs text-purple-600">Test Amount</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-slate-200">
                        <Button 
                            variant="ghost" 
                            className="flex-1"
                            onClick={() => setVerificationModalOpen(false)} 
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button 
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleProceedToPayment}
                            disabled={submitting}
                        >
                            Proceed to Payment
                        </Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default StudentExams;
