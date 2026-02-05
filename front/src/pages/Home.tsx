import { DashboardLayout } from "../components/layout/DashboardLayout";
import { Button } from "@/components/ui/button"; // de tu shadcn
import DotPattern from "../components/ui/dot-pattern"; // de Magic UI
import { cn } from "@/lib/utils";
import { Plus, Brain, Activity, Cpu } from "lucide-react"; // Iconos

export default function Home() {
    return (
        <DashboardLayout>
            {/* 1. EL FONDO MAGIC UI (Background Layer) */}
            <DotPattern
                width={20}
                height={20}
                cx={1}
                cy={1}
                cr={1}
                className={cn(
                    "absolute inset-0 h-full w-full opacity-20 [mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
                )}
            />

            {/* 2. EL CONTENIDO GENERADO (Foreground Layer) */}
            <div className="max-w-5xl mx-auto space-y-12">

                {/* Header Section */}
                <div className="flex justify-between items-end border-b border-slate-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
                        <p className="text-slate-400 mt-2">Welcome back to SNNverse. Ready to spike?</p>
                    </div>
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                        <Plus className="mr-2 h-4 w-4" /> New Network
                    </Button>
                </div>

                {/* Templates Grid (Lo que v0 te generaría mejorado) */}
                <section>
                    <h2 className="text-xl font-semibold text-white mb-4">Quick Start Templates</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Card 1 */}
                        <div className="group relative p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-purple-500/50 transition-all cursor-pointer overflow-hidden">
                            <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Brain className="h-8 w-8 text-purple-400 mb-4" />
                            <h3 className="text-lg font-medium text-white">Edge Detection</h3>
                            <p className="text-sm text-slate-400 mt-2">Pre-configured retina layers for visual processing.</p>
                        </div>

                        {/* Card 2 */}
                        <div className="group relative p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-blue-500/50 transition-all cursor-pointer">
                            <Cpu className="h-8 w-8 text-blue-400 mb-4" />
                            <h3 className="text-lg font-medium text-white">Logic Gates</h3>
                            <p className="text-sm text-slate-400 mt-2">XOR, AND, OR implementations using LIF neurons.</p>
                        </div>

                        {/* Card 3 */}
                        <div className="group relative p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-green-500/50 transition-all cursor-pointer">
                            <Activity className="h-8 w-8 text-green-400 mb-4" />
                            <h3 className="text-lg font-medium text-white">Oscillator</h3>
                            <p className="text-sm text-slate-400 mt-2">Self-sustaining spiking loops and central pattern generators.</p>
                        </div>

                    </div>
                </section>

                {/* Recent Projects Table (Simplificado) */}
                <section>
                    <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
                    <div className="rounded-md border border-slate-800 bg-slate-950/30">
                        {/* Aquí pegarías la tabla que te genere v0.dev */}
                        <div className="p-4 text-slate-500 text-center italic">No recent networks found.</div>
                    </div>
                </section>

            </div>
        </DashboardLayout>
    );
}