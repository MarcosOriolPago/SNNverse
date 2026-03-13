import { AccordionSection } from "../ui/accordionSection";
import DraggableSpikeFx from "../ui/draggable/DraggableSpikeFx";
import DraggableNeuron from "../ui/draggable/DraggableNeuron";
import DraggableLayer from "../ui/draggable/DraggableLayer";
import { motion } from "motion/react";

export function BuilderBlockSelector() {
  return (
    <div className="h-full flex flex-col bg-transparent backdrop-blur-sm">
      {/* Header Section */}
      <div className="p-lg border-b border-slate-700/50 bg-transparent relative overflow-hidden">
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
          Drag blocks onto the canvas to build your network
        </motion.p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Layers Section */}
        <AccordionSection title="Layers" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-3">
            <DraggableLayer neuronType="LIF" />
            <DraggableLayer neuronType="IF" />
            <DraggableLayer neuronType="Izhikevich" />
          </div>
        </AccordionSection>

        {/* Neurons Section */}
        <AccordionSection title="Neurons" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-3">
            <DraggableNeuron neuronType="LIF" />
            <DraggableNeuron neuronType="IF" />
            <DraggableNeuron neuronType="Izhikevich" />
          </div>
        </AccordionSection>

        {/* Inputs Section */}
        <AccordionSection title="Inputs" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-3">
            <DraggableSpikeFx />
          </div>
        </AccordionSection>
      </div>
    </div>
  );
}
