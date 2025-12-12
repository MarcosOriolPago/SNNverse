import React, { useState } from 'react';
import { Network, Calendar, Activity, MoreVertical, Trash2, Copy, Edit2 } from 'lucide-react';
import type { NetworkItem } from '../../hooks/useNetworkList';

interface NetworkCardProps {
    network: NetworkItem;
    onOpen: (name: string) => void;
}

const NetworkCard: React.FC<NetworkCardProps> = ({ network, onOpen }) => {
    const [activeMenu, setActiveMenu] = useState(false);

    const formatDate = (isoString: string) => {
        if (!isoString) return 'Unknown';
        const date = new Date(isoString);
        return date.toLocaleDateString();
    };

    return (
        <div key={network.hash} className="network-card">
            <div className="network-card-header">
                <div className="network-card-title-section">
                    <h3 className="network-card-title">{network.name}</h3>
                    <span className="network-card-badge network-card-badge--snn">
                        SNN
                    </span>
                </div>
                <div className="network-card-menu">
                    <button
                        className="network-card-menu-button"
                        onClick={() => setActiveMenu(!activeMenu)}
                        onBlur={() => setTimeout(() => setActiveMenu(false), 200)}
                    >
                        <MoreVertical className="network-card-menu-icon" />
                    </button>
                    {activeMenu && (
                        <div className="network-card-dropdown">
                            <button className="network-card-dropdown-item">
                                <Edit2 className="network-card-dropdown-icon" />
                                Edit
                            </button>
                            <button className="network-card-dropdown-item">
                                <Copy className="network-card-dropdown-icon" />
                                Duplicate
                            </button>
                            <button className="network-card-dropdown-item network-card-dropdown-item--danger">
                                <Trash2 className="network-card-dropdown-icon" />
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <p className="network-card-description">
                Saved network configuration
            </p>

            <div className="network-card-stats">
                <div className="network-card-stat">
                    <Activity className="network-card-stat-icon" />
                    <span className="network-card-stat-label">
                        {network.model_info.num_neurons || 0} neurons
                    </span>
                </div>
                <div className="network-card-stat">
                    <Network className="network-card-stat-icon" />
                    <span className="network-card-stat-label">
                        {network.model_info.num_synapses || 0} synapses
                    </span>
                </div>
            </div>

            <div className="network-card-footer">
                <div className="network-card-date">
                    <Calendar className="network-card-date-icon" />
                    <span className="network-card-date-text">{formatDate(network.created_at)}</span>
                </div>
                <button
                    className="network-card-open-button"
                    onClick={() => onOpen(network.name)}
                >
                    Open
                </button>
            </div>
        </div>
    );
};

export default NetworkCard;
