export const config = { runtime: 'edge' };

const AZURE_ENDPOINT = 'https://care-coordination-project.openai.azure.com/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2025-01-01-preview';
const FHIR_BASE = 'https://fhirassist.rsystems.com:3001';

async function callLLM(messages, tools) {
  const body = {
    messages,
    temperature: 0.3,
    max_tokens: 1500,
    stream: false,
  };
  if (tools && tools.length) body.tools = tools;

  const res = await fetch(AZURE_ENDPOINT, {
    method: 'POST',
    headers: { 'api-key': process.env.AZURE_OPENAI_KEY || '', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM call failed: ${res.status}`);
  return res.json();
}

async function callFhir(path, token) {
  const res = await fetch(`${FHIR_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) return { error: `FHIR ${res.status}` };
  return res.json();
}

const TOOL_DEFINITIONS = {
  fetchConditions: {
    type: 'function',
    function: {
      name: 'fetchConditions',
      description: 'Fetch patient conditions/diagnoses from FHIR. Returns ICD codes, clinical status, and display names.',
      parameters: { type: 'object', properties: { patientId: { type: 'string', description: 'Patient ID' } }, required: ['patientId'] },
    },
  },
  fetchObservations: {
    type: 'function',
    function: {
      name: 'fetchObservations',
      description: 'Fetch patient lab observations from FHIR. Returns LOINC codes, values, units, and dates.',
      parameters: { type: 'object', properties: { patientId: { type: 'string', description: 'Patient ID' } }, required: ['patientId'] },
    },
  },
  fetchVitals: {
    type: 'function',
    function: {
      name: 'fetchVitals',
      description: 'Fetch patient vital signs (BP, heart rate, temperature, SpO2) from FHIR.',
      parameters: { type: 'object', properties: { patientId: { type: 'string', description: 'Patient ID' } }, required: ['patientId'] },
    },
  },
  fetchMedications: {
    type: 'function',
    function: {
      name: 'fetchMedications',
      description: 'Fetch patient medications from FHIR. Returns medication names, status (active/stopped/completed), dosage, and notes.',
      parameters: { type: 'object', properties: { patientId: { type: 'string', description: 'Patient ID' } }, required: ['patientId'] },
    },
  },
  fetchEncounters: {
    type: 'function',
    function: {
      name: 'fetchEncounters',
      description: 'Fetch patient encounters from FHIR. Returns encounter class (AMB/INP/EMER), status, dates, diagnoses, and clinical notes.',
      parameters: { type: 'object', properties: { patientId: { type: 'string', description: 'Patient ID' } }, required: ['patientId'] },
    },
  },
  fetchAppointments: {
    type: 'function',
    function: {
      name: 'fetchAppointments',
      description: 'Fetch patient appointments from FHIR. Returns status (booked/noshow/cancelled), dates, descriptions.',
      parameters: { type: 'object', properties: { patientId: { type: 'string', description: 'Patient ID' } }, required: ['patientId'] },
    },
  },
  fetchProcedures: {
    type: 'function',
    function: {
      name: 'fetchProcedures',
      description: 'Fetch patient procedures from FHIR. Returns CPT codes, descriptions, dates.',
      parameters: { type: 'object', properties: { patientId: { type: 'string', description: 'Patient ID' } }, required: ['patientId'] },
    },
  },
  fetchServiceRequests: {
    type: 'function',
    function: {
      name: 'fetchServiceRequests',
      description: 'Fetch patient service requests/referrals from FHIR. Returns status, codes, notes.',
      parameters: { type: 'object', properties: { patientId: { type: 'string', description: 'Patient ID' } }, required: ['patientId'] },
    },
  },
  fetchDocuments: {
    type: 'function',
    function: {
      name: 'fetchDocuments',
      description: 'Fetch patient document references from FHIR. Returns document types, descriptions, authors, dates.',
      parameters: { type: 'object', properties: { patientId: { type: 'string', description: 'Patient ID' } }, required: ['patientId'] },
    },
  },
};

async function executeTool(toolName, args, token) {
  const pid = args.patientId;
  const paths = {
    fetchConditions: `/baseR4/Condition?patient=${pid}&page=0&size=100`,
    fetchObservations: `/baseR4/Observation/search?patient=${pid}&page=0&size=200`,
    fetchVitals: `/baseR4/Observation/vitals/search?patient=${pid}`,
    fetchMedications: `/baseR4/MedicationRequest?patient=${pid}&page=0&size=200`,
    fetchEncounters: `/baseR4/Encounter?patient=${pid}&page=0&size=200`,
    fetchAppointments: `/baseR4/Appointment?patient=${pid}&page=0&size=100`,
    fetchProcedures: `/baseR4/Procedure?patient=${pid}&page=0&size=100`,
    fetchServiceRequests: `/baseR4/ServiceRequest?patient=${pid}&page=0&size=100`,
    fetchDocuments: `/baseR4/DocumentReference?patient=${pid}&page=0&size=100`,
  };
  const path = paths[toolName];
  if (!path) return JSON.stringify({ error: 'Unknown tool' });

  const data = await callFhir(path, token);
  const entries = (data?.entry || []).map(e => {
    const r = e.resource;
    if (!r) return null;
    switch (toolName) {
      case 'fetchConditions':
        return { code: r.code?.coding?.[0]?.code, display: r.code?.coding?.[0]?.display, clinicalStatus: r.clinicalStatus?.coding?.[0]?.code };
      case 'fetchObservations':
        return { code: r.code?.coding?.[0]?.code, display: r.code?.coding?.[0]?.display, value: r.valueQuantity?.value, unit: r.valueQuantity?.unit, date: r.effectiveDateTime };
      case 'fetchVitals':
        return { code: r.code?.coding?.[0]?.code, display: r.code?.coding?.[0]?.display || r.code?.text, value: r.valueQuantity?.value, unit: r.valueQuantity?.unit, date: r.effectiveDateTime };
      case 'fetchMedications':
        return { name: r.medicationCodeableConcept?.coding?.[0]?.display, status: r.status, dosage: r.dosageInstruction?.[0]?.text, note: r.note?.[0]?.text, authoredOn: r.authoredOn };
      case 'fetchEncounters':
        return { id: r.id, class: r.class?.code, status: r.status, diagnosis: r.diagnosis?.[0]?.condition?.display, start: r.period?.start, end: r.period?.end, notes: (r.extension || []).find(x => x.url === 'clinicalNotes')?.valueString };
      case 'fetchAppointments':
        return { status: r.status, description: r.description, start: r.start, end: r.end, serviceType: r.serviceType?.[0]?.text };
      case 'fetchProcedures':
        return { code: r.code?.coding?.[0]?.code, display: r.code?.coding?.[0]?.display, status: r.status, date: r.performedDateTime || r.performedPeriod?.start };
      case 'fetchServiceRequests':
        return { code: r.code?.coding?.[0]?.display, status: r.status, intent: r.intent, authoredOn: r.authoredOn, note: r.note?.[0]?.text };
      case 'fetchDocuments':
        return { type: r.type?.coding?.[0]?.display, description: r.description, author: r.author?.[0]?.display, date: r.date };
      default:
        return r;
    }
  }).filter(Boolean);

  return JSON.stringify(entries.slice(0, 50));
}

async function runAgent(agentConfig, patientId, token) {
  const tools = agentConfig.tools.map(t => TOOL_DEFINITIONS[t]).filter(Boolean);
  const messages = [
    { role: 'system', content: agentConfig.systemPrompt },
    { role: 'user', content: `Analyze patient ID: ${patientId}. Use your tools to fetch the data you need, then provide your analysis.` },
  ];

  const MAX_ITERATIONS = 5;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await callLLM(messages, tools.length ? tools : undefined);
    const choice = response.choices?.[0];
    if (!choice) break;

    const msg = choice.message;
    messages.push(msg);

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const toolResults = await Promise.all(
        msg.tool_calls.map(async tc => {
          const args = JSON.parse(tc.function.arguments || '{}');
          const result = await executeTool(tc.function.name, args, token);
          return { role: 'tool', tool_call_id: tc.id, content: result };
        })
      );
      messages.push(...toolResults);
    } else {
      return msg.content || '';
    }
  }

  const last = messages[messages.length - 1];
  return typeof last === 'string' ? last : last.content || '';
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

  try {
    const { patientId, agents, token } = await req.json();
    if (!patientId || !token) {
      return new Response(JSON.stringify({ error: 'patientId and token required' }), { status: 400 });
    }

    const AGENT_CONFIGS = {
      clinical: {
        systemPrompt: `You are a Clinical AI Agent specializing in patient risk analysis and care quality.\n\nYou have access to tools that fetch real patient data from a FHIR R4 server. Use these tools to gather the data you need, then analyze it.\n\nYour tasks:\n1. RISK ANALYSIS — Assess overall clinical risk based on conditions, observations, and medications\n2. CARE GAP DETECTION — Identify missed screenings, overdue tests, stopped medications\n3. DISEASE PROGRESSION — Compare recent vs older observation values to detect worsening trends\n4. GUIDELINE COMPLIANCE — Check if care aligns with standard protocols\n5. TREATMENT RESPONSE — Are current medications achieving their targets?\n\nAfter gathering data via tools, return ONLY valid JSON:\n{"riskLevel":"High|Medium|Low","riskReason":"one sentence","findings":["..."],"careGaps":["..."],"progressionAlerts":["..."]}`,
        tools: ['fetchConditions', 'fetchObservations', 'fetchVitals', 'fetchMedications'],
      },
      financial: {
        systemPrompt: `You are a Financial AI Agent specializing in healthcare cost optimization and documentation quality.\n\nYou have access to tools that fetch real patient data from a FHIR R4 server. Use these tools to gather the data you need, then analyze it.\n\nYour tasks:\n1. COST SAVING RECOMMENDATIONS — Identify brand-name medications with generic alternatives\n2. DOCUMENTATION GAPS — Detect encounters missing clinical notes, incomplete coding\n3. HIGH-COST PATTERNS — Flag frequent ER visits, multiple admissions, high medication counts\n4. RESOURCE UTILIZATION — Analyze if procedures and tests are appropriately ordered\n\nAfter gathering data via tools, return ONLY valid JSON:\n{"costFindings":["..."],"documentationGaps":["..."],"highCostFlags":["..."]}`,
        tools: ['fetchMedications', 'fetchEncounters', 'fetchProcedures'],
      },
      ops: {
        systemPrompt: `You are an Operations AI Agent specializing in healthcare workflow optimization.\n\nYou have access to tools that fetch real patient data from a FHIR R4 server. Use these tools to gather the data you need, then analyze it.\n\nYour tasks:\n1. APPOINTMENT UTILIZATION — Analyze no-show rates, cancellation patterns\n2. ENCOUNTER EFFICIENCY — Visit frequency, follow-up timeliness\n3. REFERRAL TRACKING — Are service requests being completed?\n4. WORKLOAD PATTERNS — Visit frequency trends\n\nAfter gathering data via tools, return ONLY valid JSON:\n{"appointmentInsights":["..."],"encounterEfficiency":["..."],"referralStatus":["..."]}`,
        tools: ['fetchAppointments', 'fetchEncounters', 'fetchServiceRequests', 'fetchDocuments'],
      },
      engagement: {
        systemPrompt: `You are a Patient Engagement AI Agent specializing in adherence monitoring and outreach.\n\nYou have access to tools that fetch real patient data from a FHIR R4 server. Use these tools to gather the data you need, then analyze it.\n\nYour tasks:\n1. ADHERENCE PATTERNS — Medication compliance trends, appointment attendance\n2. COMMUNICATION NEEDS — Identify patients needing outreach\n3. EDUCATION RECOMMENDATIONS — Suggest relevant patient education\n4. FOLLOW-UP URGENCY — Prioritize immediate vs routine follow-up\n\nAfter gathering data via tools, return ONLY valid JSON:\n{"adherencePatterns":["..."],"outreachNeeds":["..."],"educationTopics":["..."],"urgencyLevel":"Immediate|Soon|Routine","urgencyReason":"one sentence"}`,
        tools: ['fetchMedications', 'fetchAppointments', 'fetchEncounters', 'fetchConditions'],
      },
    };

    const agentNames = agents || ['clinical'];
    const results = {};

    const agentPromises = agentNames.map(async name => {
      const cfg = AGENT_CONFIGS[name];
      if (!cfg) return;
      try {
        const raw = await runAgent(cfg, patientId, token);
        try { results[name] = JSON.parse(raw); }
        catch { results[name] = { raw }; }
      } catch (err) {
        results[name] = { error: err.message };
      }
    });
    await Promise.all(agentPromises);

    let recommendations = null;
    try {
      const orchContext = `Clinical Agent Analysis:\n${JSON.stringify(results.clinical)}`;

      const recResponse = await callLLM([
        { role: 'system', content: `You are the Recommendation AI Agent. You receive analysis from the Clinical Agent and synthesize it into actionable recommendations for the healthcare provider.\n\nReturn ONLY valid JSON:\n{"instructions":["instruction 1","instruction 2",...],"actions":[{"title":"...","priority":"High Priority|Medium Priority|Low Priority","timeframe":"Within 24 hours|Within 48 hours|Within 1 week|Within 1 month","description":"...","rationale":"..."},...]}\n\nMake 3-5 instructions and 3-5 actions. Be specific to this patient based on the clinical findings.` },
        { role: 'user', content: orchContext },
      ]);
      const recContent = recResponse.choices?.[0]?.message?.content || '';
      try { recommendations = JSON.parse(recContent); }
      catch { recommendations = { raw: recContent }; }
    } catch (err) {
      recommendations = { error: err.message };
    }

    return new Response(JSON.stringify({ agents: results, recommendations }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
