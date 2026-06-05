import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const DashboardLayout = () => {
    return (
        <div className="relative flex h-screen overflow-hidden bg-gradient-to-br from-[#f5f0ff] via-[#f2ecff] to-[#eef2ff] font-sans print:h-auto print:bg-white print:overflow-visible">
            <div className="pointer-events-none absolute inset-0 print:hidden">
                <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-violet-200/50 blur-3xl" />
                <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />
                <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-fuchsia-200/30 blur-3xl" />
            </div>
            <Sidebar />
            <div className="relative flex flex-col flex-1 overflow-hidden print:overflow-visible print:block">
                <Header />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 print:p-0 print:overflow-visible">
                    <div className="max-w-7xl mx-auto print:max-w-none print:m-0">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
