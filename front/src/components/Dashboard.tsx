import React, { useState } from 'react';
import { Plus, Search, Network } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

import { useNetworkList } from '../hooks/useNetworkList';
import NetworkCard from './dashboard/NetworkCard';
import CreateNetworkModal from './dashboard/CreateNetworkModal';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { loading, searchQuery, setSearchQuery, filteredNetworks, networks } = useNetworkList();
    const [showCreateModal, setShowCreateModal] = useState(false);

    const handleCreateNetwork = () => {
        setShowCreateModal(true);
    };

    const handleCreateConfirm = (name: string) => {
        setShowCreateModal(false);
        navigate(`/build?networkName=${encodeURIComponent(name)}`);
    };

    const handleOpenNetwork = (networkName: string) => {
        navigate(`/build?networkName=${encodeURIComponent(networkName)}&loadConfig=true`);
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
                        <NetworkCard
                            key={network.hash}
                            network={network}
                            onOpen={handleOpenNetwork}
                        />
                    ))}
                </div>
            )}

            {/* Create Network Modal */}
            {showCreateModal && (
                <CreateNetworkModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateConfirm}
                    existingNetworks={networks}
                />
            )}
        </div>
    );
};

export default Dashboard;
