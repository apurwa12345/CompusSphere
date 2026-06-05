import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import api from '../../services/api';
import logo from '../../assets/logo.png';

const INSTITUTIONAL_EMAIL_DOMAIN = '@mgmcen.ac.in';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        const normalizedEmail = email.replace(/\s+/g, '').toLowerCase();
        setEmail(normalizedEmail);

        if (!normalizedEmail) {
            setError('Email is required');
            return;
        }
        if (!normalizedEmail.endsWith(INSTITUTIONAL_EMAIL_DOMAIN)) {
            setError(`Please use your institutional email ending with ${INSTITUTIONAL_EMAIL_DOMAIN}`);
            return;
        }

        try {
            setSubmitting(true);
            const response = await api.post('/auth/student/forgot-password', { email: normalizedEmail });
            setMessage(response.data?.message || 'If a student account exists, a reset OTP has been sent.');
            navigate('/student/reset-password', { state: { email: normalizedEmail } });
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to send reset OTP. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f5f0ff] via-[#f2ecff] to-[#eef2ff] py-12 px-4 sm:px-6 lg:px-8 relative">
            <button
                onClick={() => navigate('/student/login', { replace: true })}
                className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 bg-violet-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-violet-200/40 hover:bg-violet-600 transition-all duration-200"
            >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Back</span>
            </button>
            <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-3xl shadow-[0_25px_60px_-30px_rgba(15,23,42,0.45)] border border-slate-100">
                <div className="flex flex-col items-center">
                    <div className="h-24 w-24 bg-violet-500 rounded-full flex items-center justify-center relative overflow-hidden shadow-lg shadow-violet-200/60">
                        <img src={logo} alt="Logo" className="h-full w-full object-cover" />
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
                        Student Password Reset
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-600">
                        Enter your student email to receive a password reset OTP.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm text-center border border-emerald-100">
                            {message}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Student email address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                            className="appearance-none relative block w-full px-4 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 sm:text-sm transition-colors"
                            placeholder={`student${INSTITUTIONAL_EMAIL_DOMAIN}`}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-violet-500 hover:bg-violet-600 disabled:bg-violet-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-200 transition-all duration-200 shadow-lg shadow-violet-200/60"
                    >
                        <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                            <Mail className="h-5 w-5 text-yellow-100 group-hover:text-white" aria-hidden="true" />
                        </span>
                        {submitting ? 'Sending...' : 'Send OTP'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ForgotPassword;
