import { type ReactNode } from "react";
import { GridBackground } from "../ui/gridBackground";

export function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className="relative min-h-screen flex flex-col md:flex-row bg-black text-slate-300">
            <GridBackground />
            <main className="flex-1 p-8 relative overflow-hidden">
                <div className="relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
}