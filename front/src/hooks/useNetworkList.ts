import { useState, useEffect } from 'react';
import { API_CONFIG } from '../config/api';

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
    const [networks, setNetworks] = useState<NetworkItem[]>([]);

    const fetchNetworks = async () => {
        try {
            const response = await fetch(API_CONFIG.NETWORK.LIST_SAVED);
            const data = await response.json();

            if (data.status === 'success') {
                setNetworks(data.networks);
            }
        } catch (error) {
            console.error('Error fetching networks:', error);
        }
    };

    useEffect(() => {
        fetchNetworks();
    }, []);

    return {
        networks,
        refreshNetworks: fetchNetworks
    };
};
