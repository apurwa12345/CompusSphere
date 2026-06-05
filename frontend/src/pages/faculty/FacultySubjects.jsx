import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/UI';
import Table from '../../components/common/Table';
import { BookOpen, FileText, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const FacultySubjects = () => {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const res = await api.get('/academic/faculty/my-subjects');
                setSubjects(res.data);
                setError(null);
            } catch (err) {
                console.error(err);
                setError('Failed to load subjects. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchSubjects();
    }, []);

    const columns = [
        { header: 'Code', accessor: 'code' },
        { header: 'Subject Name', accessor: 'name' },
        { header: 'Type', accessor: 'type' },
        { header: 'Semester', accessor: 'semester' },
        { header: 'Credits', accessor: 'credits' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Subjects</h1>
                <p className="text-slate-500">Overview of subjects assigned to you for instruction and evaluation.</p>
            </div>

            <Card className="p-6 border-none shadow-xl shadow-slate-200/50">
                <div className="flex items-center mb-8">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mr-4 shadow-sm shadow-indigo-100">
                        <BookOpen className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Assigned Subjects</h2>
                        <p className="text-sm text-slate-500">Manage and view your teaching load.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center text-sm border border-red-100">
                        <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                        {error}
                    </div>
                ) : subjects.length > 0 ? (
                    <Table 
                        columns={columns} 
                        data={subjects} 
                        headerClassName="bg-slate-50/50 text-slate-500 uppercase tracking-widest text-[10px] font-black"
                        rowClassName="hover:bg-indigo-50/30 transition-colors border-b border-slate-50 last:border-0"
                    />
                ) : (
                    <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                        <FileText className="h-14 w-14 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-base font-bold text-slate-900">No subjects assigned</h3>
                        <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                            You currently have no subjects allocated. Please contact the department HOD or Admin.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default FacultySubjects;
