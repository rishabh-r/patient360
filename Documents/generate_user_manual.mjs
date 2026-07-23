import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType, PageBreak, ShadingType, Header, Footer, PageNumber } from 'docx';
import { writeFileSync } from 'fs';

const BLUE = '1E3A8A'; const DARK = '1E293B'; const GRAY = '64748B'; const WHITE = 'FFFFFF';
const TH = '1E3A8A'; const ALT = 'F8FAFC';

const h1 = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 32, color: BLUE, font: 'Calibri' })], heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE } } });
const h2 = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 26, color: DARK, font: 'Calibri' })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
const h3 = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 22, color: '475569', font: 'Calibri' })], heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } });
const p = (t, o = {}) => new Paragraph({ children: [new TextRun({ text: t, size: 21, color: DARK, font: 'Calibri', ...o })], spacing: { after: 120 } });
const pB = (l, v) => new Paragraph({ children: [new TextRun({ text: l, bold: true, size: 21, color: DARK, font: 'Calibri' }), new TextRun({ text: v, size: 21, color: DARK, font: 'Calibri' })], spacing: { after: 120 } });
const bullet = (t, lv = 0) => new Paragraph({ children: [new TextRun({ text: t, size: 21, color: DARK, font: 'Calibri' })], bullet: { level: lv }, spacing: { after: 60 } });
const note = t => new Paragraph({ children: [new TextRun({ text: '💡 Note: ', bold: true, size: 21, color: '7C3AED', font: 'Calibri' }), new TextRun({ text: t, size: 21, color: '475569', font: 'Calibri', italics: true })], spacing: { after: 120 }, shading: { type: ShadingType.CLEAR, fill: 'F5F3FF' } });
const empty = () => new Paragraph({ children: [], spacing: { after: 100 } });
const pb = () => new Paragraph({ children: [new PageBreak()] });

function tbl(headers, rows) {
  const hC = headers.map(h => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: WHITE, font: 'Calibri' })], alignment: AlignmentType.LEFT })], shading: { type: ShadingType.CLEAR, fill: TH }, width: { size: Math.floor(9200 / headers.length), type: WidthType.DXA } }));
  const dR = rows.map((row, idx) => { const cells = row.map(c => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(c), size: 18, color: DARK, font: 'Calibri' })], spacing: { after: 30 } })], shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, fill: ALT } : undefined })); return new TableRow({ children: cells }); });
  return new Table({ rows: [new TableRow({ children: hC, tableHeader: true }), ...dR], width: { size: 9200, type: WidthType.DXA } });
}

const C = [];

// COVER
C.push(empty(), empty(), empty(), empty(), empty());
C.push(new Paragraph({ children: [new TextRun({ text: 'USER MANUAL', bold: true, size: 56, color: BLUE, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
C.push(new Paragraph({ children: [new TextRun({ text: 'Patient 360 Portal', size: 36, color: DARK, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }));
C.push(new Paragraph({ children: [new TextRun({ text: 'Step-by-Step Guide for All User Roles', size: 24, color: GRAY, font: 'Calibri', italics: true })], alignment: AlignmentType.CENTER, spacing: { after: 500 } }));
C.push(new Paragraph({ children: [new TextRun({ text: 'Version 1.0  |  July 8, 2026  |  R Systems International', size: 22, color: GRAY, font: 'Calibri' })], alignment: AlignmentType.CENTER }));
C.push(pb());

// TOC
C.push(h1('Table of Contents'));
['1. Introduction', '2. Getting Started — Login', '3. Home Page', '4. Patient View', '5. Healthcare Provider View', '6. Care Manager View', '7. Admin Panel', '8. Common Features', '9. Troubleshooting & FAQ'].forEach(t => C.push(p(t)));
C.push(pb());

// ═══ 1. INTRODUCTION ═══
C.push(h1('1. Introduction'));
C.push(h2('1.1 What is Patient 360 Portal?'));
C.push(p('Patient 360 Portal is a web-based healthcare application that gives you a complete view of patient health data. Depending on your role, you can view health summaries, manage care plans, run AI-powered clinical analyses, and track healthcare quality metrics — all from a single dashboard.'));

C.push(h2('1.2 Who is this for?'));
C.push(tbl(['Role', 'What You Can Do'],
  [['Patient', 'View your own health data, medications, appointments, test results, and AI-generated health insights'], ['Healthcare Provider', 'View patient details, run AI agent analysis, approve recommended actions, and view analytics'], ['Care Manager', 'Monitor organizations, track KPIs (admissions, discharges, ALOS), identify high-risk patients'], ['Admin', 'Manage users, access all views, create/update user accounts']]
));

C.push(h2('1.3 System Requirements'));
C.push(bullet('A modern web browser (Chrome, Edge, Firefox, or Safari)'));
C.push(bullet('Internet connection'));
C.push(bullet('Valid login credentials provided by your administrator'));
C.push(pb());

// ═══ 2. LOGIN ═══
C.push(h1('2. Getting Started — Login'));

C.push(h2('2.1 Accessing the Application'));
C.push(pB('URL: ', 'https://patient360-three.vercel.app'));
C.push(p('Open this URL in your web browser. You will see the login screen with the R Systems logo and "Patient 360 Portal" branding.'));

C.push(h2('2.2 Logging In'));
C.push(p('Step 1: Enter your email address in the "Email Address" field.'));
C.push(p('Step 2: Enter your password in the "Password" field.'));
C.push(p('Step 3: Click the "Launch Patient 360" button.'));
C.push(p('Step 4: You will see a "Signing you in..." overlay while the system authenticates you.'));
C.push(p('Step 5: Once authenticated, you will be automatically redirected to the appropriate dashboard based on your role.'));
C.push(note('If you see "Invalid credentials", double-check your email and password. Contact your administrator if the issue persists.'));

C.push(h2('2.3 Session & Logout'));
C.push(bullet('Your session lasts for 8 hours. After that, you will be automatically logged out.'));
C.push(bullet('To manually log out, click your profile avatar (top-right corner) and select "Sign Out".'));
C.push(bullet('After logout, you will be redirected back to the login screen.'));
C.push(pb());

// ═══ 3. HOME PAGE ═══
C.push(h1('3. Home Page'));
C.push(p('After logging in (for Provider and Admin roles), you land on the Home Page. This is the central hub of Patient 360.'));

C.push(h2('3.1 Layout'));
C.push(p('The Home Page has three sections arranged horizontally:'));
C.push(bullet('Left: Data Sources — Shows the types of data integrated (Clinical is active; others like Claims, Pharmacy, Labs are coming soon)'));
C.push(bullet('Center: Patient 360 — A visual hub showing the unified patient data concept'));
C.push(bullet('Right: Outcomes / Views — Cards linking to each dashboard view'));

C.push(h2('3.2 Navigating to Views'));
C.push(p('Click on any active Outcomes card to navigate:'));
C.push(bullet('"Patient View" — Opens the patient health dashboard'));
C.push(bullet('"Healthcare Provider View" — Opens the provider analytics and patient panel'));
C.push(bullet('"Care Manager View" — Opens the care manager organizational dashboard'));
C.push(note('Grayed-out cards (Health Plans View, Regulators View, etc.) are planned for future releases.'));
C.push(pb());

// ═══ 4. PATIENT VIEW ═══
C.push(h1('4. Patient View'));
C.push(p('The Patient View is your personal health dashboard. It shows your conditions, medications, appointments, test results, and AI-generated health insights.'));

C.push(h2('4.1 My Health (Top Section)'));
C.push(p('This section shows your overall health status as assessed by AI:'));
C.push(bullet('Health Status: A colored indicator (Good = green, Fair = yellow, Poor = orange, Critical = red) with a brief explanation'));
C.push(bullet('My Conditions: Your top 2 primary diagnoses in simple, patient-friendly language'));
C.push(bullet('Last Medication: The most recently prescribed medication with date'));
C.push(bullet('Test Results: A summary of recent lab values and what they mean'));
C.push(bullet('Things to Do Today: 2 personalized daily health tasks generated by AI'));
C.push(note('Sections marked with a purple "AI" badge are generated by artificial intelligence based on your actual medical data.'));

C.push(h2('4.2 My Health Summary'));
C.push(bullet('Health Overview: An AI-written paragraph summarizing your overall health in plain language'));
C.push(bullet('Allergies: List of known allergies with severity'));
C.push(bullet('Care Team: Your assigned care coordinators and their programs'));
C.push(bullet('Clinical Trends: Interactive line charts showing how your lab values have changed over time (e.g., blood sugar, cholesterol). Click different tabs to view different measurements.'));

C.push(h2('4.3 Appointments & Visits'));
C.push(bullet('Upcoming Appointments: Shows your next scheduled visits with date, time, and provider'));
C.push(bullet('Past Visits: History of completed encounters'));
C.push(bullet('AI Summary: For each visit, AI generates a patient-friendly summary of what was done'));
C.push(bullet('Follow-up Instructions: AI-generated personalized follow-up actions'));

C.push(h2('4.4 My Medications'));
C.push(bullet('Active Medications: Currently prescribed drugs with name, dosage, and frequency'));
C.push(bullet('Stopped Medications: Medications that are no longer active, flagged with care gap warnings if self-discontinued'));

C.push(h2('4.5 My Care Plan & Tasks'));
C.push(bullet('AI Recommended Actions: Prioritized care actions generated by AI (read-only for patients)'));
C.push(bullet('Approved Instructions: Instructions that your healthcare provider has reviewed and approved for you'));
C.push(bullet('Clinical Notes: Recent clinical documentation from your healthcare visits'));
C.push(bullet('Lifestyle Goals: Health and wellness goals'));

C.push(h2('4.6 Documents'));
C.push(bullet('View your clinical documents (discharge summaries, procedure notes, etc.)'));
C.push(bullet('Click "View" to read the full document in a modal'));
C.push(bullet('Click the download icon to save the document as a text file'));
C.push(pb());

// ═══ 5. PROVIDER VIEW ═══
C.push(h1('5. Healthcare Provider View'));
C.push(p('The Healthcare Provider View gives clinicians full access to patient data, AI-powered analysis tools, and clinical quality metrics.'));

C.push(h2('5.1 Navigation'));
C.push(p('The Provider View has two main tabs at the top:'));
C.push(bullet('Patients Tab: Patient list with detailed clinical view'));
C.push(bullet('Analytics Tab: Population-level KPIs, quality measures, and trends'));

C.push(h2('5.2 Patients Tab'));
C.push(h3('Patient List (Left Panel)'));
C.push(bullet('Shows all patients assigned to you, sorted alphabetically'));
C.push(bullet('Use the search bar to filter by patient name'));
C.push(bullet('Click on any patient to load their details in the right panel'));

C.push(h3('Patient Details (Right Panel)'));
C.push(p('After selecting a patient, the right panel shows:'));
C.push(bullet('Patient Demographics: Name, DOB, MRN, phone, email'));
C.push(bullet('Clinical Outcomes: Sparkline charts showing observation trends over time'));
C.push(bullet('Recent Vitals: Latest vital signs (paginated, 4 per page)'));
C.push(bullet('Lab Results: Latest lab values (paginated)'));
C.push(bullet('Current Medications: Active prescriptions (paginated)'));
C.push(bullet('Documents: Clinical documents with View and Download options'));

C.push(h3('AI Agent Pipeline'));
C.push(p('This is the key feature of the Provider View — the multi-agent AI analysis system.'));
C.push(empty());
C.push(p('How to use:', { bold: true }));
C.push(p('Step 1: Select a patient from the left panel.'));
C.push(p('Step 2: Scroll down to "AI Agent Pipeline" section.'));
C.push(p('Step 3: Click "Start Analysis" button.'));
C.push(p('Step 4: Watch the progress — 3 agents (Clinical, Financial, Ops) analyze in parallel:'));
C.push(bullet('Each agent shows a live percentage progress bar', 1));
C.push(bullet('When all 3 complete, results feed into the Recommendation Agent', 1));
C.push(bullet('Total progress is shown as a percentage in the header', 1));
C.push(p('Step 5: View results — each agent shows findings grouped by category (e.g., Risk Analysis, Cost Savings, Appointment Utilization).'));
C.push(p('Step 6: Review AI Recommended Actions below the pipeline.'));
C.push(p('Step 7: Select actions using checkboxes and click "Approve Selected" to save them.'));
C.push(note('After 30 seconds, the current analysis automatically moves to the "Past Analysis" tab for archival.'));

C.push(h3('Past Analysis'));
C.push(p('Click the "Past Analysis" tab to view previous agent analyses. Results are organized into three sub-tabs:'));
C.push(bullet('Clinical: Past Clinical Agent analyses'));
C.push(bullet('Financial: Past Financial Agent analyses'));
C.push(bullet('Ops: Past Operations Agent analyses'));
C.push(p('Each entry is expandable — click to view the full categorized findings.'));

C.push(h2('5.3 Analytics Tab'));
C.push(p('The Analytics tab shows population-level metrics for all your patients:'));
C.push(bullet("Today's Schedule: Number of appointments scheduled for today"));
C.push(bullet('Yearly Visits: Total encounters in the past year with year-over-year comparison'));
C.push(bullet('Avg LOS: Average Length of Stay for inpatient encounters (IMP/INP) over the past year'));
C.push(bullet('Med Adherence: Percentage of active (non-stopped) medications'));
C.push(empty());
C.push(p('Below the KPIs:'));
C.push(bullet("Today's Appointments: Detailed schedule table"));
C.push(bullet('ER Visits: Latest emergency visits per patient'));
C.push(bullet('Recent Admissions: Latest inpatient admissions per patient'));
C.push(bullet('Recent Discharges: Latest discharges with LOS and follow-up dates'));
C.push(bullet('HEDIS Quality Measures: 8 healthcare quality metrics with scores and gap details'));
C.push(pb());

// ═══ 6. CARE MANAGER VIEW ═══
C.push(h1('6. Care Manager View'));
C.push(p('The Care Manager View provides an organizational overview of patient populations, care quality, and operational metrics.'));

C.push(h2('6.1 Clinic Locations'));
C.push(bullet('Left sidebar shows organizations you manage'));
C.push(bullet('Search organizations by name'));
C.push(bullet('Click on an organization to load its analytics'));
C.push(bullet('Each org shows patient count'));

C.push(h2('6.2 Analytics Dashboard'));
C.push(p('After selecting an organization, the main panel shows:'));

C.push(h3('KPI Cards'));
C.push(bullet('Recent Admissions: Count with year-over-year percentage change'));
C.push(bullet('Discharges: Count with year-over-year percentage change'));
C.push(bullet('ALOS (Average Length of Stay): Days with year-over-year percentage change'));
C.push(bullet('Readmission Rate: Percentage of patients readmitted for the same disease'));

C.push(h3('High-Risk Patients'));
C.push(bullet('Patients scored as high-risk by the AI risk prediction system'));
C.push(bullet('Each card shows patient name, risk score, and primary concern'));

C.push(h3('Preventive & Clinical Care Gaps'));
C.push(bullet('AI-identified care gaps per patient'));
C.push(bullet('Color-coded by risk level (High Risk = red, Medium = yellow, Low = green)'));

C.push(h3('Other Sections'));
C.push(bullet('Risk Stratification: Pie chart showing distribution of risk levels'));
C.push(bullet('Encounter Trend: Bar chart of completed vs cancelled encounters over half-year periods'));
C.push(bullet('Upcoming Appointments: Next scheduled appointment per patient'));
C.push(bullet('Population View: Summary cards for total patients, high-risk count, care gaps, and upcoming appointments'));
C.push(pb());

// ═══ 7. ADMIN ═══
C.push(h1('7. Admin Panel'));
C.push(p('The Admin Panel allows system administrators to manage user accounts.'));

C.push(h2('7.1 Accessing the Admin Panel'));
C.push(p('After logging in as an Admin, click the gear icon in the top navigation bar to open the Admin Panel.'));

C.push(h2('7.2 User Management'));
C.push(bullet('View All Users: See all registered users (excluding deactivated ones)'));
C.push(bullet('Filter by Role: Click role tabs to filter — All, Patient, Provider, Care Manager'));
C.push(bullet('Create User: Click "Add User" to create a new account with email, password, role, and reference ID'));
C.push(bullet('Edit User: Click on a user to modify their role, reference ID, or active status'));
C.push(bullet('Deactivate: Set a user as inactive to prevent login without deleting their account'));
C.push(note('The Admin role itself is hidden from the filter tabs and user creation. Admin accounts are managed by the system.'));
C.push(pb());

// ═══ 8. COMMON FEATURES ═══
C.push(h1('8. Common Features'));

C.push(h2('8.1 AI-Generated Content'));
C.push(p('Sections marked with a purple "AI" or "AI Generated" badge are produced by artificial intelligence. This includes health summaries, recommended actions, risk assessments, and clinical trends analysis.'));
C.push(p('Hover over the AI badge to see the tooltip: "AI generated information".'));

C.push(h2('8.2 Pagination'));
C.push(p('Long lists (vitals, medications, documents, past analyses) are paginated. Use "Prev" and "Next" buttons or page numbers to navigate between pages.'));

C.push(h2('8.3 Profile & Sign Out'));
C.push(p('Click your profile avatar (top-right corner) to see:'));
C.push(bullet('Your name and email'));
C.push(bullet('"Sign Out" button to end your session'));

C.push(h2('8.4 Notifications'));
C.push(p('The bell icon in the navigation bar shows a notification count. This is currently for display purposes; future versions will include real-time alerts.'));

C.push(h2('8.5 Back Navigation'));
C.push(p('Each view has a "← Back to Home" link in the sub-header to return to the Home Page.'));
C.push(pb());

// ═══ 9. FAQ ═══
C.push(h1('9. Troubleshooting & FAQ'));

C.push(h2('Q: I cannot log in. What should I do?'));
C.push(bullet('Double-check your email and password'));
C.push(bullet('Ensure your account is active (contact your administrator)'));
C.push(bullet('Clear your browser cache and try again'));
C.push(bullet('If using a corporate network, check if the portal URL is accessible'));

C.push(h2('Q: The page shows "Loading..." and never finishes.'));
C.push(bullet('Check your internet connection'));
C.push(bullet('The FHIR backend server may be temporarily unavailable'));
C.push(bullet('Try refreshing the page (Ctrl+R or Cmd+R)'));

C.push(h2('Q: AI Agent Analysis is stuck at a percentage.'));
C.push(bullet('The analysis can take 30-60 seconds depending on the amount of patient data'));
C.push(bullet('If stuck for more than 2 minutes, refresh the page and try again'));
C.push(bullet('The AI service (Azure OpenAI) may be experiencing high load'));

C.push(h2('Q: I see "0 days" for Avg LOS.'));
C.push(p('This means there are no inpatient encounters (IMP/INP class) for the selected time period. Outpatient visits (AMB) are not included in ALOS calculations.'));

C.push(h2('Q: My approved actions disappeared.'));
C.push(p('Approved actions are saved to the database and appear in the "Approved Actions" tab. The AI Recommended Actions tab only shows new, unapproved recommendations. Check the Approved Actions tab.'));

C.push(h2('Q: How often is the data refreshed?'));
C.push(p('Data is fetched live from the FHIR backend every time you open a dashboard or select a patient. There is no caching — you always see the latest data.'));

C.push(h2('Q: Can I export data?'));
C.push(p('Currently, you can download individual documents as text files. Full data export functionality is planned for a future release.'));

C.push(empty(), empty());
C.push(new Paragraph({ children: [new TextRun({ text: '— End of User Manual —', italics: true, size: 22, color: GRAY, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { before: 400 } }));

const doc = new Document({
  sections: [{ properties: { page: { margin: { top: 1100, bottom: 900, left: 1100, right: 1100 } } },
    headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'Patient 360 Portal — User Manual', size: 16, color: GRAY, font: 'Calibri', italics: true })], alignment: AlignmentType.RIGHT })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: 'R Systems International  |  Page ', size: 16, color: GRAY, font: 'Calibri' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY, font: 'Calibri' })], alignment: AlignmentType.CENTER })] }) },
    children: C }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync('D:\\new api integration\\patient360\\Documents\\User_Manual.docx', buffer);
console.log('User_Manual.docx generated!');
