/**
 * Utility functions for ID management
 */

/**
 * Sanitizes a node ID to match the backend GeNN variable naming convention.
 * Replaces non-alphanumeric characters with underscores.
 * 
 * Example: "neuron-123" -> "neuron_123"
 */
export const sanitizeId = (id: string | undefined | null): string => {
    if (!id) return "";
    return id.replace(/[^a-zA-Z0-9]/g, '_');
};
