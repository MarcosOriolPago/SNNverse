import React, { useState, useEffect } from 'react';
import { Plus, Search, Network, Calendar, Activity, MoreVertical, Trash2, Copy, Edit2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

interface NetworkItem {
    name: string;
    created_at: string;
    model_info: {
        num_neurons?: number;
        num_synapses?: number;
    };
    hash: string;
}

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [networks, setNetworks] = useState<NetworkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newNetworkName, setNewNetworkName] = useState('');
    const [nameError, setNameError] = useState('');

    // Fetch saved networks on mount
    useEffect(() => {
        fetchNetworks();
    }, []);

    const fetchNetworks = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:8000/api/network/list_saved');
            const data = await response.json();

            if (data.status === 'success') {
                setNetworks(data.networks);
            }
        } catch (error) {
            console.error('Error fetching networks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNetwork = () => {
        setShowCreateModal(true);
        setNewNetworkName('');
        setNameError('');
    };

    const validateNetworkName = (name: string): boolean => {
        if (!name.trim()) {
            setNameError('Network name cannot be empty');
            return false;
        }

        if (networks.some(net => net.name === name)) {
            setNameError('A network with this name already exists');
            return false;
        }

        if (!/^[a-zA-Z0-9\s_-]+$/.test(name)) {
            setNameError('Network name can only contain letters, numbers, spaces, hyphens and underscores');
            return false;
        }

        return true;
    };

    const handleCreateConfirm = () => {
        if (validateNetworkName(newNetworkName)) {
            setShowCreateModal(false);
            // Navigate to NodeLayout with network name
            navigate(`/build?networkName=${encodeURIComponent(newNetworkName)}`);
        }
    };

    const handleOpenNetwork = (networkName: string) => {
        // Navigate to NodeLayout with loadConfig flag
        navigate(`/build?networkName=${encodeURIComponent(networkName)}&loadConfig=true`);
    };

    const filteredNetworks = networks.filter(network =>
        network.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (isoString: string) => {
        if (!isoString) return 'Unknown';
        const date = new Date(isoString);
        return date.toLocaleDateString();
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div className="dashboard-header-content">
                    <h1 className="dashboard-title">Networks</h1>
                    <p className="dashboard-subtitle">Manage your spiking neural network architectures</p>
                </div>
                <button className="dashboard-create-button" onClick={handleCreateNetwork}>
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

            {loading ? (
                <div className="dashboard-loading">Loading networks...</div>
            ) : filteredNetworks.length === 0 ? (
                <div className="dashboard-empty-state">
                    <Network className="dashboard-empty-icon" />
                    <h3 className="dashboard-empty-title">No networks found</h3>
                    <p className="dashboard-empty-text">
                        {searchQuery ? 'Try a different search term' : 'Create your first network to get started'}
                    </p>
                    {!searchQuery && (
                        <button className="dashboard-empty-button" onClick={handleCreateNetwork}>
                            <Plus className="dashboard-empty-button-icon" />
                            Create Your First Network
                        </button>
                    )}
                </div>
            ) : (
                <div className="dashboard-networks-grid">
                    {filteredNetworks.map((network) => (
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
                                        onClick={() => setActiveMenu(activeMenu === network.hash ? null : network.hash)}
                                    >
                                        <MoreVertical className="network-card-menu-icon" />
                                    </button>
                                    {activeMenu === network.hash && (
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
                                    onClick={() => handleOpenNetwork(network.name)}
                                >
                                    Open
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Network Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Create New Network</h2>
                            <button
                                className="modal-close-button"
                                onClick={() => setShowCreateModal(false)}
                            >
                                <X />
                            </button>
                        </div>

                        <div className="modal-body">
                            <label className="modal-label">Network Name</label>
                            <input
                                type="text"
                                className="modal-input"
                                placeholder="Enter network name..."
                                value={newNetworkName}
                                onChange={(e) => {
                                    setNewNetworkName(e.target.value);
                                    setNameError('');
                                }}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleCreateConfirm();
                                    }
                                }}
                                autoFocus
                            />
                            {nameError && (
                                <div className="modal-error">{nameError}</div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button
                                className="modal-button modal-button-cancel"
                                onClick={() => setShowCreateModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="modal-button modal-button-primary"
                                onClick={handleCreateConfirm}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
