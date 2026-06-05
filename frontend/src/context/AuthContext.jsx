import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await api.get('/auth/profile');
                    setUser({
                        ...response.data,
                        token // Keep token in state if needed, but it's mainly in localStorage
                    });
                } catch (error) {
                    localStorage.removeItem('token');
                    setUser(null);
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { access_token } = response.data;
            localStorage.setItem('token', access_token);
            
            // Fetch full profile after login to populate all fields
            const profileRes = await api.get('/auth/profile');
            setUser({ 
                ...profileRes.data,
                token: access_token 
            });
            return { role: profileRes.data?.role, name: profileRes.data?.name };
        } catch (error) {
            // Re-throw the original error so Login component can handle it properly
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    const refreshUser = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await api.get('/auth/profile');
                setUser({
                    ...response.data,
                    token
                });
            } catch (error) {
                console.error("Failed to refresh user", error);
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
