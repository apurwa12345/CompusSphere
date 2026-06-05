import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import logo from '../../assets/logo.png';

const INSTITUTIONAL_EMAIL_DOMAIN = '@mgmcen.ac.in';

const ResetPassword = () => {
    const location = useLocation();
    const [email, setEmail] = useState(location.state?.email || '');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [passwordChanged, setPasswordChanged] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const navigate = useNavigate();

    const normalizeOtpDetails = () => {
        const normalizedEmail = email.replace(/\s+/g, '').toLowerCase();
        const normalizedOtp = otp.replace(/\D/g, '');
        setEmail(normalizedEmail);
        setOtp(normalizedOtp);
        return { normalizedEmail, normalizedOtp };
    };

    const validateOtpDetails = (normalizedEmail, normalizedOtp) => {
        if (!normalizedEmail.endsWith(INSTITUTIONAL_EMAIL_DOMAIN)) {
            setError(`Please use your institutional email ending with ${INSTITUTIONAL_EMAIL_DOMAIN}`);
            return false;
        }
        if (normalizedOtp.length !== 6) {
            setError('Enter the 6-digit OTP from your email');
            return false;
        }
        return true;
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        const { normalizedEmail, normalizedOtp } = normalizeOtpDetails();
        if (!validateOtpDetails(normalizedEmail, normalizedOtp)) return;

        try {
            setSubmitting(true);
            const response = await api.post('/auth/student/verify-reset-otp', {
                email: normalizedEmail,
                otp: normalizedOtp,
            });
            setOtpVerified(true);
            setMessage(response.data?.message || 'OTP verified. You can now create a new password.');
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to verify OTP. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        const { normalizedEmail, normalizedOtp } = normalizeOtpDetails();
        if (!validateOtpDetails(normalizedEmail, normalizedOtp)) return;
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        try {
            setSubmitting(true);
            const response = await api.post('/auth/student/reset-password', {
                email: normalizedEmail,
                otp: normalizedOtp,
                password,
            });
            setMessage(response.data?.message || 'Password changed successfully.');
            setPasswordChanged(true);
            setOtp('');
            setPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to reset password. Please request a new OTP.');
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
                        Change Password
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-600">
                        Verify the OTP first, then create a new password.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={otpVerified ? handleChangePassword : handleVerifyOtp}>
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

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Student email address</label>
                            <input
                                type="email"
                                required
                                disabled={otpVerified}
                                value={email}
                                onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                                className="appearance-none relative block w-full px-4 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm transition-colors"
                                placeholder={`student${INSTITUTIONAL_EMAIL_DOMAIN}`}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email OTP</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                required
                                maxLength={6}
                                disabled={otpVerified}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="appearance-none relative block w-full px-4 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm transition-colors"
                                placeholder="Enter 6-digit OTP"
                            />
                        </div>
                        {otpVerified && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="appearance-none relative block w-full px-4 py-3 pr-12 border border-slate-200 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 sm:text-sm transition-colors"
                                            placeholder="Enter new password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((value) => !value)}
                                            className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 focus:outline-none"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="appearance-none relative block w-full px-4 py-3 pr-12 border border-slate-200 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 sm:text-sm transition-colors"
                                            placeholder="Confirm new password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((value) => !value)}
                                            className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 focus:outline-none"
                                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || passwordChanged}
                        className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-violet-500 hover:bg-violet-600 disabled:bg-violet-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-200 transition-all duration-200 shadow-lg shadow-violet-200/60"
                    >
                        <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                            {otpVerified
                                ? <KeyRound className="h-5 w-5 text-yellow-100 group-hover:text-white" aria-hidden="true" />
                                : <ShieldCheck className="h-5 w-5 text-yellow-100 group-hover:text-white" aria-hidden="true" />}
                        </span>
                        {submitting ? (otpVerified ? 'Changing...' : 'Verifying...') : (otpVerified ? 'Change Password' : 'Verify OTP')}
                    </button>
                    {passwordChanged && (
                        <button
                            type="button"
                            onClick={() => navigate('/student/login', { replace: true })}
                            className="w-full flex justify-center py-3 px-4 border border-violet-200 text-sm font-semibold rounded-xl text-violet-700 bg-violet-50 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-200 transition-all duration-200"
                        >
                            Go to Login
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
