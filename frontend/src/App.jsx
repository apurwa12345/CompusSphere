import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Home from './pages/home/Home';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import Departments from './pages/admin/Departments';
import Students from './pages/admin/Students';
import Faculty from './pages/admin/Faculty';
import CreateAccount from './pages/admin/CreateAccount';
import Subjects from './pages/admin/Subjects';
import Allocation from './pages/admin/Allocation';
import Exams from './pages/admin/Exams';
import Notifications from './pages/admin/Notifications';
import Inbox from './pages/admin/Inbox';

// Exam Cell Pages
import ExamCellDashboard from './pages/examcell/ExamCellDashboard';
import ExamSetup from './pages/examcell/ExamSetup';
import ExamForms from './pages/examcell/ExamForms';
import Eligibility from './pages/examcell/Eligibility';
import Timetable from './pages/examcell/Timetable';
import Seating from './pages/examcell/Seating';
import HallTicket from './pages/examcell/HallTicket';
import InternalMarks from './pages/examcell/InternalMarks';
import ExternalMarks from './pages/examcell/ExternalMarks';
import MarksVerification from './pages/examcell/MarksVerification';
import ResultProcessing from './pages/examcell/ResultProcessing';
import Backlog from './pages/examcell/Backlog';
import Revaluation from './pages/examcell/Revaluation';
import Supplementary from './pages/examcell/Supplementary';
import ResultPublish from './pages/examcell/ResultPublish';
import Analytics from './pages/examcell/Analytics';
import ExamNotifications from './pages/examcell/ExamNotifications';
import AuditLogs from './pages/examcell/AuditLogs';
import ExamSettings from './pages/examcell/ExamSettings';
import GradeSchema from './pages/examcell/GradeSchema';

// Faculty Pages
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import FacultySubjects from './pages/faculty/FacultySubjects';
import MarksEntry from './pages/faculty/MarksEntry';
import MarksOverview from './pages/faculty/MarksOverview';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentExams from './pages/student/StudentExams';
import StudentResults from './pages/student/StudentResults';
import StudentProfile from './pages/student/StudentProfile';
import StudentSubjects from './pages/student/StudentSubjects';
import StudentFees from './pages/student/StudentFees';
import HallTicketPage from './pages/student/HallTicketPage';
import UserNotifications from './pages/common/UserNotifications';

// Accountant Pages
import AccountantDashboard from './pages/accountant/AccountantDashboard';
import AccountantStudents from './pages/accountant/AccountantStudents';
import AccountantFeeCollection from './pages/accountant/AccountantFeeCollection';
import AccountantPartialRecords from './pages/accountant/AccountantPartialRecords';

const PageFrame = ({ title }) => {
    const { user } = useAuth();
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            <p className="text-slate-500 mt-2">Your current role: <span className="font-bold text-violet-600">{user?.role || 'Guest'}</span></p>
            <p className="text-slate-500 mt-1 italic text-sm">Please contact admin if this is incorrect.</p>
            <div className="mt-8">
                <p className="text-slate-500">This page is under construction.</p>
            </div>
        </div>
    );
};

const App = () => {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/admin/login" element={<Login defaultRole="Admin" />} />
                    <Route path="/examcell/login" element={<Login defaultRole="Exam Cell" />} />
                    <Route path="/faculty/login" element={<Login defaultRole="Faculty" />} />
                    <Route path="/student/login" element={<Login defaultRole="Student" />} />
                    <Route path="/student/forgot-password" element={<ForgotPassword />} />
                    <Route path="/student/reset-password" element={<ResetPassword />} />
                    <Route path="/accountant/login" element={<Login defaultRole="Accountant" />} />
                    <Route path="/" element={<Home />} />
                    <Route path="/unauthorized" element={<PageFrame title="403 - Unauthorized Access" />} />

                    {/* ===== Admin Routes ===== */}
                    <Route path="/admin" element={
                        <ProtectedRoute allowedRoles={['Admin']}>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }>
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="departments" element={<Departments />} />
                        <Route path="students" element={<Students />} />
                        <Route path="faculty" element={<Faculty />} />
                        <Route path="create-account" element={<CreateAccount />} />
                        <Route path="subjects" element={<Subjects />} />
                        <Route path="allocation" element={<Allocation />} />
                        <Route path="exams" element={<Exams />} />
                        <Route path="audit-logs" element={<AuditLogs />} />
                        <Route path="notifications" element={<Notifications />} />
                        <Route path="inbox" element={<Inbox />} />
                    </Route>


                    {/* ===== Exam Cell Routes ===== */}
                    <Route path="/examcell" element={
                        <ProtectedRoute allowedRoles={['Exam Cell', 'Admin']}>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }>
                        <Route path="dashboard" element={<ExamCellDashboard />} />
                        <Route path="exam-setup" element={<ExamSetup />} />
                        <Route path="exam-forms" element={<ExamForms />} />
                        <Route path="eligibility" element={<Eligibility />} />
                        <Route path="timetable" element={<Timetable />} />
                        <Route path="seating" element={<Seating />} />
                        <Route path="hall-ticket" element={<HallTicket />} />
                        <Route path="internal-marks" element={<InternalMarks />} />
                        <Route path="external-marks" element={<ExternalMarks />} />
                        <Route path="marks-verify" element={<MarksVerification />} />
                        <Route path="results" element={<ResultProcessing />} />
                        <Route path="grade-schema" element={<GradeSchema />} />
                        <Route path="backlog" element={<Backlog />} />
                        <Route path="revaluation" element={<Revaluation />} />
                        <Route path="supplementary" element={<Supplementary />} />
                        <Route path="result-publish" element={<ResultPublish />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="notifications" element={<ExamNotifications />} />
                        <Route path="audit" element={<AuditLogs />} />
                        <Route path="settings" element={<ExamSettings />} />
                    </Route>

                    {/* ===== Faculty Routes ===== */}
                    <Route path="/faculty" element={
                        <ProtectedRoute allowedRoles={['Faculty']}>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }>
                        <Route path="dashboard" element={<FacultyDashboard />} />
                        <Route path="subjects" element={<FacultySubjects />} />
                        <Route path="marks" element={<MarksEntry />} />
                        <Route path="marks-overview" element={<MarksOverview />} />
                        <Route path="notifications" element={<UserNotifications />} />
                    </Route>

                    {/* ===== Student Routes ===== */}
                    <Route path="/student" element={
                        <ProtectedRoute allowedRoles={['Student']}>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }>
                        <Route path="dashboard" element={<StudentDashboard />} />
                        <Route path="profile" element={<StudentProfile />} />
                        <Route path="subjects" element={<StudentSubjects />} />
                        <Route path="fees" element={<StudentFees />} />
                        <Route path="exams" element={<StudentExams />} />
                        <Route path="hall-ticket" element={<HallTicketPage />} />
                        <Route path="results" element={<StudentResults />} />
                        <Route path="notifications" element={<UserNotifications />} />
                    </Route>

                    {/* ===== Accountant Routes ===== */}
                    <Route path="/accountant" element={
                        <ProtectedRoute allowedRoles={['Accountant', 'Admin']}>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }>
                        <Route path="dashboard" element={<AccountantDashboard />} />
                        <Route path="students" element={<AccountantStudents />} />
                        <Route path="fees-collection" element={<AccountantFeeCollection />} />
                        <Route path="partial-records" element={<AccountantPartialRecords />} />
                        <Route path="notifications" element={<UserNotifications />} />
                    </Route>

                    {/* Default redirect */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
};

export default App;
