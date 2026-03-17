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
    Trash2,
} from "lucide-react"
import { StarfieldBackground } from "@/components/starfield-background"
import { GridBeam } from "@/components/grid-beam"
import { GlowCard } from "@/components/glow-card"
import { SpikeButton } from "@/components/spike-button"
import { TextHoverEffect } from "@/components/ui/text-hover-effect"
import { useNavigate } from "react-router-dom"
import { useNetworkIO } from "@/lib/useNetworkIO"
import { useEffect, useState } from "react"
import { LogoHoverEffect } from "@/components/ui/logo-hover-effect"
import { UserMenu } from "@/components/UserMenu"
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
    const navigate = useNavigate();
    const { listNetworks, listTemplates, deleteNetwork } = useNetworkIO();
    const { isLoading: authLoading } = useAuth();
    const [starterTemplates, setStarterTemplates] = useState<any[]>([]);
    const [recentNetworks, setRecentNetworks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchNetworks = async () => {
            if (authLoading) return;

            setIsLoading(true);
            try {
                // Fetch user networks
                const networks = await listNetworks();

                if (!networks || !Array.isArray(networks)) {
                    setRecentNetworks([]);
                } else {
                    // Sort by created_at desc if available, mapped to UI format
                    const mapped = networks.map((n: any) => ({
                        name: n.name,
                        networkId: n.network_id ?? '',
                        type: "LIF",
                        neurons: n.num_nodes ?? 0,
                        createdAt: n.created_at ? new Date(n.created_at).toLocaleDateString() : "Unknown",
                        status: n.is_compiled ? "Simulated" : "Draft"
                    }));
                    setRecentNetworks(mapped);
                }

                // Fetch template networks
                const templates = await listTemplates();
                if (templates && Array.isArray(templates)) {
                    const mappedTemplates = templates.map((t: any) => {
                        let icon = Network;
                        let tag = "Fundamentals";

                        if (t.name.includes("Edge")) {
                            icon = Eye;
                            tag = "Vision";
                        } else if (t.name.includes("Pattern")) {
                            icon = Waves;
                            tag = "Motor Control";
                        }

                        return {
                            icon,
                            title: t.name,
                            description: t.description || "A starter network template.",
                            tag,
                            networkName: t.name,
                            networkId: t.network_id,
                        };
                    });
                    setStarterTemplates(mappedTemplates);
                }

            } finally {
                setIsLoading(false);
            }
        };
        fetchNetworks();
    }, [authLoading]); // listNetworks is now stable (reads token from ref), so no need to list it here

    const handleNetworkClick = (networkName: string, networkId: string, isTemplate = false) => {
        const params = new URLSearchParams({
            networkName,
            loadConfig: 'true',
            ...(networkId ? { networkId } : {}),
            ...(isTemplate ? { isTemplate: 'true' } : {}),
        });
        navigate(`/studio?${params.toString()}`);
    };

    const handleNewNetwork = () => {
        navigate('/studio');
    };

    const handleDeleteNetwork = async (e: React.MouseEvent, networkId: string) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this network?")) {
            const success = await deleteNetwork(networkId);
            if (success) {
                setRecentNetworks(prev => prev.filter(n => n.networkId !== networkId));
            } else {
                alert("Failed to delete network.");
            }
        }
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-neutral-950">
            <StarfieldBackground />
            <GridBeam />

            <div className="pointer-events-auto fixed inset-0 z-[1] flex items-start justify-center pt-[8vh]">
                <div className="h-[420px] w-[800px] max-w-[90vw]">
                    <LogoHoverEffect className="h-full w-full" />
                </div>
            </div>

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
                    {/* Top bar with workspace label and user menu */}
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BrainCircuit className="h-5 w-5 text-violet-400" />
                            <span className="text-xs font-medium uppercase tracking-widest text-violet-400/80">
                                SpikeVerse Workspace
                            </span>
                        </div>
                        <UserMenu />
                    </div>

                    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-5xl">
                                <TextHoverEffect text="Welcome back" />
                            </h1>
                            <p className="mt text-base leading-relaxed text-neutral-400">
                                Build, simulate, and visualize Spiking Neural Networks with
                                GPU-accelerated computation through GeNN.
                            </p>
                        </div>
                        <SpikeButton onClick={handleNewNetwork}>
                            <Plus className="h-4 w-4" />
                            New Network
                        </SpikeButton>
                    </div>

                    {/* Stats row */}
                    <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {[
                            { label: "Networks", value: String(recentNetworks.length), icon: Network },
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
                            <GlowCard
                                key={template.title}
                                className="cursor-pointer"
                                onClick={() => handleNetworkClick(template.networkName, template.networkId, true)}
                            >
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
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow className="border-white/[0.04]">
                                        <TableCell colSpan={6} className="text-center text-neutral-500 py-8">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                                                Loading networks...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : recentNetworks.length === 0 ? (
                                    <TableRow className="border-white/[0.04]">
                                        <TableCell colSpan={6} className="text-center text-neutral-500 py-8">
                                            No saved networks found. Create one to get started!
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    recentNetworks.map((network) => (
                                        <TableRow
                                            key={network.name}
                                            className="cursor-pointer border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                                            onClick={() => handleNetworkClick(network.name, network.networkId, false)}
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
                                                {network.createdAt}
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
                                            <TableCell>
                                                <button
                                                    onClick={(e) => handleDeleteNetwork(e, network.networkId)}
                                                    className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-white/[0.04] rounded transition-colors"
                                                    title="Delete Network"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </GlowCard>
                </section>
            </div>
        </main>
    )
}
