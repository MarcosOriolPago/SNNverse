import { useState, useEffect } from 'react';

export interface NetworkItem {
    name: string;
    created_at: string;
    model_info: {
        num_neurons?: number;
        num_synapses?: number;
    };
    hash: string;
}

export const useNetworkList = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [networks, setNetworks] = useState<NetworkItem[]>([]);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        fetchNetworks();
    }, []);

    const filteredNetworks = networks.filter(network =>
        network.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return {
        networks,
        loading,
        searchQuery,
        setSearchQuery,
        filteredNetworks,
        refreshNetworks: fetchNetworks
    };
};
