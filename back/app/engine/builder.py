from spikingjelly.activation_based import neuron, layer
import torch.nn as nn

def build_from_config(config):
    """
    Input: 
    {
      "layers": [
         {"type": "Linear", "in": 10, "out": 100},
         {"type": "LIF", "tau": 2.0}
      ]
    }
    """
    modules = []
    for l in config['layers']:
        if l['type'] == 'Linear':
            modules.append(nn.Linear(l['in'], l['out']))
        elif l['type'] == 'LIF':
            modules.append(neuron.LIFNode(tau=l['tau']))
    
    return nn.Sequential(*modules)