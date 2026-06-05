import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/UI';
import Table from '../../components/common/Table';
import { BookOpen, FileText, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const StudentSubjects = () => {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const res = await api.get('/academic/student/subjects');
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
        { header: 'Subject Code', accessor: 'code' },
        { header: 'Subject Name', accessor: 'name' },
        { header: 'Type', accessor: 'type' },
        { header: 'Credits', accessor: 'credits' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">My Subjects</h1>
                <p className="text-slate-500">View the subjects you are enrolled in for the current semester.</p>
            </div>

            <Card className="p-6">
                <div className="flex items-center mb-6">
                    <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center mr-4">
                        <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Current Semester Subjects</h2>
                        <p className="text-sm text-slate-500">The list of subjects applied to your academic profile.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center text-sm">
                        <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                        {error}
                    </div>
                ) : subjects.length > 0 ? (
                    <Table columns={columns} data={subjects} />
                ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-sm font-medium text-slate-900">No subjects found</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Your subjects for this semester have not been assigned yet.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default StudentSubjects;
