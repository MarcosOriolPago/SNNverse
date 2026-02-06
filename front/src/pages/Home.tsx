import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Plus,
    Zap,
    BrainCircuit,
    Activity,
    Waves,
    Eye,
    Network,
    Cpu,
    ArrowUpRight,
} from "lucide-react"
import { StarfieldBackground } from "@/components/starfield-background"
import { GridBeam } from "@/components/grid-beam"
import { GlowCard } from "@/components/glow-card"
import { SpikeButton } from "@/components/spike-button"
import { TextHoverEffect } from "@/components/ui/text-hover-effect"

const starterTemplates = [
    {
        icon: Eye,
        title: "Edge Detection SNN",
        description:
            "Gabor-filter inspired spiking network for visual edge extraction. Uses Izhikevich neurons with lateral inhibition for contrast enhancement.",
        tag: "Vision",
    },
    {
        icon: Network,
        title: "LIF Logic Gates",
        description:
            "Leaky Integrate-and-Fire neurons wired as AND, OR, XOR gates. A minimal example of spike-based Boolean computation.",
        tag: "Fundamentals",
    },
    {
        icon: Waves,
        title: "Central Pattern Generator",
        description:
            "Recurrent SNN producing rhythmic oscillatory patterns. Demonstrates emergent timing through synaptic delays and inhibitory feedback.",
        tag: "Motor Control",
    },
]

const recentNetworks = [
    {
        name: "retina_v2_gabor",
        type: "Izhikevich",
        neurons: 2048,
        lastModified: "2 hours ago",
        status: "Simulated",
    },
    {
        name: "stdp_classifier",
        type: "LIF",
        neurons: 512,
        lastModified: "Yesterday",
        status: "Simulated",
    },
    {
        name: "cpg_locomotion",
        type: "Hodgkin-Huxley",
        neurons: 128,
        lastModified: "3 days ago",
        status: "Draft",
    },
    {
        name: "winner_take_all",
        type: "LIF",
        neurons: 256,
        lastModified: "5 days ago",
        status: "Simulated",
    },
    {
        name: "spike_timing_exp",
        type: "Izhikevich",
        neurons: 64,
        lastModified: "1 week ago",
        status: "Draft",
    },
]

export default function DashboardPage() {
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

            <div className="relative z-10 mx-auto max-w-6xl px-6 py-12">
                {/* Header Section */}
                <header className="mb-16">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div className="mb-3 flex items-center gap-2">
                                <BrainCircuit className="h-5 w-5 text-violet-400" />
                                <span className="text-xs font-medium uppercase tracking-widest text-violet-400/80">
                                    SNNverse Workspace
                                </span>
                            </div>
                            <h1 className="text-5xl">
                                <TextHoverEffect text="Welcome back" />
                            </h1>
                            <p className="mt text-base leading-relaxed text-neutral-400">
                                Build, simulate, and visualize Spiking Neural Networks with
                                GPU-accelerated computation through GeNN.
                            </p>
                        </div>
                        <SpikeButton>
                            <Plus className="h-4 w-4" />
                            New Network
                        </SpikeButton>
                    </div>

                    {/* Stats row */}
                    <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {[
                            { label: "Networks", value: "12", icon: Network },
                            { label: "Simulations", value: "47", icon: Activity },
                            { label: "Total Neurons", value: "8.2k", icon: Cpu },
                            { label: "Spike Events", value: "1.4M", icon: Zap },
                        ].map((stat) => (
                            <div
                                key={stat.label}
                                className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-3 backdrop-blur-sm"
                            >
                                <stat.icon className="h-4 w-4 text-violet-400/60" />
                                <div>
                                    <p className="text-lg font-semibold tabular-nums text-neutral-100">
                                        {stat.value}
                                    </p>
                                    <p className="text-xs text-neutral-500">{stat.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </header>

                {/* Starter Templates */}
                <section className="mb-14">
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-400">
                            Starter Templates
                        </h2>
                        <span className="text-xs text-neutral-600">
                            {starterTemplates.length} available
                        </span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        {starterTemplates.map((template) => (
                            <GlowCard key={template.title} className="cursor-pointer">
                                <div className="p-6">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-violet-500/[0.06]">
                                            <template.icon className="h-5 w-5 text-violet-400" />
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="border-white/[0.06] bg-transparent text-[10px] font-medium uppercase tracking-wider text-neutral-500"
                                        >
                                            {template.tag}
                                        </Badge>
                                    </div>
                                    <h3 className="mb-2 text-base font-medium text-neutral-100">
                                        {template.title}
                                    </h3>
                                    <p className="text-sm leading-relaxed text-neutral-500">
                                        {template.description}
                                    </p>
                                    <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-violet-400/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                        <span>Use template</span>
                                        <ArrowUpRight className="h-3 w-3" />
                                    </div>
                                </div>
                            </GlowCard>
                        ))}
                    </div>
                </section>

                {/* Recent Networks */}
                <section>
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-400">
                            Recent Networks
                        </h2>
                        <span className="text-xs text-neutral-600">
                            {recentNetworks.length} networks
                        </span>
                    </div>
                    <GlowCard>
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/[0.04] hover:bg-transparent">
                                    <TableHead className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                                        Name
                                    </TableHead>
                                    <TableHead className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                                        Neuron Model
                                    </TableHead>
                                    <TableHead className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                                        Neurons
                                    </TableHead>
                                    <TableHead className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                                        Last Modified
                                    </TableHead>
                                    <TableHead className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                                        Status
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentNetworks.map((network) => (
                                    <TableRow
                                        key={network.name}
                                        className="cursor-pointer border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                                    >
                                        <TableCell className="font-mono text-sm text-neutral-200">
                                            {network.name}
                                        </TableCell>
                                        <TableCell className="text-sm text-neutral-400">
                                            {network.type}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm tabular-nums text-neutral-400">
                                            {network.neurons.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-sm text-neutral-500">
                                            {network.lastModified}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    network.status === "Simulated"
                                                        ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
                                                        : "border-neutral-500/20 bg-neutral-500/[0.06] text-neutral-500"
                                                }
                                            >
                                                <span
                                                    className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${network.status === "Simulated"
                                                        ? "bg-emerald-400"
                                                        : "bg-neutral-500"
                                                        }`}
                                                />
                                                {network.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </GlowCard>
                </section>
            </div>
        </main>
    )
}
