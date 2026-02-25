import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

const API_URL = '/api/auth';

interface User {
    username: string;
    user_id: string;
    is_guest: boolean;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isGuest: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    upgradeGuest: (username: string, password: string) => Promise<void>;
    loginWithGoogle: () => void;
    logout: () => void;
    token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(true);

    const storeToken = useCallback((newToken: string) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
    }, []);

    const clearAuth = useCallback(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    }, []);

    const fetchMe = useCallback(async (accessToken: string): Promise<User | null> => {
        try {
            const response = await fetch(`${API_URL}/me`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch {
            return null;
        }
    }, []);

    const createGuestSession = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/guest`, { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                storeToken(data.access_token);
                const userData = await fetchMe(data.access_token);
                if (userData) setUser(userData);
            }
        } catch (error) {
            console.error('Failed to create guest session:', error);
        }
    }, [storeToken, fetchMe]);

    useEffect(() => {
        const initAuth = async () => {
            // Check for Google OAuth callback token in URL
            const urlParams = new URLSearchParams(window.location.search);
            const callbackToken = urlParams.get('token');

            if (callbackToken) {
                // Remove token from URL without reload
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);

                storeToken(callbackToken);
                const userData = await fetchMe(callbackToken);
                if (userData) {
                    setUser(userData);
                    setIsLoading(false);
                    return;
                }
            }

            // Try existing stored token
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                const userData = await fetchMe(storedToken);
                if (userData) {
                    setUser(userData);
                    setToken(storedToken);
                    setIsLoading(false);
                    return;
                }
                // Token invalid — clear it
                localStorage.removeItem('token');
                setToken(null);
            }

            // No valid token — auto-create guest session
            await createGuestSession();
            setIsLoading(false);
        };

        initAuth();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const login = async (username: string, password: string) => {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Login failed');
        }

        const data = await response.json();
        storeToken(data.access_token);

        const userData = await fetchMe(data.access_token);
        if (userData) setUser(userData);
    };

    const register = async (username: string, password: string) => {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Registration failed');
        }
    };

    const upgradeGuest = async (username: string, password: string) => {
        if (!token) throw new Error('No active session');

        const response = await fetch(`${API_URL}/upgrade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Upgrade failed');
        }

        const data = await response.json();
        storeToken(data.access_token);

        const userData = await fetchMe(data.access_token);
        if (userData) setUser(userData);
    };

    const loginWithGoogle = () => {
        // Pass guest token so the backend can merge the guest account
        const guestParam = user?.is_guest && token ? `?guest_token=${encodeURIComponent(token)}` : '';
        window.location.href = `${API_URL}/google/login${guestParam}`;
    };

    const logout = () => {
        clearAuth();
        // Create a fresh guest session after logout
        createGuestSession();
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isGuest: user?.is_guest ?? true,
                isLoading,
                login,
                register,
                upgradeGuest,
                loginWithGoogle,
                logout,
                token,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
