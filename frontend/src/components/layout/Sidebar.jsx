import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    Home,
    User,
    Users,
    UserPlus,
    BookOpen,
    Calendar,
    FileText,
    Settings,
    LayoutDashboard,
    ClipboardList,
    GraduationCap,
    Wallet,
    Bell,
    Mail,
    PlayCircle,
    BarChart3
} from 'lucide-react';
import clsx from 'clsx';
import logo from '../../assets/logo.png';

const Sidebar = () => {
    const { user } = useAuth();
    const [collapsed] = useState(false);

    // Define navigation items based on roles
    const getNavItems = () => {
        const role = user?.role;
        const items = [];

        if (role === 'Admin') {
            items.push(
                { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
                { name: 'Departments', path: '/admin/departments', icon: Home },
                { name: 'Students', path: '/admin/students', icon: GraduationCap },
                { name: 'Faculty', path: '/admin/faculty', icon: Users },
                { name: 'Create Account', path: '/admin/create-account', icon: UserPlus },
                { name: 'Subjects', path: '/admin/subjects', icon: BookOpen },
                { name: 'Allocation', path: '/admin/allocation', icon: ClipboardList },
                { name: 'Audit Logs', path: '/admin/audit-logs', icon: FileText },
                { name: 'Inbox', path: '/admin/inbox', icon: Mail },
            );
        } else if (role === 'Exam Cell') {
            items.push(
                { name: 'Dashboard', path: '/examcell/dashboard', icon: LayoutDashboard },
                { name: 'Exam Setup', path: '/examcell/exam-setup', icon: Calendar },
                { name: 'Exam Form Review', path: '/examcell/exam-forms', icon: ClipboardList },
                { name: 'Result Processing', path: '/examcell/results', icon: PlayCircle },
                { name: 'Grade Schema', path: '/examcell/grade-schema', icon: BookOpen },
                { name: 'Analytics', path: '/examcell/analytics', icon: BarChart3 },
            );
        } else if (role === 'Faculty') {
            items.push(
                { name: 'Dashboard', path: '/faculty/dashboard', icon: LayoutDashboard },
                { name: 'My Subjects', path: '/faculty/subjects', icon: BookOpen },
                { name: 'Upload Marks', path: '/faculty/marks', icon: ClipboardList },
                { name: 'Marks Overview', path: '/faculty/marks-overview', icon: BarChart3 },
            );
        } else if (role === 'Student') {
            items.push(
                { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
                { name: 'My Profile', path: '/student/profile', icon: User },
                { name: 'My Subjects', path: '/student/subjects', icon: BookOpen },
                { name: 'Fees', path: '/student/fees', icon: FileText },
                { name: 'Exams', path: '/student/exams', icon: Calendar },
                { name: 'Hall Ticket', path: '/student/hall-ticket', icon: ClipboardList },
                { name: 'Results', path: '/student/results', icon: FileText },
            );
        } else if (role === 'Accountant') {
            items.push(
                { name: 'Dashboard', path: '/accountant/dashboard', icon: LayoutDashboard },
                { name: 'Students', path: '/accountant/students', icon: GraduationCap },
                { name: 'Fee Collection', path: '/accountant/fees-collection', icon: FileText },
                { name: 'Partial Records', path: '/accountant/partial-records', icon: Wallet },
            );
        }

        // Common routes for everyone
        items.push({ name: 'Notifications', path: `/${role ? role.replace(' ', '').toLowerCase() : ''}/notifications`, icon: Bell });

        return items;
    };

    const navItems = getNavItems();

    return (
        <aside className={clsx(
            "print:hidden bg-white/70 text-slate-700 flex-shrink-0 flex flex-col min-h-screen transition-all duration-300 border-r border-white/70 backdrop-blur-xl",
            collapsed ? "w-20" : "w-64"
        )}>
            <div className={clsx("h-16 flex items-center border-b border-white/70 bg-white/70", collapsed ? "px-4 justify-between" : "px-6")}>
                <div className="flex items-center">
                    <div className="h-11 w-11 bg-white rounded-full flex items-center justify-center overflow-hidden mr-3 shadow-md shadow-amber-200/40 border-2 border-amber-200/70">
                        <img
                            src={logo}
                            alt="Logo"
                            className="h-7 w-7 object-contain"
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    </div>
                    {!collapsed && (
                        <div>
                            <span className="font-bold text-lg tracking-tight text-slate-800 leading-none">MGM CEN</span>
                            <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-slate-400 mt-0.5">Academic Portal</p>
                        </div>
                    )}
                </div>

            </div>
            <div className={clsx("flex-1 overflow-y-auto py-6 flex flex-col space-y-1", collapsed ? "px-2" : "px-3")}>

                {navItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) => clsx(
                            'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors group',
                            isActive
                                ? (user?.role === 'Accountant'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md shadow-violet-200/60')
                                : 'text-slate-600 hover:bg-white hover:text-slate-900'
                        )}
                        title={collapsed ? item.name : undefined}
                    >
                        <item.icon className={clsx("flex-shrink-0 h-5 w-5", collapsed ? "mx-auto" : "mr-3")} aria-hidden="true" />
                        {!collapsed && item.name}
                    </NavLink>
                ))}
            </div>
        </aside>
    );
};

export default Sidebar;