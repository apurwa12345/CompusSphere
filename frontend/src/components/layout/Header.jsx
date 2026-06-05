import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

const Header = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    
    const getDashboardName = () => {
        switch(user?.role) {
            case 'Admin':
                return 'Admin Dashboard';
            case 'Exam Cell':
                return 'Exam Cell Dashboard';
            case 'Faculty':
                return 'Faculty Dashboard';
            case 'Student':
                return 'Student Dashboard';
            case 'Accountant':
                return 'Accountant Dashboard';
            default:
                return 'Dashboard';
        }
    };
    
    const handleLogout = () => {
        // Navigate away from protected routes first, then clear auth.
        // This avoids ProtectedRoute redirecting to a role-login page mid-logout.
        // Use both SPA navigation and a hard redirect to guarantee Home renders,
        // even if some stale state briefly tries to redirect to role-login.
        navigate('/', { replace: true });
        setTimeout(() => {
            logout();
            window.location.replace('/');
        }, 0);
    };

    return (
        <header className="print:hidden bg-white/70 backdrop-blur-xl shadow-sm border-b border-white/70 h-16 flex items-center justify-between px-8 z-10 sticky top-0">

            {/* Brand/Dashboard Name on Left */}
            <div className="flex flex-col">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest opacity-50">{getDashboardName()}</h2>
            </div>

            {/* Profile & Logout on Right */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 pr-6 border-r border-slate-100">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-slate-800 leading-tight">{user?.name || 'User'}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{user?.email || 'user@example.com'}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-violet-500 text-white flex items-center justify-center font-bold text-sm overflow-hidden shadow-sm ring-2 ring-white ring-offset-2 ring-offset-slate-50">
                        {user?.profile_picture ? (
                            <img src={user.profile_picture} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                            (user?.name || 'U').slice(0, 1).toUpperCase()
                        )}
                    </div>
                </div>
                
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-all shadow-sm active:scale-95"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </button>
            </div>

        </header>
    );
};

export default Header;