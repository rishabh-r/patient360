import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType, PageBreak, TableOfContents, ShadingType, Header, Footer, PageNumber, NumberFormat } from 'docx';
import { writeFileSync } from 'fs';

const BLUE = '1E3A8A';
const DARK = '1E293B';
const GRAY = '64748B';
const LIGHT_BG = 'F0F4FF';
const WHITE = 'FFFFFF';
const TABLE_HEAD_BG = '1E3A8A';
const TABLE_ALT_BG = 'F8FAFC';

function title(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 52, color: BLUE, font: 'Calibri' })],
    spacing: { after: 100 },
  });
}

function subtitle(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 24, color: GRAY, font: 'Calibri' })],
    spacing: { after: 60 },
  });
}

function h1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32, color: BLUE, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE } },
  });
}

function h2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: DARK, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
  });
}

function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: '475569', font: 'Calibri' })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 21, color: DARK, font: 'Calibri', ...opts })],
    spacing: { after: 120 },
  });
}

function pRich(runs) {
  return new Paragraph({
    children: runs.map(r => new TextRun({ size: 21, color: DARK, font: 'Calibri', ...r })),
    spacing: { after: 120 },
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: [new TextRun({ text, size: 21, color: DARK, font: 'Calibri' })],
    bullet: { level },
    spacing: { after: 60 },
  });
}

function bulletRich(runs, level = 0) {
  return new Paragraph({
    children: runs.map(r => new TextRun({ size: 21, color: DARK, font: 'Calibri', ...r })),
    bullet: { level },
    spacing: { after: 60 },
  });
}

function codeBlock(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 18, font: 'Consolas', color: '374151' })],
    spacing: { after: 60 },
    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
    indent: { left: 400 },
  });
}

function emptyLine() {
  return new Paragraph({ children: [], spacing: { after: 100 } });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function makeTable(headers, rows) {
  const headerCells = headers.map(h => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 19, color: WHITE, font: 'Calibri' })], alignment: AlignmentType.LEFT })],
    shading: { type: ShadingType.CLEAR, fill: TABLE_HEAD_BG },
    width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
  }));

  const dataRows = rows.map((row, idx) => {
    const cells = row.map(cell => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 19, color: DARK, font: 'Calibri' })], spacing: { after: 40 } })],
      shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, fill: TABLE_ALT_BG } : undefined,
    }));
    return new TableRow({ children: cells });
  });

  return new Table({
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows],
    width: { size: 9000, type: WidthType.DXA },
  });
}

const children = [];

// ─── COVER PAGE ───
children.push(emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine());
children.push(new Paragraph({
  children: [new TextRun({ text: 'KNOWLEDGE TRANSFER', bold: true, size: 60, color: BLUE, font: 'Calibri' })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 40 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: 'DOCUMENT', bold: true, size: 60, color: BLUE, font: 'Calibri' })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 300 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: 'Patient 360 Portal', size: 36, color: DARK, font: 'Calibri' })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 100 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: 'AI-Powered Multi-Role Healthcare Dashboard', size: 24, color: GRAY, font: 'Calibri', italics: true })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 500 },
}));
children.push(emptyLine(), emptyLine());
children.push(makeTable(
  ['Field', 'Details'],
  [
    ['Project Name', 'Patient 360 Portal'],
    ['Version', '1.0'],
    ['Date', 'July 8, 2026'],
    ['Author', 'Development Team — R Systems International'],
    ['Repository', 'https://github.com/rishabh-r/patient360.git'],
    ['Live URL', 'https://patient360-three.vercel.app'],
    ['Branch', 'main'],
    ['Status', 'Production'],
  ]
));
children.push(pageBreak());

// ─── TABLE OF CONTENTS ───
children.push(h1('Table of Contents'));
const tocItems = [
  '1. Project Overview',
  '2. Technology Stack',
  '3. System Architecture',
  '4. Repository Structure',
  '5. Environment Setup & Deployment',
  '6. Authentication & Role-Based Access',
  '7. Frontend Application — Views & Dashboards',
  '8. FHIR R4 API Integration',
  '9. AI / LLM Integration',
  '10. Multi-Agent Pipeline',
  '11. Database Schema',
  '12. Custom Backend APIs',
  '13. Risk Prediction & HEDIS',
  '14. Related Project — Time Traveller (CareBridge)',
  '15. Test Data & Patients',
  '16. Known Issues & Notes',
];
tocItems.forEach(item => children.push(p(item)));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 1: PROJECT OVERVIEW
// ═══════════════════════════════════════════════
children.push(h1('1. Project Overview'));

children.push(h2('1.1 What is Patient 360 Portal?'));
children.push(p('Patient 360 Portal is a multi-role healthcare dashboard that provides a unified, 360-degree view of patient data pulled from FHIR R4 APIs. It integrates AI-powered clinical analysis, risk prediction, and a multi-agent decision support system to help healthcare providers, care managers, and patients view and act on health information.'));

children.push(h2('1.2 Key Capabilities'));
children.push(makeTable(
  ['Capability', 'Description'],
  [
    ['Multi-Role Access', 'Separate dashboards for Patients, Healthcare Providers, Care Managers, and Admins'],
    ['FHIR R4 Integration', '14 standardized healthcare APIs for conditions, medications, encounters, observations, etc.'],
    ['AI Clinical Analysis', 'Azure OpenAI-powered care gap analysis, clinical summaries, and risk assessment'],
    ['Multi-Agent Pipeline', '3 parallel AI agents (Clinical, Financial, Ops) feeding into a Recommendation Agent'],
    ['Risk Prediction', 'ML-based risk scoring for CVD, Diabetes, Cancer with detailed risk drivers'],
    ['HEDIS Quality Measures', 'Automated healthcare quality scoring across 8 HEDIS domains'],
    ['Real-time Analytics', 'KPI dashboards with yearly comparisons, encounter trends, and patient outcomes'],
    ['AES-256-GCM Encryption', 'Optional response encryption for FHIR data in transit'],
  ]
));

children.push(h2('1.3 Related Project'));
children.push(p('The Time Traveller (CareBridge) project is the predecessor — a clinical chatbot that uses the same FHIR backend, same auth system, and same Azure OpenAI proxy. Patient 360 Portal reuses the same backend infrastructure but provides structured dashboards instead of a conversational interface. See Section 14 for details.'));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 2: TECHNOLOGY STACK
// ═══════════════════════════════════════════════
children.push(h1('2. Technology Stack'));

children.push(h2('2.1 Frontend'));
children.push(makeTable(
  ['Technology', 'Version', 'Purpose'],
  [
    ['React', '19.2.5', 'UI framework'],
    ['Vite', '8.0.10', 'Build tool & development server'],
    ['React Router DOM', '7.14.2', 'Client-side routing'],
    ['Chart.js', '4.5.1', 'Charting (clinical trends, encounter trends)'],
    ['react-chartjs-2', '5.3.1', 'React wrapper for Chart.js'],
    ['LangChain', '1.4.6', 'LLM orchestration framework'],
    ['@langchain/openai', '1.5.0', 'OpenAI integration for LangChain'],
    ['Zod', '4.4.3', 'Schema validation'],
  ]
));

children.push(h2('2.2 Backend / API Layer'));
children.push(makeTable(
  ['Technology', 'Purpose'],
  [
    ['Vercel Edge Functions', 'Serverless API proxy (api/chat.js, api/agents.js)'],
    ['Azure OpenAI (GPT-4.1-mini)', 'LLM provider for all AI features'],
    ['FHIR R4 Server (Spring Boot)', 'Healthcare data backend'],
    ['Risk Prediction ML Service', 'ML-based risk scoring (CVD, Diabetes, Cancer)'],
  ]
));

children.push(h2('2.3 Infrastructure'));
children.push(makeTable(
  ['Service', 'Purpose'],
  [
    ['Vercel', 'Hosting & continuous deployment (auto-deploys on git push)'],
    ['GitHub', 'Source control (main branch)'],
    ['Azure OpenAI', 'AI model hosting'],
  ]
));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 3: ARCHITECTURE
// ═══════════════════════════════════════════════
children.push(h1('3. System Architecture'));

children.push(h2('3.1 High-Level Architecture'));
children.push(p('The system follows a layered architecture with clear separation between the frontend, API proxy, and backend services:'));
children.push(emptyLine());
children.push(pRich([
  { text: 'Browser (React SPA)', bold: true },
  { text: ' → communicates with three backend systems:' },
]));
children.push(bullet('Vercel Edge Functions (api/chat.js, api/agents.js) — proxy to Azure OpenAI'));
children.push(bullet('FHIR R4 Backend (port 3001) — all patient data APIs'));
children.push(bullet('Risk Prediction API (port 8081) — ML risk scoring'));

children.push(h2('3.2 Data Flow'));
children.push(p('1. User authenticates via POST /api/v1/users/login → receives JWT token'));
children.push(p('2. Frontend fetches FHIR data using Bearer token → all API calls go through callFhirApi() with auth headers'));
children.push(p('3. AI analysis requests go through Vercel Edge Functions → proxied to Azure OpenAI'));
children.push(p('4. Agent pipeline runs on Vercel Edge (api/agents.js) → calls FHIR APIs server-side + Azure OpenAI for analysis'));
children.push(p('5. Risk predictions fetched from ML service endpoint'));

children.push(h2('3.3 Agent Pipeline Request Flow'));
children.push(p('When a provider clicks "Start Analysis" on a patient:'));
children.push(bullet('Browser sends POST /api/agents with patientId, agents list, and auth token'));
children.push(bullet('Vercel Edge Function runs 3 agents (Clinical, Financial, Ops) in parallel'));
children.push(bullet('Each agent calls FHIR APIs server-side to fetch patient data (conditions, observations, medications, etc.)'));
children.push(bullet('Each agent sends fetched data to Azure OpenAI for analysis (up to 5 tool-call iterations)'));
children.push(bullet('All 3 agent results are combined and sent to a Recommendation Agent'));
children.push(bullet('Recommendation Agent synthesizes all findings into instructions + prioritized actions'));
children.push(bullet('Full result returned to browser as JSON: { agents: {...}, recommendations: {...} }'));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 4: REPOSITORY STRUCTURE
// ═══════════════════════════════════════════════
children.push(h1('4. Repository Structure'));
children.push(p('The project follows a standard React + Vite structure with Vercel Edge Functions:'));

children.push(h2('4.1 Root Files'));
children.push(makeTable(
  ['File', 'Purpose'],
  [
    ['package.json', 'Dependencies, scripts (dev, build, lint, preview)'],
    ['vite.config.js', 'Vite configuration with dev proxy for /api'],
    ['vercel.json', 'Vercel deployment config: SPA rewrite, framework, build command'],
    ['.env.example', 'Template for VITE_DECRYPT_KEY environment variable'],
    ['.gitignore', 'Excludes node_modules, dist, .env, *.xlsx, *.py'],
    ['notes2.md', 'Full project memory (~3900+ lines of detailed development history)'],
  ]
));

children.push(h2('4.2 API Layer (api/)'));
children.push(makeTable(
  ['File', 'Purpose'],
  [
    ['api/chat.js', 'Vercel Edge Function — proxy to Azure OpenAI (supports streaming)'],
    ['api/agents.js', 'Vercel Edge Function — multi-agent pipeline (Clinical + Financial + Ops + Recommendation)'],
  ]
));

children.push(h2('4.3 Source Code (src/)'));
children.push(h3('Pages'));
children.push(makeTable(
  ['File', 'Lines (approx)', 'Purpose'],
  [
    ['LoginScreen.jsx', '~140', 'Login form with R Systems branding'],
    ['HomePage.jsx', '~200', 'Landing page: Data Sources, Patient 360 hub, Outcomes'],
    ['PatientView.jsx', '~2000', 'Patient dashboard: 6 containers (health, summary, appointments, meds, care plan, documents)'],
    ['CareManagerView.jsx', '~760', 'Care Manager dashboard: org analytics, KPIs, risk stratification'],
    ['HealthcareProviderView.jsx', '~1370', 'Provider dashboard: patient panel, analytics, AI agent pipeline'],
    ['AdminPanel.jsx', '~150', 'Admin user management panel'],
    ['UserSelectModal.jsx', '~80', 'Patient selection modal for providers'],
  ]
));

children.push(h3('Configuration'));
children.push(makeTable(
  ['File', 'Purpose'],
  [
    ['config/constants.js', 'FHIR_BASE URL, LOGIN_URL, USER_API_BASE'],
    ['config/agentConfigs.js', 'Agent definitions: system prompts, tool lists for Clinical, Financial, Ops, Engagement, Recommendation agents'],
    ['config/prompts.js', 'AI prompt templates for health status, care gaps, etc.'],
  ]
));

children.push(h3('Services'));
children.push(makeTable(
  ['File', 'Purpose'],
  [
    ['services/auth.js', 'Login (doLogin), session management (isSessionExpired), logout (clearSession)'],
    ['services/fhir.js', 'FHIR API calls (callFhirApi), AES-GCM decryption (maybeDecrypt), URL builder (buildUrl)'],
    ['services/ai.js', 'Azure OpenAI wrapper (callAI) — non-streaming call through /api/chat proxy'],
    ['services/agents.js', 'Multi-agent API client (runAllAgents) — sends clinical, financial, ops agent request'],
    ['services/hedis.js', 'HEDIS quality measure calculations across 8 domains'],
  ]
));

children.push(h3('Styles'));
children.push(makeTable(
  ['File', 'Scope'],
  [
    ['styles/login.css', 'Login screen'],
    ['styles/home.css', 'Home page'],
    ['styles/patient.css', 'Patient View'],
    ['styles/caremanager.css', 'Care Manager View'],
    ['styles/provider.css', 'Healthcare Provider View'],
    ['styles/admin.css', 'Admin Panel'],
    ['index.css', 'Global reset'],
  ]
));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 5: ENVIRONMENT SETUP
// ═══════════════════════════════════════════════
children.push(h1('5. Environment Setup & Deployment'));

children.push(h2('5.1 Prerequisites'));
children.push(bullet('Node.js 18+'));
children.push(bullet('npm 9+'));
children.push(bullet('Git'));

children.push(h2('5.2 Local Development'));
children.push(codeBlock('git clone https://github.com/rishabh-r/patient360.git'));
children.push(codeBlock('cd patient360'));
children.push(codeBlock('npm install'));
children.push(codeBlock('cp .env.example .env   # then edit .env with VITE_DECRYPT_KEY'));
children.push(codeBlock('npm run dev             # opens at http://localhost:5173'));

children.push(h2('5.3 Environment Variables'));
children.push(makeTable(
  ['Variable', 'Location', 'Purpose'],
  [
    ['VITE_DECRYPT_KEY', '.env (frontend)', 'AES-256-GCM decryption key for encrypted FHIR responses (Base64)'],
    ['AZURE_OPENAI_KEY', 'Vercel dashboard (server)', 'Azure OpenAI API key for GPT-4.1-mini'],
  ]
));

children.push(h2('5.4 Build & Deploy'));
children.push(p('Production build: npm run build → outputs to dist/ folder'));
children.push(p('Deployment is automatic: every push to the main branch on GitHub triggers a Vercel deployment. Vercel detects the Vite framework, builds, and deploys the SPA + Edge Functions.'));

children.push(h2('5.5 Vercel Configuration'));
children.push(codeBlock('{ "framework": "vite", "buildCommand": "npm run build", "outputDirectory": "dist",'));
children.push(codeBlock('  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }'));
children.push(p('The rewrite rule ensures all non-API routes serve index.html for client-side React Router routing. Files in the api/ folder are automatically deployed as Vercel Edge Functions.'));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 6: AUTH & ROLES
// ═══════════════════════════════════════════════
children.push(h1('6. Authentication & Role-Based Access'));

children.push(h2('6.1 Login Flow'));
children.push(p('1. User enters email + password on LoginScreen'));
children.push(p('2. POST to https://fhirassist.rsystems.com:3001/api/v1/users/login'));
children.push(p('3. Response returns: { token, role, userId, refId, email }'));
children.push(p('4. Stored in localStorage with p360_ prefix:'));
children.push(bullet('p360_token — JWT Bearer token (used for all API calls)'));
children.push(bullet('p360_role — PATIENT | PROVIDER | CARE_MANAGER | ADMIN'));
children.push(bullet('p360_ref_id — Reference ID (patient UUID or practitioner UUID)'));
children.push(bullet('p360_user — Display name (extracted from email)'));
children.push(bullet('p360_email — Login email'));
children.push(bullet('p360_login_ts — Login timestamp (for session expiry check)'));
children.push(p('5. Role-based redirect:'));
children.push(bullet('PATIENT → /patient-view?id={refId}'));
children.push(bullet('PROVIDER → /?id={refId} (then navigates to /healthcare-provider)'));
children.push(bullet('CARE_MANAGER → /care-manager?id={refId}'));
children.push(bullet('ADMIN → / (has access to all views)'));

children.push(h2('6.2 Session Management'));
children.push(bullet('Timeout: 8 hours (SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000)'));
children.push(bullet('isSessionExpired() compares current time against p360_login_ts'));
children.push(bullet('clearSession() removes all p360_* keys from localStorage'));
children.push(bullet('All API calls include Authorization: Bearer <token> header'));
children.push(bullet('401 responses automatically trigger logout + page reload'));

children.push(h2('6.3 Role Permissions'));
children.push(makeTable(
  ['Role', 'Allowed Routes', 'Key Features'],
  [
    ['PATIENT', '/patient-view', 'Read-only health dashboard, approved instructions only'],
    ['PROVIDER', '/patient-view, /healthcare-provider', 'Full analytics, AI agent pipeline, approve actions/instructions'],
    ['CARE_MANAGER', '/care-manager', 'Organization analytics, patient lists, risk stratification'],
    ['ADMIN', 'All routes', 'Full access + Admin Panel for user management'],
  ]
));

children.push(h2('6.4 Encryption (AES-256-GCM)'));
children.push(p('The FHIR backend can optionally encrypt responses. The frontend handles both modes transparently:'));
children.push(bullet('If response has { encrypted: true, payload: "..." } → decrypts using AES-GCM with 12-byte IV'));
children.push(bullet('If response is plain JSON → passes through (no-op)'));
children.push(bullet('Key: 256-bit AES key stored as Base64 in VITE_DECRYPT_KEY'));
children.push(bullet('Currently disabled by backend team — can be re-enabled without code changes'));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 7: FRONTEND APPLICATION
// ═══════════════════════════════════════════════
children.push(h1('7. Frontend Application — Views & Dashboards'));

children.push(h2('7.1 App.jsx — Root Component'));
children.push(p('The root component acts as a login gate. If no token exists in localStorage, it renders LoginScreen. Once authenticated, it renders a BrowserRouter with four routes:'));
children.push(makeTable(
  ['Route', 'Component', 'Purpose'],
  [
    ['/', 'HomePage', 'Landing page with Data Sources / Patient 360 hub / Outcomes'],
    ['/patient-view', 'PatientView', 'Patient-facing health dashboard'],
    ['/care-manager', 'CareManagerView', 'Care Manager org/patient analytics'],
    ['/healthcare-provider', 'HealthcareProviderView', 'Provider analytics + patient detail panel'],
  ]
));

children.push(h2('7.2 PatientView (~2000 lines)'));
children.push(p('The patient-facing dashboard is the most feature-rich view, organized into 6 main containers:'));
children.push(makeTable(
  ['#', 'Container', 'Data Source', 'Key Features'],
  [
    ['1', 'My Health', 'AI + FHIR', 'Health status narrative, active conditions, last medication, test results, Things to Do Today'],
    ['2', 'My Health Summary', 'AI + FHIR', 'Health overview, allergies, care team (EpisodeOfCare), clinical trends (Chart.js)'],
    ['3', 'Appointments & Visits', 'Appointment + Encounter API', 'Upcoming/past appointments, AI summary & instructions'],
    ['4', 'My Medications', 'MedicationRequest API', 'Active medications, missed/stopped meds with care gap flags'],
    ['5', 'My Care Plan & Tasks', 'AI + DocumentReference + Task Queue API', 'AI Recommended Actions, Clinical Notes, Lifestyle Goals'],
    ['6', 'Documents', 'DocumentReference API', 'Document list with view/download, base64 content decoding'],
  ]
));

children.push(h2('7.3 CareManagerView (~760 lines)'));
children.push(p('Organization-level analytics dashboard with the following sections:'));
children.push(bullet('Clinic Locations — Organization list with patient counts and search'));
children.push(bullet('KPI Row 1 — Recent Admissions + Discharges (1yr vs prior year comparison)'));
children.push(bullet('KPI Row 2 — ALOS (inpatient, yearly window) + Readmission Rate (same-disease)'));
children.push(bullet('High-Risk Patients — AI-scored patients with risk badges'));
children.push(bullet('Care Gaps — Preventive & clinical care gaps per patient'));
children.push(bullet('Risk Stratification — Pie chart of risk distribution'));
children.push(bullet('Encounter Trend — Half-yearly bar chart (completed vs cancelled)'));
children.push(bullet('Upcoming Appointments — Next booked appointment per patient'));
children.push(bullet('Population View — Total patients, high-risk count, care gaps, upcoming appointments'));

children.push(h2('7.4 HealthcareProviderView (~1370 lines)'));
children.push(p('Two-tab provider dashboard:'));

children.push(h3('Patients Tab'));
children.push(bullet('Left panel: Searchable patient list (from Practitioner/fetch-patients-by-practitioner API)'));
children.push(bullet('Right panel: Selected patient detail with Demographics, Clinical Outcomes (sparklines), Vitals, Labs, Medications, Documents'));
children.push(bullet('AI Agent Pipeline section (see Section 10) with Start Analysis, progress visualization, and results'));
children.push(bullet('AI Recommended Actions with approve workflow and semantic deduplication'));

children.push(h3('Analytics Tab'));
children.push(bullet('KPI Row: Today\'s Schedule, Yearly Visits, Avg LOS (yearly), Med Adherence'));
children.push(bullet('Today\'s Appointments schedule table'));
children.push(bullet('ER Visits, Recent Admissions, Recent Discharges (scrollable lists)'));
children.push(bullet('HEDIS Quality Measures (8 domains, scored across patient pool)'));
children.push(bullet('Care Gaps with risk prioritization'));
children.push(bullet('High-Risk Patients list'));

children.push(h2('7.5 Key Calculations'));
children.push(pRich([{ text: 'Average Length of Stay (ALOS): ', bold: true }, { text: 'Filters encounters by class.code === "IMP" or "INP" (inpatient only). Calculates (period.end - period.start) / 86400000 in days. Excludes stays ≤ 0 days. Uses yearly window (1 year vs prior year) with percentage comparison.' }]));
children.push(pRich([{ text: 'Readmission Rate: ', bold: true }, { text: 'Groups encounters by patientId::disease composite key. Counts patients admitted more than once for the same disease. Rate = (readmitted / unique patients) × 100.' }]));
children.push(pRich([{ text: 'Med Adherence: ', bold: true }, { text: 'Formula: (total meds - stopped meds) / total meds × 100, calculated across all patients.' }]));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 8: FHIR R4 INTEGRATION
// ═══════════════════════════════════════════════
children.push(h1('8. FHIR R4 API Integration'));

children.push(h2('8.1 Base Configuration'));
children.push(codeBlock('FHIR_BASE = "https://fhirassist.rsystems.com:3001"'));
children.push(codeBlock('LOGIN_URL  = "https://fhirassist.rsystems.com:3001/api/v1/users/login"'));

children.push(h2('8.2 All 14 FHIR APIs'));
children.push(makeTable(
  ['#', 'API Name', 'Endpoint', 'Key Parameters'],
  [
    ['1', 'Patient Search', '/baseR4/Patient', 'GIVEN, FAMILY, EMAIL, GENDER, BIRTHDATE, PATIENT_ID'],
    ['2', 'Conditions', '/baseR4/Condition', 'PATIENT, CODE (ICD-9/10), page'],
    ['3', 'Procedures', '/baseR4/Procedure', 'PATIENT, CODE (CPT), page'],
    ['4', 'Medications', '/baseR4/MedicationRequest', 'PATIENT, DRUG_CODE, STATUS, page'],
    ['5', 'Encounters', '/baseR4/Encounter', 'PATIENT, STATUS, CLASS, DATE, page'],
    ['6', 'Observations', '/baseR4/Observation/search', 'PATIENT, CODE (LOINC), CATEGORY, DATE, page'],
    ['7', 'Service Requests', '/baseR4/ServiceRequest', 'PATIENT, _ID, page'],
    ['8', 'Document References', '/baseR4/DocumentReference', 'PATIENT, _ID, page'],
    ['9', 'Diagnostic Reports', '/baseR4/DiagnosticReport', 'PATIENT, _ID, page'],
    ['10', 'Episodes of Care', '/baseR4/EpisodeOfCare', 'PATIENT, STATUS, TYPE, _ID, page'],
    ['11', 'Practitioners', '/baseR4/Practitioner', 'NAME, SPECIALTY, _ID, page'],
    ['12', 'Allergies', '/baseR4/AllergyIntolerance', 'PATIENT, _ID, page'],
    ['13', 'Appointments', '/baseR4/Appointment', 'PATIENT, STATUS, _ID, page'],
    ['14', 'Immunizations', '/baseR4/Immunization', 'PATIENT, _ID, page'],
  ]
));

children.push(h2('8.3 API Call Pattern'));
children.push(p('All FHIR calls go through callFhirApi() in src/services/fhir.js which:'));
children.push(bullet('Adds Authorization: Bearer <token> header from localStorage'));
children.push(bullet('Handles 401 responses by clearing session and reloading'));
children.push(bullet('Passes response through maybeDecrypt() for optional AES-GCM decryption'));
children.push(bullet('Returns parsed JSON (FHIR R4 Bundle with entry[].resource pattern)'));

children.push(h2('8.4 Pagination'));
children.push(p('All APIs use page=0 + size=100 (or size=200 for large datasets) to fetch all results in a single call. The backend pagination is non-standard: offset = page × 10 (fixed step of 10, not page × size). Using size=100 avoids overlap issues.'));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 9: AI / LLM INTEGRATION
// ═══════════════════════════════════════════════
children.push(h1('9. AI / LLM Integration'));

children.push(h2('9.1 Azure OpenAI Configuration'));
children.push(makeTable(
  ['Setting', 'Value'],
  [
    ['Endpoint', 'https://care-coordination-project.openai.azure.com/openai/deployments/gpt-4.1-mini/chat/completions'],
    ['API Version', '2025-01-01-preview'],
    ['Model', 'gpt-4.1-mini'],
    ['Authentication', 'API key via AZURE_OPENAI_KEY env variable (server-side only)'],
  ]
));

children.push(h2('9.2 Proxy Architecture'));
children.push(p('The frontend never calls Azure OpenAI directly. All LLM requests go through a Vercel Edge Function proxy (api/chat.js):'));
children.push(bullet('Browser sends POST /api/chat with model, messages, temperature, etc.'));
children.push(bullet('Edge Function adds api-key header from server-side environment variable'));
children.push(bullet('Streams or returns the Azure OpenAI response to the browser'));
children.push(bullet('This keeps the API key hidden from the client'));

children.push(h2('9.3 AI-Powered Features'));
children.push(makeTable(
  ['Feature', 'Where Used', 'Description'],
  [
    ['Health Status', 'PatientView', 'Summarizes patient overall health from FHIR data'],
    ['Care Gap Analysis', 'Dashboard / Chatbot', 'Identifies missed screenings, stopped meds, missed appointments'],
    ['AI Recommended Actions', 'PatientView, ProviderView', 'Generates prioritized care actions with timeframes'],
    ['AI Recommended Instructions', 'PatientView, ProviderView', 'Provider-approved patient instructions'],
    ['Semantic Deduplication', 'ProviderView', 'AI compares new actions against approved ones by meaning (not exact text)'],
    ['HEDIS Scoring', 'ProviderView Analytics', 'AI-assisted quality measure calculations'],
    ['Multi-Agent Pipeline', 'ProviderView', 'Clinical + Financial + Ops agents in parallel (see Section 10)'],
  ]
));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 10: MULTI-AGENT PIPELINE
// ═══════════════════════════════════════════════
children.push(h1('10. Multi-Agent Pipeline'));

children.push(h2('10.1 Architecture'));
children.push(p('The AI Agent Pipeline runs 3 specialized agents in parallel, then feeds all results into a 4th Recommendation Agent. The three agents are independent — they do not share data with each other. Only the Recommendation Agent receives all three outputs.'));
children.push(emptyLine());
children.push(p('Clinical Agent  ──┐'));
children.push(p('Financial Agent ──┼──→ Recommendation Agent → Instructions + Actions'));
children.push(p('Ops Agent       ──┘'));

children.push(h2('10.2 Agent Definitions'));

children.push(h3('Clinical Agent'));
children.push(pRich([{ text: 'Tools: ', bold: true }, { text: 'fetchConditions, fetchObservations, fetchVitals, fetchMedications' }]));
children.push(pRich([{ text: 'Tasks: ', bold: true }, { text: 'Risk Analysis, Care Gap Detection, Disease Progression, Guideline Compliance, Treatment Response' }]));
children.push(pRich([{ text: 'Output: ', bold: true }, { text: '{ riskLevel, riskReason, categories: { "Risk Analysis": [...], "Care Gap Detection": [...], ... } }' }]));

children.push(h3('Financial Agent'));
children.push(pRich([{ text: 'Tools: ', bold: true }, { text: 'fetchMedications, fetchEncounters, fetchProcedures' }]));
children.push(pRich([{ text: 'Tasks: ', bold: true }, { text: 'Cost Saving Recommendations, Documentation Gaps, High-Cost Patterns, Resource Utilization' }]));
children.push(pRich([{ text: 'Output: ', bold: true }, { text: '{ categories: { "Cost Saving Recommendations": [...], "Documentation Gaps": [...], ... } }' }]));

children.push(h3('Operations Agent'));
children.push(pRich([{ text: 'Tools: ', bold: true }, { text: 'fetchAppointments, fetchEncounters, fetchServiceRequests, fetchDocuments' }]));
children.push(pRich([{ text: 'Tasks: ', bold: true }, { text: 'Appointment Utilization, Encounter Efficiency, Referral Tracking, Workload Patterns' }]));
children.push(pRich([{ text: 'Output: ', bold: true }, { text: '{ categories: { "Appointment Utilization": [...], "Encounter Efficiency": [...], ... } }' }]));

children.push(h3('Recommendation Agent'));
children.push(pRich([{ text: 'Tools: ', bold: true }, { text: 'None (receives text summaries from the other three agents)' }]));
children.push(pRich([{ text: 'Input: ', bold: true }, { text: 'Combined analysis from Clinical + Financial + Ops agents' }]));
children.push(pRich([{ text: 'Output: ', bold: true }, { text: '{ instructions: [...], actions: [{ title, priority, timeframe, description, rationale }] }' }]));

children.push(h2('10.3 FHIR Tools Available to Agents'));
children.push(makeTable(
  ['Tool Name', 'FHIR Endpoint', 'Returns'],
  [
    ['fetchConditions', '/baseR4/Condition?patient={id}', 'ICD codes, clinical status, display names'],
    ['fetchObservations', '/baseR4/Observation/search?patient={id}', 'LOINC codes, values, units, dates'],
    ['fetchVitals', '/baseR4/Observation/vitals/search?patient={id}', 'BP, heart rate, temperature, SpO2'],
    ['fetchMedications', '/baseR4/MedicationRequest?patient={id}', 'Medication names, status, dosage, notes'],
    ['fetchEncounters', '/baseR4/Encounter?patient={id}', 'Encounter class, status, dates, diagnoses, notes'],
    ['fetchAppointments', '/baseR4/Appointment?patient={id}', 'Status, descriptions, dates'],
    ['fetchProcedures', '/baseR4/Procedure?patient={id}', 'CPT codes, descriptions, dates'],
    ['fetchServiceRequests', '/baseR4/ServiceRequest?patient={id}', 'Referral status, codes, notes'],
    ['fetchDocuments', '/baseR4/DocumentReference?patient={id}', 'Document types, descriptions, authors'],
  ]
));

children.push(h2('10.4 Frontend Pipeline UX'));
children.push(bullet('Start Analysis button triggers runAllAgents(patientId)'));
children.push(bullet('3 agent cards shown in parallel, each with a live percentage progress bar (0% → 100%)'));
children.push(bullet('Visual merge lines connect all 3 agents down to the Recommendation Agent'));
children.push(bullet('Overall progress shown as average of all 4 agents'));
children.push(bullet('Results displayed in a 3-column grid with category-grouped findings'));
children.push(bullet('Past Analysis stored in DB with separate tabs per agent type (Clinical, Financial, Ops)'));
children.push(bullet('After 30 seconds, current analysis auto-moves to Past Analysis'));

children.push(h2('10.5 Action Approval Workflow'));
children.push(p('1. Recommendation Agent generates 4–6 prioritized actions'));
children.push(p('2. Provider sees checkboxes beside each action'));
children.push(p('3. Provider selects actions and clicks "Approve Selected"'));
children.push(p('4. Approved actions saved via POST /baseR4/Practitioner/ai-recommended-action'));
children.push(p('5. Actions appear in Approved Actions tab'));
children.push(p('6. Semantic deduplication prevents re-showing approved actions (even if worded differently)'));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 11: DATABASE SCHEMA
// ═══════════════════════════════════════════════
children.push(h1('11. Database Schema'));
children.push(p('The backend database uses the FHIR R4 data model with UUID primary keys and audit columns (version, created_at, updated_at) on every table.'));

children.push(h2('11.1 Core Tables'));
children.push(makeTable(
  ['Table', 'Key Columns', 'Purpose'],
  [
    ['organization', 'id, name, type_code, active, address_*, telecom_*', 'Healthcare organizations'],
    ['practitioner', 'id, family, given, prefix, specialty_code, organization_id, telecom_*', 'Doctors + care coordinators'],
    ['patient', 'id, gender, birth_date, primary_practitioner_id, managing_organization_id', 'Core demographics'],
    ['patient_identifier', 'id, patient_id, system, value, type_code', 'MRN, SSN identifiers'],
    ['patient_name', 'id, patient_id, use_type, family, given_first, prefix', 'Name parts'],
    ['patient_address', 'id, patient_id, line1, city, state, postal_code', 'Addresses'],
    ['patient_telecom', 'id, patient_id, system, value, use_type', 'Phone/email/fax'],
  ]
));

children.push(h2('11.2 Clinical Tables'));
children.push(makeTable(
  ['Table', 'Key Columns', 'Purpose'],
  [
    ['encounter', 'id, status, encounter_class (IMP/AMB/EMER), patient_id, practitioner_id, period_start/end, clinical_notes', 'Inpatient + outpatient visits'],
    ['condition', 'id, patient_id, encounter_id, condition_code_id (FK→Condition_Master), clinical_status, onset_date', 'Diagnoses'],
    ['observation', 'id, patient_id, observation_code_id (FK→Measurement_Master), value_quantity, value_unit, effective_date', 'Lab results / vitals'],
    ['procedure', 'id, patient_id, procedure_code_id (FK→Procedure_Master), cpt_code, status, performed_start/end', 'Surgeries'],
    ['medication_request', 'id, patient_id, medication_code_id, status, dosage_text, dose_value, authored_on', 'Prescriptions'],
    ['appointment', 'id, patient_id, practitioner_id, status, description, start_time, location', 'Scheduled visits'],
    ['allergy_intolerance', 'id, patient_id, criticality, code_display, reaction_substance', 'Allergies'],
    ['diagnostic_report', 'id, patient_id, status, category_code, code_display, conclusion', 'Lab/imaging reports'],
    ['service_request', 'id, patient_id, status, intent, priority, code_display', 'Referrals'],
    ['immunization', 'id, patient_id, status, vaccine_code, occurrence_date', 'Vaccinations'],
    ['document_reference', 'id, patient_id, author_id, type_code, description, content_url', 'Clinical documents'],
  ]
));

children.push(h2('11.3 Care Program Tables'));
children.push(makeTable(
  ['Table', 'Key Columns', 'Purpose'],
  [
    ['episode_of_care', 'id, patient_id, managing_organization_id, care_manager_id, type_code, status, period_start/end', 'Care programs'],
    ['episode_of_care_diagnosis', 'id, episode_of_care_id, condition_id, role_code, rank', 'Linked diagnoses'],
    ['episode_of_care_encounter', 'id, episode_of_care_id, encounter_id', 'Linked encounters'],
    ['episode_of_care_status_history', 'id, episode_of_care_id, status, period_start/end', 'Status changes'],
  ]
));

children.push(h2('11.4 Master / Lookup Tables'));
children.push(makeTable(
  ['Table', 'Rows', 'Purpose'],
  [
    ['Condition_Master', '14,567', 'ICD-9/ICD-10 codes → row_id mapping'],
    ['Measurement_Master', '773', 'LOINC codes → row_id mapping (with expected_unit)'],
    ['Procedure_Master', '134', 'CPT code ranges → row_id mapping'],
    ['medication_code_master', '~20', 'Drug codes → display name, generic name, form'],
  ]
));

children.push(h2('11.5 FK Chain for Observations'));
children.push(p('observation.observation_code_id → Measurement_Master.row_id → Measurement_Master.loinc_code'));
children.push(p('The frontend passes a LOINC code → backend searches Measurement_Master for loinc_code → gets row_id → searches observation table by observation_code_id.'));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 12: CUSTOM BACKEND APIs
// ═══════════════════════════════════════════════
children.push(h1('12. Custom Backend APIs'));
children.push(p('Beyond the 14 standard FHIR APIs, several custom endpoints are used for task management, AI recommendations, reviews, and user management.'));

children.push(h2('12.1 User Management'));
children.push(makeTable(
  ['Method', 'Endpoint', 'Purpose'],
  [
    ['POST', '/api/v1/users/login', 'Authenticate user, returns token + role + refId'],
    ['GET', '/api/v1/users', 'List all users (Admin only)'],
    ['POST', '/api/v1/users', 'Create user (Admin only)'],
    ['PATCH', '/api/v1/users/{id}', 'Update user (Admin only)'],
  ]
));

children.push(h2('12.2 Task Queue / AI Actions'));
children.push(makeTable(
  ['Method', 'Endpoint', 'Purpose'],
  [
    ['POST', '/baseR4/portal/create-recommendations', 'Save approved AI actions as tasks'],
    ['GET', '/baseR4/portal/task-queue?patientId=...&status=...', 'Fetch tasks by status (pending, in-process, completed)'],
    ['PATCH', '/baseR4/portal/update-task?actionId=...&status=...', 'Update task status'],
  ]
));

children.push(h2('12.3 AI Recommendations'));
children.push(makeTable(
  ['Method', 'Endpoint', 'Purpose'],
  [
    ['POST', '/baseR4/Practitioner/ai-recommendation', 'Save approved instructions'],
    ['GET', '/baseR4/Patient/ai-recommendation?patientId=...', 'Get instructions (preparation=pending, completed=approved)'],
    ['POST', '/baseR4/Practitioner/ai-recommended-action', 'Save individual approved actions'],
    ['GET', '/baseR4/Patient/ai-recommended-actions?patientId=...', 'Get approved actions for patient'],
  ]
));

children.push(h2('12.4 Clinical Analysis History'));
children.push(makeTable(
  ['Method', 'Endpoint', 'Purpose'],
  [
    ['POST', '/baseR4/agent/clinical-analysis', 'Save agent analysis results (heading, summary, points)'],
    ['GET', '/baseR4/agent/clinical-analysis/patient/{id}', 'Get past analyses for a patient'],
  ]
));

children.push(h2('12.5 Other Custom APIs'));
children.push(makeTable(
  ['Method', 'Endpoint', 'Purpose'],
  [
    ['GET', '/baseR4/portal/get-review?patientId=...', 'Check review status'],
    ['POST', '/baseR4/portal/create-review', 'Mark patient as reviewed'],
    ['GET', '/api/v1/predict/risk-insights?patient_id=...', 'ML risk prediction (HTML with embedded JSON)'],
    ['POST', '/baseR4/CareCoordinationNote', 'Create care coordination note'],
    ['GET', '/baseR4/CareCoordinationNote/search?patientId=...&coordinatorEmail=...', 'Fetch coordinator notes'],
    ['GET', '/baseR4/Practitioner/fetch-patients-by-practitioner?id=...', 'Get patients linked to a practitioner'],
    ['GET', '/baseR4/Encounter/$count?organization=...&status=...&date=...', 'Count encounters for KPI cards'],
  ]
));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 13: RISK & HEDIS
// ═══════════════════════════════════════════════
children.push(h1('13. Risk Prediction & HEDIS'));

children.push(h2('13.1 Risk Prediction API'));
children.push(pRich([{ text: 'Endpoint: ', bold: true }, { text: 'GET https://fhirassist.rsystems.com:8081/api/v1/predict/risk-insights?patient_id=<id>' }]));
children.push(pRich([{ text: 'Auth: ', bold: true }, { text: 'Bearer token (same login token)' }]));
children.push(pRich([{ text: 'Response format: ', bold: true }, { text: 'HTML page with embedded var D={...} JSON in a <script> tag. Parsed using brace-depth counting (regex fails on nested objects).' }]));
children.push(emptyLine());
children.push(p('Risk categories returned: CVD (mapped to "Hypertension"), Diabetes, Cancer. Each contains:'));
children.push(bullet('risk_level: "High" / "Moderate" / "Low"'));
children.push(bullet('risk_percentage: number (e.g., 82.5)'));
children.push(bullet('risk_drivers: array of explanation strings'));
children.push(bullet('protective_factors: array of positive factors'));

children.push(h2('13.2 HEDIS Quality Measures'));
children.push(p('HEDIS (Healthcare Effectiveness Data and Information Set) scoring is calculated in src/services/hedis.js. It evaluates 8 quality domains:'));
children.push(bullet('Comprehensive Diabetes Care'));
children.push(bullet('Controlling High Blood Pressure'));
children.push(bullet('Breast Cancer Screening'));
children.push(bullet('Colorectal Cancer Screening'));
children.push(bullet('Adult BMI Assessment'));
children.push(bullet('Medication Reconciliation'));
children.push(bullet('Fall Risk Management'));
children.push(bullet('Care for Older Adults'));
children.push(p('Each measure shows a rate percentage, a progress bar, and gap details when applicable.'));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 14: TIME TRAVELLER
// ═══════════════════════════════════════════════
children.push(h1('14. Related Project — Time Traveller (CareBridge)'));

children.push(h2('14.1 Overview'));
children.push(p('The Time Traveller project is the predecessor — a clinical chatbot branded "CareBridge" that uses the same FHIR backend. It provides a conversational interface for querying patient data using Azure OpenAI function calling with 14 FHIR tools.'));

children.push(h2('14.2 Comparison'));
children.push(makeTable(
  ['Aspect', 'Time Traveller', 'Patient 360 Portal'],
  [
    ['Interface', 'Chatbot (conversational)', 'Dashboard (structured views)'],
    ['Repository', 'platform-care-coordination.git', 'patient360.git'],
    ['FHIR Backend', 'Same', 'Same'],
    ['Auth', 'Same (cb_* localStorage prefix)', 'Same (p360_* prefix)'],
    ['AI Model', 'GPT-5.4-nano + GPT-4.1-mini', 'GPT-4.1-mini'],
    ['Key Features', '14 FHIR tools, care gap analysis, clinical summary, chart rendering', 'Multi-role dashboards, agent pipeline, HEDIS, analytics'],
  ]
));

children.push(h2('14.3 Key Files'));
children.push(bullet('src/components/ChatWidget.jsx — Core chatbot logic with tool execution and message rendering'));
children.push(bullet('src/components/DashboardPage.jsx — CareCord AI dashboard (care gap visualization)'));
children.push(bullet('src/config/systemPrompt.js — Full system prompt with response patterns for all 14 APIs'));
children.push(bullet('src/config/tools.js — 14 OpenAI function-calling tool definitions'));
children.push(bullet('src/config/knowledgeBases.js — ICD-9/10, LOINC, CPT, drug codes, observation ranges'));
children.push(bullet('src/services/fhir.js — FHIR API calls + executeTool() with all 14 tool cases'));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 15: TEST DATA
// ═══════════════════════════════════════════════
children.push(h1('15. Test Data & Patients'));

children.push(h2('15.1 Patient 1 — James Robert Mitchell'));
children.push(makeTable(
  ['Field', 'Value'],
  [
    ['UUID', 'a3f8b2c1-7d4e-4a91-b6e5-9c2d1f3e8a7b'],
    ['DOB', 'June 15, 1978'],
    ['Gender', 'Male'],
    ['Primary Disease', 'Type 2 Diabetes with complications'],
    ['Practitioner', 'Dr. Sarah Chen (Endocrinology)'],
    ['Organization', 'Endocrinology Associates'],
    ['Encounters', '20 (mix of IMP and AMB)'],
    ['Time Span', 'March 2023 — March 2026'],
    ['Observations', '7 unique types: HbA1c, Creatinine, Glucose, Potassium, Triglycerides, LDL, Total Cholesterol'],
    ['Care Gaps', 'Aspirin self-discontinued, missed appointments (cancelled encounters with No-show notes)'],
    ['Episodes of Care', '4 programs: Diabetes Management, Neuropathy Pain, Hypertension Monitoring, Foot Care'],
  ]
));

children.push(h2('15.2 Patient 2 — Sarah Elizabeth Cooper'));
children.push(makeTable(
  ['Field', 'Value'],
  [
    ['UUID', 'a3e838d7-a0dc-41af-859b-113c9dc93ea9'],
    ['DOB', 'February 20, 1955'],
    ['Gender', 'Female'],
    ['Primary Disease', 'CHF with AFib, HTN, CKD'],
    ['Practitioner', 'Dr. Anita Patel (Cardiology)'],
    ['Organization', 'Raleigh Heart & Vascular Center'],
    ['Encounters', '25 (6 IMP + 17 AMB + 2 cancelled)'],
    ['Time Span', 'March 2023 — March 2026'],
    ['Observations', '9 types: HR, BP (sys/dia), Temp, Glucose, Creatinine, NT-proBNP, Potassium, Sodium'],
    ['Care Gaps', 'Furosemide self-discontinued, 2 no-show appointments'],
    ['Episodes of Care', '4 programs: CHF Management, AFib Monitoring, CKD Monitoring, Cardiac Rehab'],
  ]
));

children.push(h2('15.3 Data Generation'));
children.push(p('Test data was generated using Python scripts (not committed to the repo) and stored in chatbase_data.xlsx (also not committed). The Excel file contains 27 sheets — 3 master tables + 24 patient data sheets. The backend team imports this data into the database.'));
children.push(pageBreak());

// ═══════════════════════════════════════════════
// SECTION 16: KNOWN ISSUES
// ═══════════════════════════════════════════════
children.push(h1('16. Known Issues & Notes'));

children.push(h2('16.1 Backend Pagination'));
children.push(p('The FHIR backend pagination is non-standard: offset = page × 10 (fixed step of 10), not page × size. Using size=100 or size=200 avoids overlap issues by fetching all results in a single call.'));

children.push(h2('16.2 Risk Prediction API Format'));
children.push(p('The risk prediction API returns HTML (not JSON). The response contains embedded var D={...} in a <script> tag, parsed using brace-depth counting. Standard regex fails on nested objects.'));

children.push(h2('16.3 AES-GCM Encryption'));
children.push(p('Currently disabled by the backend team. The frontend handles both encrypted and plain JSON responses transparently via maybeDecrypt(). Can be re-enabled without any code changes.'));

children.push(h2('16.4 PowerShell Environment'));
children.push(p('The development environment uses PowerShell. Heredoc syntax (<<EOF) does not work. Use simple -m "message" for git commits.'));

children.push(h2('16.5 Files Never Committed'));
children.push(bullet('.env — Contains encryption key'));
children.push(bullet('chatbase_data.xlsx — Test data Excel file'));
children.push(bullet('generate_*.py — Python data generation scripts'));
children.push(bullet('~$chatbase_data.xlsx — Excel temp files'));

children.push(h2('16.6 Development Notes'));
children.push(bullet('notes2.md contains 3900+ lines of detailed project history — consult it for any implementation questions'));
children.push(bullet('All APIs use Bearer token auth stored in p360_token localStorage key'));
children.push(bullet('The Vercel Edge Functions (api/chat.js, api/agents.js) run server-side and have access to AZURE_OPENAI_KEY'));
children.push(bullet('Auto-deploy: push to main branch → Vercel builds and deploys automatically'));
children.push(emptyLine());
children.push(emptyLine());
children.push(new Paragraph({
  children: [new TextRun({ text: '— End of KT Document —', italics: true, size: 22, color: GRAY, font: 'Calibri' })],
  alignment: AlignmentType.CENTER,
  spacing: { before: 400 },
}));

// ─── BUILD DOCUMENT ───
const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: { top: 1200, bottom: 1000, left: 1200, right: 1200 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'Patient 360 Portal — Knowledge Transfer Document', size: 16, color: GRAY, font: 'Calibri', italics: true }),
          ],
          alignment: AlignmentType.RIGHT,
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'Confidential — R Systems International  |  Page ', size: 16, color: GRAY, font: 'Calibri' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY, font: 'Calibri' }),
          ],
          alignment: AlignmentType.CENTER,
        })],
      }),
    },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync('D:\\new api integration\\patient360\\Documents\\KT_Document.docx', buffer);
console.log('KT_Document.docx generated successfully!');
