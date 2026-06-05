import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogIn, ArrowLeft } from 'lucide-react';
import logo from '../../assets/logo.png';

const INSTITUTIONAL_EMAIL_DOMAIN = '@mgmcen.ac.in';

const Login = ({ defaultRole = '' }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    const selectedRole = location.state?.selectedRole || defaultRole || '';
    const from = location.state?.from?.pathname;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const normalizedEmail = email.replace(/\s+/g, '').toLowerCase();
        if (normalizedEmail !== email) {
            setEmail(normalizedEmail);
        }
        if (!normalizedEmail) {
            setError('Email is required');
            return;
        }
        if (!normalizedEmail.endsWith(INSTITUTIONAL_EMAIL_DOMAIN)) {
            setError(`Please use your institutional email ending with ${INSTITUTIONAL_EMAIL_DOMAIN}`);
            return;
        }
        try {
            const { role } = await login(normalizedEmail, password);
            if (selectedRole && role !== selectedRole) {
                setError(
                    `This login type is only for ${selectedRole}. You are signed in as ${role}. Please use the correct login option.`
                );
                return;
            }

            if (from) {
                navigate(from, { replace: true });
            } else {
                switch(role) {
                    case 'Admin': navigate('/admin/dashboard', { replace: true }); break;
                    case 'Exam Cell': navigate('/examcell/dashboard', { replace: true }); break;
                    case 'Faculty': navigate('/faculty/dashboard', { replace: true }); break;
                    case 'Student': navigate('/student/dashboard', { replace: true }); break;
                    case 'Accountant': navigate('/accountant/dashboard', { replace: true }); break;
                    default: navigate('/', { replace: true });
                }
            }
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Login failed. Please try again.';
            setError(message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f5f0ff] via-[#f2ecff] to-[#eef2ff] py-12 px-4 sm:px-6 lg:px-8 relative">
            {/* Back Button */}
            <button
                onClick={() => navigate('/', { replace: true })}
                className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 bg-violet-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-violet-200/40 hover:bg-violet-600 transition-all duration-200"
            >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Back</span>
            </button>
            <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-3xl shadow-[0_25px_60px_-30px_rgba(15,23,42,0.45)] border border-slate-100">
                <div className="flex flex-col items-center">
                    <div className="h-24 w-24 bg-violet-500 rounded-full flex items-center justify-center relative overflow-hidden shadow-lg shadow-violet-200/60">
                        <img 
                            src={logo} 
                            alt="Logo" 
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                e.target.onerror = null; 
                                e.target.style.display = 'none'; 
                                e.target.nextSibling.style.display = 'block';
                            }}
                        />
                        <span className="text-3xl font-bold text-white tracking-wider hidden absolute inset-0 flex items-center justify-center">EDU</span>
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
                        {selectedRole ? `${selectedRole} Login` : 'Sign in to your account'}
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-600">
                        {selectedRole
                            ? `Enter your ${selectedRole.toLowerCase()} credentials to continue.`
                            : 'Mahatma Gandhi Mission College Of Engineering Nanded'}
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                            {error}
                        </div>
                    )}
                    <div className="rounded-md shadow-sm -space-y-px group">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                                className="appearance-none relative block w-full px-4 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:z-10 sm:text-sm transition-colors"
                                placeholder={`you${INSTITUTIONAL_EMAIL_DOMAIN}`}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none relative block w-full px-4 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:z-10 sm:text-sm transition-colors"
                                placeholder="Enter your password"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-violet-500 hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-200 transition-all duration-200 shadow-lg shadow-violet-200/60"
                        >
                            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                                <LogIn className="h-5 w-5 text-yellow-100 group-hover:text-white" aria-hidden="true" />
                            </span>
                            Sign In
                        </button>
                        {selectedRole === 'Student' && (
                            <button
                                type="button"
                                onClick={() => navigate('/student/forgot-password')}
                                className="mt-3 w-full text-center text-sm font-semibold text-violet-600 hover:text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:ring-offset-2 rounded-lg py-2 transition-colors"
                            >
                                Forgot password?
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
