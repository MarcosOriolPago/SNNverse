import { AccordionSection } from "../ui/accordionSection";
import DraggableInput from "../ui/draggable/DraggableInput";
import DraggableKeyboard from "../ui/draggable/DraggableKeyboard";
import DraggableNeuron from "../ui/draggable/DraggableNeuron";
import DraggableNetwork from "../ui/draggable/DraggableNetwork";
import DraggableOutput from "../ui/draggable/DraggableOutput";
import { useNetworkList } from "../../hooks/useNetworkList";

export function BuilderBlockSelector() {

    const { networks, refreshNetworks } = useNetworkList();

    return (
        <div>
            <div className="p-lg border-b border-border-primary">
                <h2 className="text-2xl font-bold text-text-primary mb-sm">Building Blocks</h2>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>

                {/* Neurons Category */}
                <AccordionSection title="Neurons" defaultOpen={true}>
                    <div className="flex-wrap gap-2">
                        <DraggableNeuron isCollapsed={false} />
                    </div>
                </AccordionSection>

                {/* Inputs Category */}
                <AccordionSection title="Inputs" defaultOpen={false}>
                    <div className="flex-wrap gap-2">
                        <DraggableInput isCollapsed={false} />
                        <DraggableKeyboard isCollapsed={false} />
                    </div>
                </AccordionSection>

                {/* Networks Category (Updated) */}
                <AccordionSection title="Networks" defaultOpen={true}>
                    <div className="flex-col gap-2">
                        {networks.length === 0 && <div className="empty-state">No saved networks found.</div>}
                        {networks.map(n => (
                            <DraggableNetwork key={n.name} name={n.name} isCollapsed={false} />
                        ))}
                    </div>
                </AccordionSection>

                {/* 4. Outputs Category */}
                <AccordionSection title="Outputs" defaultOpen={false}>
                    <div className="flex-wrap gap-2">
                        <DraggableOutput isCollapsed={false} />
                    </div>
                </AccordionSection>

            </div>
        </div>
    );
}