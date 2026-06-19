/**
 * Frontend service to call the multi-agent API endpoint.
 * Runs 4 sub-agents + 1 recommendation agent server-side.
 */

export async function runAllAgents(patientId) {
  const token = localStorage.getItem('p360_token') || '';

  const res = await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId,
      agents: ['clinical'],
      token,
    }),
  });

  if (!res.ok) throw new Error(`Agent API failed (${res.status})`);
  return res.json();
}
