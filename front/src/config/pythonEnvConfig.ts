/**
 * Python environment configurations for Monaco editor autocomplete.
 * Each context (connection code, spike input) has its own env variables and functions.
 */

export interface EnvCompletion {
  label: string;
  detail: string;
  insertText: string;
}

/** Base completions shared by all Python envs */
const BASE_COMPLETIONS: EnvCompletion[] = [
  { label: 'range', detail: 'range(stop) or range(start, stop[, step])', insertText: 'range(${1:stop})' },
  { label: 'len', detail: 'len(iterable) — length', insertText: 'len(${1:iterable})' },
  { label: 'min', detail: 'min(a, b, ...) — minimum', insertText: 'min(${1:a}, ${2:b})' },
  { label: 'max', detail: 'max(a, b, ...) — maximum', insertText: 'max(${1:a}, ${2:b})' },
];

/**
 * Connection code env: n1, n2, connect, set_weight, etc.
 * Nomenclature: s0..s(n1-1) = source indices, t0..t(n2-1) = target indices.
 */
export function getConnectionCodeEnvCompletions(n1: number, n2: number): EnvCompletion[] {
  const completions: EnvCompletion[] = [
    { label: 'n1', detail: 'Source population size (int)', insertText: 'n1' },
    { label: 'n2', detail: 'Target population size (int)', insertText: 'n2' },
    { label: 'connect', detail: 'connect(i, j) — create connection', insertText: 'connect(${1:i}, ${2:j})' },
    { label: 'set_weight', detail: 'set_weight(i, j, weight) — set weight', insertText: 'set_weight(${1:i}, ${2:j}, ${3:1.0})' },
    { label: 'disconnect', detail: 'disconnect(i, j) — remove connection', insertText: 'disconnect(${1:i}, ${2:j})' },
    { label: 'set_delay', detail: 'set_delay(i, j, delay) — set delay', insertText: 'set_delay(${1:i}, ${2:j}, ${3:1.0})' },
  ];

  // Add source indices s0..s(n1-1) and target indices t0..t(n2-1) separately
  const maxS = Math.min(n1, 24);
  const maxT = Math.min(n2, 24);
  for (let i = 0; i < maxS; i++) {
    completions.push({
      label: `s${i}`,
      detail: `Source neuron index ${i} (use in connect(s${i}, t0) etc.)`,
      insertText: `s${i}`,
    });
  }
  for (let i = 0; i < maxT; i++) {
    completions.push({
      label: `t${i}`,
      detail: `Target neuron index ${i} (use in connect(s0, t${i}) etc.)`,
      insertText: `t${i}`,
    });
  }

  return [...completions, ...BASE_COMPLETIONS];
}

/**
 * Spike input env: t, ctx, spike(target), t0, t1, t2...
 * Nomenclature: t0, t1, t2... = target neuron indices (0-based).
 * spike(t0) or spike(0) spikes the first target neuron.
 */
export function getSpikeInputEnvCompletions(numTargets: number): EnvCompletion[] {
  const completions: EnvCompletion[] = [
    { label: 't', detail: 'Current simulation time (ms)', insertText: 't' },
    { label: 'ctx', detail: 'Context dict: {dt, step, target_neuron_ids}', insertText: 'ctx' },
    { label: 'dt', detail: "ctx['dt'] — simulation timestep", insertText: "ctx['dt']" },
    { label: 'step', detail: "ctx['step'] — current step index", insertText: "ctx['step']" },
    {
      label: 'spike',
      detail: 'spike(target) — spike a target neuron. Use spike(t0), spike(t1), or spike(0), spike(1)',
      insertText: 'spike(${1:t0})',
    },
  ];

  // Add target indices t0, t1, t2...
  const maxShow = Math.min(Math.max(numTargets, 1), 16);
  for (let i = 0; i < maxShow; i++) {
    completions.push({
      label: `t${i}`,
      detail: `Target neuron index ${i} — use in spike(t${i}) to spike this neuron`,
      insertText: `t${i}`,
    });
  }

  return [...completions, ...BASE_COMPLETIONS];
}
