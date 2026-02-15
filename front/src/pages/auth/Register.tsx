import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { StarfieldBackground } from '../../components/starfield-background';
import { GridBeam } from '../../components/grid-beam';
import { BrainCircuit, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';

const Register = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);
        try {
            await register(username, password);
            setSuccess('Registration successful! Redirecting to login...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err: any) {
            setError(err.message || 'Registration failed');
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
                            Join <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">SNNverse</span>
                        </h1>
                        <p className="text-sm text-neutral-400">
                            Create an account to build neuromorphic networks
                        </p>
                    </div>

                    {/* Register Form Card */}
                    <div className="group relative rounded-xl border border-white/[0.08] bg-neutral-900/60 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-violet-500/30">
                        {/* Animated glow on hover */}
                        <div className="pointer-events-none absolute -inset-[1px] rounded-xl bg-gradient-to-r from-violet-500/0 via-violet-500/20 to-blue-500/0 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />

                        <div className="relative">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {error && (
                                    <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-900/20 px-4 py-3 text-sm text-red-200 backdrop-blur-sm">
                                        <Zap className="h-4 w-4" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {success && (
                                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200 backdrop-blur-sm">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>{success}</span>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="username" className="mb-2 block text-sm font-medium text-neutral-300">
                                        Username
                                    </label>
                                    <input
                                        id="username"
                                        name="username"
                                        type="text"
                                        required
                                        className="w-full rounded-lg border border-white/[0.08] bg-neutral-950/50 px-4 py-3 text-neutral-100 placeholder-neutral-500 backdrop-blur-sm transition-all duration-200 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                        placeholder="Choose a username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="password" className="mb-2 block text-sm font-medium text-neutral-300">
                                        Password
                                    </label>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        className="w-full rounded-lg border border-white/[0.08] bg-neutral-950/50 px-4 py-3 text-neutral-100 placeholder-neutral-500 backdrop-blur-sm transition-all duration-200 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                        placeholder="Create a password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-neutral-300">
                                        Confirm Password
                                    </label>
                                    <input
                                        id="confirm-password"
                                        name="confirm-password"
                                        type="password"
                                        required
                                        className="w-full rounded-lg border border-white/[0.08] bg-neutral-950/50 px-4 py-3 text-neutral-100 placeholder-neutral-500 backdrop-blur-sm transition-all duration-200 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                        placeholder="Confirm your password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                                                Creating account...
                                            </>
                                        ) : (
                                            <>
                                                Create Account
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
                                    Already have an account?{' '}
                                    <Link
                                        to="/login"
                                        className="font-medium text-violet-400 transition-colors hover:text-violet-300"
                                    >
                                        Sign in instead
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

export default Register;
