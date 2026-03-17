import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { StarfieldBackground } from '../../components/starfield-background';
import { GridBeam } from '../../components/grid-beam';
import { BrainCircuit, Zap, ArrowRight } from 'lucide-react';
import { Input } from '../../components/ui/input';

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
        />
        <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
        />
        <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
        />
        <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
        />
    </svg>
);

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(username, password);
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-neutral-950">
            <StarfieldBackground />
            <GridBeam />

            {/* Top ambient glow */}
            <div
                className="pointer-events-none absolute -top-40 left-1/2 z-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full opacity-20 blur-[120px]"
                style={{
                    background:
                        "radial-gradient(ellipse, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.1), transparent)",
                }}
                aria-hidden="true"
            />

            <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
                <div className="w-full max-w-xl" style={{ minWidth: '480px' }}>
                    {/* Logo/Brand Section */}
                    <div className="mb-8 text-center">
                        <div className="mb-4 inline-flex items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 p-3 backdrop-blur-sm">
                            <BrainCircuit className="h-8 w-8 text-violet-400" />
                        </div>
                        <h1 className="mb-2 text-4xl font-bold text-neutral-100 whitespace-nowrap">
                            Welcome to <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">SpikeVerse</span>
                        </h1>
                        <p className="text-sm text-neutral-400">
                            Sign in to access your neuromorphic networks
                        </p>
                    </div>

                    {/* Login Form Card */}
                    <div className="group relative rounded-xl border border-white/[0.08] bg-neutral-900/60 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-violet-500/30">
                        {/* Animated glow on hover */}
                        <div className="pointer-events-none absolute -inset-[1px] rounded-xl bg-gradient-to-r from-violet-500/0 via-violet-500/20 to-blue-500/0 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />

                        <div className="relative">
                            {/* Google Sign In */}
                            <button
                                type="button"
                                onClick={loginWithGoogle}
                                className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/[0.08] bg-neutral-950/50 px-4 py-3 text-sm font-medium text-neutral-200 backdrop-blur-sm transition-all duration-200 hover:border-white/[0.16] hover:bg-neutral-900/80"
                            >
                                <GoogleIcon />
                                Sign in with Google
                            </button>

                            {/* Divider */}
                            <div className="relative my-6 flex items-center">
                                <div className="flex-1 border-t border-white/[0.06]" />
                                <span className="px-4 text-xs uppercase tracking-wider text-neutral-500">or continue with</span>
                                <div className="flex-1 border-t border-white/[0.06]" />
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-900/20 px-4 py-3 text-sm text-red-200 backdrop-blur-sm">
                                        <Zap className="h-4 w-4" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="username" className="mb-2 block text-sm font-medium text-neutral-300">
                                        Username
                                    </label>
                                    <Input
                                        id="username"
                                        name="username"
                                        type="text"
                                        required
                                        className="h-11 rounded-xl border-white/[0.12] bg-neutral-950/70 px-4 text-neutral-100 placeholder:text-neutral-500 backdrop-blur-sm focus-visible:border-violet-500/60 focus-visible:ring-violet-500/20"
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="password" className="mb-2 block text-sm font-medium text-neutral-300">
                                        Password
                                    </label>
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        className="h-11 rounded-xl border-white/[0.12] bg-neutral-950/70 px-4 text-neutral-100 placeholder:text-neutral-500 backdrop-blur-sm focus-visible:border-violet-500/60 focus-visible:ring-violet-500/20"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="group/btn relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-4 py-3 font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        {isLoading ? (
                                            <>
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                                Signing in...
                                            </>
                                        ) : (
                                            <>
                                                Sign in
                                                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                                            </>
                                        )}
                                    </span>
                                    {/* Animated gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-blue-600 opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100" />
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <p className="text-sm text-neutral-400">
                                    {"Don't have an account? "}
                                    <Link
                                        to="/register"
                                        className="font-medium text-violet-400 transition-colors hover:text-violet-300"
                                    >
                                        Create one now
                                    </Link>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer tagline */}
                    <p className="mt-8 text-center text-xs text-neutral-600">
                        Powered by neuromorphic engineering & GPU-accelerated computation
                    </p>
                </div>
            </div>
        </main>
    );
};

export default Login;
