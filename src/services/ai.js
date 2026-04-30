export async function callAI(systemPrompt, userMessage) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 500,
      stream: false,
    }),
  });

  if (!res.ok) throw new Error(`AI call failed (${res.status})`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}
