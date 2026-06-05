import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../../components/common/UI';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { Plus, Search } from 'lucide-react';
import api from '../../services/api';

const Departments = () => {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', code: '' });
    const [editingId, setEditingId] = useState(null);

    const fetchDepartments = async () => {
        try {
            setLoading(true);
            const res = await api.get('/academic/departments');
            setDepartments(res.data);
        } catch (error) {
            console.error("Error fetching departments", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/academic/departments/${editingId}`, formData);
            } else {
                await api.post('/academic/departments', formData);
            }
            setIsModalOpen(false);
            setFormData({ name: '', code: '' });
            setEditingId(null);
            fetchDepartments();
        } catch (error) {
            console.error(error);
            alert('Failed to save department');
        }
    };

    const handleEdit = (row) => {
        setFormData({ name: row.name || '', code: row.code || '' });
        setEditingId(row._id);
        setIsModalOpen(true);
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Delete department "${row.name}"?`)) return;
        try {
            await api.delete(`/academic/departments/${row._id}`);
            fetchDepartments();
        } catch (error) {
            console.error(error);
            alert('Failed to delete department');
        }
    };

    const filteredDepartments = departments.filter(d => 
        d.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        d.code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
        { header: 'Code', accessor: 'code' },
        { header: 'Department Name', accessor: 'name' },
        { 
            header: 'Actions', 
            cell: (row) => (
                <div className="flex space-x-2">
                    <button type="button" onClick={() => handleEdit(row)} className="text-primary hover:text-primary-dark font-medium text-sm">Edit</button>
                    <button type="button" onClick={() => handleDelete(row)} className="text-red-500 hover:text-red-700 font-medium text-sm">Delete</button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
                    <p className="text-slate-500 text-sm">Manage academic departments and codes.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Department
                </Button>
            </div>

            <Card>
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            className="pl-9" 
                            placeholder="Search departments..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Loading...</div>
                ) : (
                    <Table columns={columns} data={filteredDepartments} keyField="_id" />
                )}
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingId(null); }} title={editingId ? "Edit Department" : "Add New Department"}>
                <form onSubmit={handleCreate} className="space-y-4 pt-2">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Department Code</label>
                        <Input 
                            required 
                            placeholder="e.g. CSE" 
                            value={formData.code}
                            onChange={(e) => setFormData({...formData, code: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Department Name</label>
                        <Input 
                            required 
                            placeholder="e.g. Computer Science and Engineering" 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit">{editingId ? "Update Department" : "Save Department"}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Departments;
