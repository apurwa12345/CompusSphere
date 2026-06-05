import React, { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/UI';
import { User, Mail, Phone, Building2, IdCard, Calendar, Hash, Users, Camera, Loader2, Trash2 } from 'lucide-react';
import api from '../../services/api';

const InfoRow = ({ icon: Icon, label, value }) => {
    const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
    return (
        <div className="group flex items-start gap-3 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="h-11 w-11 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600">
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{label}</p>
                <p className="text-sm font-semibold text-slate-800">{displayValue || 'Not provided'}</p>
            </div>
        </div>
    );
};

const StudentProfile = () => {
    const { user, refreshUser } = useAuth();
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file size (limit to 1MB)
        if (file.size > 1024 * 1024) {
            alert("Image size should be less than 1MB");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result;
            try {
                setUploading(true);
                await api.post('/auth/update-profile-picture', { profile_picture: base64String });
                await refreshUser();
            } catch (error) {
                console.error("Upload failed", error);
                alert("Failed to upload profile picture");
            } finally {
                setUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const derived = {
        batch_year: user?.batch_year || user?.year
    };

    const baseFields = [
        { key: 'email', label: 'Email', icon: Mail },
        { key: 'mobile', label: 'Mobile', icon: Phone },
        { key: 'department', label: 'Department', icon: Building2 },
        { key: 'department_id', label: 'Department ID', icon: Building2 },
        { key: 'prn', label: 'PRN', icon: IdCard },
        { key: 'current_semester', label: 'Current Semester', icon: Hash },
        { key: 'batch_year', label: 'Batch Year', icon: Calendar },
        { key: 'dob', label: 'Date of Birth', icon: Calendar },
        { key: 'gender', label: 'Gender', icon: Users },
        { key: 'roll_no', label: 'Roll No', icon: Hash },
        { key: 'group', label: 'Group', icon: Users },
        { key: 'abc_id', label: 'ABC ID', icon: IdCard }
    ];

    const excludedKeys = new Set([
        'token',
        'password',
        'student_id',
        'erp_id',
        'enrollment_number',
        'enrollment_no',
        'first_name',
        'last_name',
        'phone',
        'semester',
        'year',
        'profile_picture'
    ]);
    const knownKeys = new Set(baseFields.map((f) => f.key));

    const isProvided = (value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim() !== '';
        return true;
    };
    const extraFields = Object.entries(user || {})
        .filter(([k, v]) => !excludedKeys.has(k) && !knownKeys.has(k) && isProvided(v) && k !== 'name' && k !== 'role' && k !== '_id' && k !== 'created_at')
        .map(([k, v]) => ({ key: k, label: k.replace(/_/g, ' ').toUpperCase(), value: v }));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
                <p className="text-slate-500">Your student details and academic information.</p>
            </div>

            <Card className="p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-50 via-white to-white opacity-90" />
                <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
                    <div className="relative group">
                        <div className="h-24 w-24 rounded-3xl bg-violet-500 text-white flex items-center justify-center text-3xl font-bold shadow-xl shadow-violet-200/60 overflow-hidden">
                            {user?.profile_picture ? (
                                <img src={user.profile_picture} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                (user?.name || 'S').slice(0, 1).toUpperCase()
                            )}
                        </div>
                        {user?.profile_picture && (
                            <button 
                                onClick={async () => {
                                    if(window.confirm('Remove profile picture?')) {
                                        try {
                                            setUploading(true);
                                            await api.delete('/auth/delete-profile-picture');
                                            await refreshUser();
                                        } catch (e) {
                                            alert('Failed to remove profile picture');
                                        } finally {
                                            setUploading(false);
                                        }
                                    }
                                }}
                                disabled={uploading}
                                className="absolute -bottom-2 -left-2 p-2 bg-white rounded-xl shadow-lg border border-slate-100 text-red-500 hover:scale-110 transition-transform active:scale-95 disabled:opacity-50"
                                title="Remove photo"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="absolute -bottom-2 -right-2 p-2 bg-white rounded-xl shadow-lg border border-slate-100 text-violet-600 hover:scale-110 transition-transform active:scale-95 disabled:opacity-50"
                        >
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept="image/*" 
                            className="hidden" 
                        />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{user?.name || 'Student Name'}</h2>
                        <p className="text-sm text-slate-500 font-medium">{user?.email || 'student@email.com'}</p>
                        <div className="flex gap-2 mt-3">
                            <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-violet-700">
                                {user?.role || 'Student'}
                            </span>
                            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                                Active Profile
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {baseFields.map((f) => (
                    <InfoRow key={f.key} icon={f.icon} label={f.label} value={derived[f.key] ?? user?.[f.key]} />
                ))}
                {extraFields.map((f) => (
                    <InfoRow key={f.key} icon={User} label={f.label} value={f.value} />
                ))}
            </div>
        </div>
    );
};

export default StudentProfile;
