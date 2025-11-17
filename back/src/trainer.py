import torch.nn as nn
import torch
from spikingjelly.activation_based import neuron, functional

import numpy as np
import matplotlib.pyplot as plt

def run_experiment(out_png_path: str, out_log_path: str, steps: int = 50, name: str = "demo"):
    """
    Minimal SpikingJelly experiment that runs a simple LIF neuron network
    and saves a spike raster plot + text log.
    """
    log_lines = []
    device = "cuda" if torch.cuda.is_available() else "cpu"
    log_lines.append(f"Using device: {device}")

    # --- Define a very small spiking network ---
    class TinyNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.fc = nn.Linear(32, 16)
            self.lif = neuron.LIFNode(tau=2.0)

        def forward(self, x):
            x = self.fc(x)
            x = self.lif(x)
            return x

    net = TinyNet().to(device)
    functional.set_step_mode(net, step_mode="m")  # multi-step mode

    # --- Dummy input: random spikes for a few time steps ---
    inputs = (torch.rand([steps, 1, 32]) > 0.95).float().to(device)

    # --- Run forward ---
    with torch.no_grad():
        outputs = net(inputs)

    # --- Plot spike raster ---
    spikes = outputs.squeeze().cpu().numpy().T  # shape [neurons, time]
    plt.figure(figsize=(8, 4))
    for neuron_id in range(spikes.shape[0]):
        spike_times = np.where(spikes[neuron_id] > 0)[0]
        plt.scatter(spike_times, np.ones_like(spike_times) * neuron_id, s=5, color="black")
    plt.title(f"Spike Raster - {name}")
    plt.xlabel("Time step")
    plt.ylabel("Neuron indexing")
    plt.tight_layout()
    plt.savefig(out_png_path)
    plt.close()

    log_lines.append(f"Ran TinyNet for {steps} steps.")
    log_lines.append(f"Spike raster saved to: {out_png_path}")

    with open(out_log_path, "w") as f:
        f.write("\n".join(log_lines))

    return True, f"Experiment completed. Log saved to {out_log_path}"