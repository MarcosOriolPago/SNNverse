export const NEURON_SPACING = 72;
export const LAYER_PADDING = 12;

export const LAYER_WIDTH = 120;
export const NEURON_WIDTH = 56;
export const STANDALONE_NEURON_WIDTH = 100;
export const NEURON_INPUT_HANDLE_X_FACTOR = 0.14;
export const NEURON_OUTPUT_HANDLE_X_FACTOR = 0.86;
export const NEURON_HANDLE_Y_FACTOR = 0.5;

export const getChildPosition = (
  neuronCount: number,
  collapsed: boolean,
  i: number
): { x: number; y: number } => {
  const xCenter = (LAYER_WIDTH - NEURON_WIDTH) / 2;
  if (!collapsed) return { x: xCenter, y: LAYER_PADDING + i * NEURON_SPACING };
  if (i <= 1) return { x: xCenter, y: LAYER_PADDING + i * NEURON_SPACING };
  if (i >= neuronCount - 2) return { x: xCenter, y: LAYER_PADDING + (3 + (i - (neuronCount - 2))) * NEURON_SPACING };
  return { x: xCenter, y: 0 };
};

export const isChildVisible = (neuronCount: number, collapsed: boolean, i: number): boolean =>
  !collapsed || i <= 1 || i >= neuronCount - 2;
