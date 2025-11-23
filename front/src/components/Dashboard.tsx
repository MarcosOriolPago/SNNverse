import React, { useState } from 'react';
import { Plus, Search, Network, Calendar, Activity, MoreVertical, Trash2, Copy, Edit2 } from 'lucide-react';
import '../styles/dashboard.css';

interface NetworkItem {
    id: string;
    name: string;
    description: string;
    neurons: number;
    connections: number;
    lastModified: string;
    type: 'SNN' | 'Custom';
}

const mockNetworks: NetworkItem[] = [
    {
        id: '1',
        name: 'Visual Cortex Model',
        description: 'Simulates basic visual processing with LIF neurons',
        neurons: 128,
        connections: 512,
        lastModified: '2024-11-22',
        type: 'SNN'
    },
    {
        id: '2',
        name: 'Pattern Recognition',
        description: 'Network designed for temporal pattern recognition',
        neurons: 64,
        connections: 256,
        lastModified: '2024-11-20',
        type: 'Custom'
    },
];

const Dashboard: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [networks] = useState<NetworkItem[]>(mockNetworks);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const filteredNetworks = networks.filter(network =>
        network.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        network.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div className="dashboard-header-content">
                    <h1 className="dashboard-title">Networks</h1>
                    <p className="dashboard-subtitle">Manage your spiking neural network architectures</p>
                </div>
                <button className="dashboard-create-button">
                    <Plus className="dashboard-create-icon" />
                    Create Network
                </button>
            </div>

            <div className="dashboard-search-bar">
                <Search className="dashboard-search-icon" />
                <input
                    type="text"
                    placeholder="Search networks..."
                    className="dashboard-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {filteredNetworks.length === 0 ? (
                <div className="dashboard-empty-state">
                    <Network className="dashboard-empty-icon" />
                    <h3 className="dashboard-empty-title">No networks found</h3>
                    <p className="dashboard-empty-text">
                        {searchQuery ? 'Try a different search term' : 'Create your first network to get started'}
                    </p>
                    {!searchQuery && (
                        <button className="dashboard-empty-button">
                            <Plus className="dashboard-empty-button-icon" />
                            Create Your First Network
                        </button>
                    )}
                </div>
            ) : (
                <div className="dashboard-networks-grid">
                    {filteredNetworks.map((network) => (
                        <div key={network.id} className="network-card">
                            <div className="network-card-header">
                                <div className="network-card-title-section">
                                    <h3 className="network-card-title">{network.name}</h3>
                                    <span className={`network-card-badge network-card-badge--${network.type.toLowerCase()}`}>
                                        {network.type}
                                    </span>
                                </div>
                                <div className="network-card-menu">
                                    <button
                                        className="network-card-menu-button"
                                        onClick={() => setActiveMenu(activeMenu === network.id ? null : network.id)}
                                    >
                                        <MoreVertical className="network-card-menu-icon" />
                                    </button>
                                    {activeMenu === network.id && (
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

                            <p className="network-card-description">{network.description}</p>

                            <div className="network-card-stats">
                                <div className="network-card-stat">
                                    <Activity className="network-card-stat-icon" />
                                    <span className="network-card-stat-label">{network.neurons} neurons</span>
                                </div>
                                <div className="network-card-stat">
                                    <Network className="network-card-stat-icon" />
                                    <span className="network-card-stat-label">{network.connections} synapses</span>
                                </div>
                            </div>

                            <div className="network-card-footer">
                                <div className="network-card-date">
                                    <Calendar className="network-card-date-icon" />
                                    <span className="network-card-date-text">{network.lastModified}</span>
                                </div>
                                <button className="network-card-open-button">
                                    Open
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
