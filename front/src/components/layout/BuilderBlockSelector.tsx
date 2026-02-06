import { AccordionSection } from "../ui/accordionSection";
import DraggableInput from "../ui/draggable/DraggableInput";
import DraggableKeyboard from "../ui/draggable/DraggableKeyboard";
import DraggableNeuron from "../ui/draggable/DraggableNeuron";
import DraggableNetwork from "../ui/draggable/DraggableNetwork";
import DraggableOutput from "../ui/draggable/DraggableOutput";
import { useNetworkList } from "../../hooks/useNetworkList";
import { motion } from "motion/react";

export function BuilderBlockSelector() {

    const { networks, refreshNetworks } = useNetworkList();

    return (
        <div className="h-full flex flex-col bg-transparent backdrop-blur-sm">
            {/* Header Section with enhanced styling */}
            <div className="p-lg border-b border-slate-700/50 bg-transparent relative overflow-hidden">
                {/* Animated background pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-40 h-40 bg-cyan-500 blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-500 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>

                <motion.h2
                    className="text-2xl font-bold bg-gradient-to-r from-slate-100 via-cyan-200 to-slate-100 bg-clip-text text-transparent mb-sm relative z-10"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    Building Blocks
                </motion.h2>
                <motion.p
                    className="text-xs text-slate-400 relative z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    Drag and drop blocks to build your network
                </motion.p>
            </div>

            <div className="flex-1 overflow-y-auto">

                {/* Neurons Category */}
                <AccordionSection title="Neurons" defaultOpen={true}>
                    <div className="flex-col gap-2">
                        <DraggableNeuron isCollapsed={false} />
                    </div>
                </AccordionSection>

                {/* Inputs Category */}
                <AccordionSection title="Inputs" defaultOpen={false}>
                    <div className="flex-col gap-2">
                        <DraggableInput isCollapsed={false} />
                        <DraggableKeyboard isCollapsed={false} />
                    </div>
                </AccordionSection>

                {/* Networks Category */}
                <AccordionSection title="Networks" defaultOpen={true}>
                    <div className="flex-col gap-2">
                        {networks.map(n => (
                            <DraggableNetwork key={n.name} name={n.name} isCollapsed={false} />
                        ))}
                    </div>
                </AccordionSection>

                {/* Outputs Category */}
                <AccordionSection title="Outputs" defaultOpen={false}>
                    <div className="flex-col gap-2">
                        <DraggableOutput isCollapsed={false} />
                    </div>
                </AccordionSection>

            </div>
        </div>
    );
}