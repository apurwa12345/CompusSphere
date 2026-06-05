import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const roleLoginMap = {
    admin: { path: '/admin/login', selectedRole: 'Admin' },
    examcell: { path: '/examcell/login', selectedRole: 'Exam Cell' },
    faculty: { path: '/faculty/login', selectedRole: 'Faculty' },
    student: { path: '/student/login', selectedRole: 'Student' },
    accountant: { path: '/accountant/login', selectedRole: 'Accountant' },
};

const getRoleAwareLoginRedirect = (pathname) => {
    const seg = (pathname || '').split('/').filter(Boolean)[0]?.toLowerCase();
    return roleLoginMap[seg] || { path: '/login', selectedRole: '' };
};

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="flex h-screen items-center justify-center text-primary text-xl">Loading...</div>;
    }

    if (!user) {
        const redirect = getRoleAwareLoginRedirect(location.pathname);
        return (
            <Navigate
                to={redirect.path}
                state={{ from: location, selectedRole: redirect.selectedRole }}
                replace
            />
        );
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // user is logged in but doesn't have the explicit role required
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
};

export default ProtectedRoute;
