import { type ReactNode } from "react";

export function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-black text-slate-300">
            {/* 1. SIDEBAR SIMPLE */}
            <aside className="w-64 border-r border-slate-800 bg-slate-950/50 p-6 hidden md:block z-20">
                <div className="font-bold text-xl mb-10 text-white tracking-tighter">
                    SNN<span className="text-purple-500">verse</span>
                </div>
                <nav className="space-y-4">
                    <a href="#" className="block px-4 py-2 bg-slate-800 text-white rounded-md">Home</a>
                    <a href="#" className="block px-4 py-2 hover:text-white transition-colors">Studio</a>
                    <a href="#" className="block px-4 py-2 hover:text-white transition-colors">Training</a>
                    <a href="#" className="block px-4 py-2 hover:text-white transition-colors">Settings</a>
                </nav>
            </aside>

            {/* 2. AREA PRINCIPAL */}
            <main className="flex-1 p-8 relative overflow-hidden">
                {/* Aquí irá el contenido y el fondo animado */}
                <div className="relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
}