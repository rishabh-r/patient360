import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType, PageBreak, ShadingType, Header, Footer, PageNumber } from 'docx';
import { writeFileSync } from 'fs';

const BLUE = '1E3A8A'; const DARK = '1E293B'; const GRAY = '64748B'; const WHITE = 'FFFFFF';
const TH_BG = '1E3A8A'; const ALT_BG = 'F8FAFC';

const h1 = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 32, color: BLUE, font: 'Calibri' })], heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE } } });
const h2 = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 26, color: DARK, font: 'Calibri' })], heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
const h3 = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 22, color: '475569', font: 'Calibri' })], heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } });
const p = (t, o = {}) => new Paragraph({ children: [new TextRun({ text: t, size: 21, color: DARK, font: 'Calibri', ...o })], spacing: { after: 120 } });
const pBold = (l, v) => new Paragraph({ children: [new TextRun({ text: l, bold: true, size: 21, color: DARK, font: 'Calibri' }), new TextRun({ text: v, size: 21, color: DARK, font: 'Calibri' })], spacing: { after: 120 } });
const bullet = (t, lv = 0) => new Paragraph({ children: [new TextRun({ text: t, size: 21, color: DARK, font: 'Calibri' })], bullet: { level: lv }, spacing: { after: 60 } });
const code = t => new Paragraph({ children: [new TextRun({ text: t, size: 18, font: 'Consolas', color: '374151' })], spacing: { after: 60 }, shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' }, indent: { left: 400 } });
const empty = () => new Paragraph({ children: [], spacing: { after: 100 } });
const pb = () => new Paragraph({ children: [new PageBreak()] });

function tbl(headers, rows) {
  const hCells = headers.map(h => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: WHITE, font: 'Calibri' })], alignment: AlignmentType.LEFT })], shading: { type: ShadingType.CLEAR, fill: TH_BG }, width: { size: Math.floor(9200 / headers.length), type: WidthType.DXA } }));
  const dRows = rows.map((row, idx) => {
    const cells = row.map(c => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(c), size: 18, color: DARK, font: 'Calibri' })], spacing: { after: 30 } })], shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, fill: ALT_BG } : undefined }));
    return new TableRow({ children: cells });
  });
  return new Table({ rows: [new TableRow({ children: hCells, tableHeader: true }), ...dRows], width: { size: 9200, type: WidthType.DXA } });
}

const C = [];

// COVER
C.push(empty(), empty(), empty(), empty(), empty());
C.push(new Paragraph({ children: [new TextRun({ text: 'TECHNICAL DOCUMENT', bold: true, size: 56, color: BLUE, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
C.push(new Paragraph({ children: [new TextRun({ text: 'Database · API · SQL Objects · AI Details', size: 28, color: GRAY, font: 'Calibri', italics: true })], alignment: AlignmentType.CENTER, spacing: { after: 500 } }));
C.push(new Paragraph({ children: [new TextRun({ text: 'Patient 360 Portal', size: 36, color: DARK, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }));
C.push(new Paragraph({ children: [new TextRun({ text: 'Version 1.0  |  July 8, 2026  |  R Systems International', size: 22, color: GRAY, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }));
C.push(pb());

// TOC
C.push(h1('Table of Contents'));
['1. Database Schema', '2. FHIR R4 API Specifications', '3. Custom Backend API Specifications', '4. SQL Objects & Stored Procedures', '5. AI / LLM Technical Details', '6. Multi-Agent System Architecture', '7. Data Encryption', '8. Environment Configuration'].forEach(t => C.push(p(t)));
C.push(pb());

// ═══ SECTION 1: DATABASE ═══
C.push(h1('1. Database Schema'));
C.push(p('The backend database follows the FHIR R4 data model. All tables use UUID primary keys and include audit columns: version (integer), created_at (timestamp), updated_at (timestamp).'));

C.push(h2('1.1 Entity Relationship Overview'));
C.push(p('The schema centers around the patient table. All clinical tables (encounter, condition, observation, procedure, medication_request, etc.) reference patient via patient_id foreign key. Encounters link patients to practitioners. Master tables provide standardized code lookups.'));
C.push(empty());
C.push(p('Key relationships:', { bold: true }));
C.push(bullet('patient.primary_practitioner_id → practitioner.id'));
C.push(bullet('patient.managing_organization_id → organization.id'));
C.push(bullet('encounter.patient_id → patient.id'));
C.push(bullet('encounter.practitioner_id → practitioner.id'));
C.push(bullet('condition.condition_code_id → Condition_Master.row_id'));
C.push(bullet('observation.observation_code_id → Measurement_Master.row_id'));
C.push(bullet('procedure.procedure_code_id → Procedure_Master.row_id'));
C.push(bullet('medication_request.medication_code_id → medication_code_master.id'));
C.push(bullet('episode_of_care.care_manager_id → practitioner.id'));

C.push(h2('1.2 Core Tables — Detailed Schema'));

// organization
C.push(h3('1.2.1 organization'));
C.push(p('Stores healthcare organizations (hospitals, clinics, care centers).'));
C.push(tbl(['Column', 'Type', 'Constraints', 'Description'],
  [['id', 'UUID', 'PK', 'Unique identifier'], ['name', 'VARCHAR(255)', 'NOT NULL', 'Organization name'], ['type_code', 'VARCHAR(50)', '', 'Organization type code (e.g., prov, dept)'], ['type_display', 'VARCHAR(255)', '', 'Display name for type'], ['active', 'BOOLEAN', 'DEFAULT true', 'Whether org is active'], ['address_line1', 'VARCHAR(255)', '', 'Street address'], ['address_city', 'VARCHAR(100)', '', 'City'], ['address_state', 'VARCHAR(50)', '', 'State'], ['address_postal_code', 'VARCHAR(20)', '', 'ZIP/postal code'], ['address_country', 'VARCHAR(50)', '', 'Country'], ['telecom_phone', 'VARCHAR(50)', '', 'Phone number'], ['telecom_email', 'VARCHAR(255)', '', 'Email address'], ['version', 'INTEGER', 'DEFAULT 0', 'Optimistic locking'], ['created_at', 'TIMESTAMP', 'DEFAULT NOW()', 'Creation timestamp'], ['updated_at', 'TIMESTAMP', 'DEFAULT NOW()', 'Last update timestamp']]
));

// practitioner
C.push(h3('1.2.2 practitioner'));
C.push(p('Stores doctors, specialists, care coordinators, and nurses.'));
C.push(tbl(['Column', 'Type', 'Constraints', 'Description'],
  [['id', 'UUID', 'PK', 'Unique identifier'], ['active', 'BOOLEAN', 'DEFAULT true', 'Whether practitioner is active'], ['family', 'VARCHAR(100)', 'NOT NULL', 'Last name'], ['given', 'VARCHAR(100)', '', 'First name'], ['prefix', 'VARCHAR(20)', '', 'Title (Dr., Mr., etc.)'], ['gender', 'VARCHAR(10)', '', 'Gender (male/female)'], ['birth_date', 'DATE', '', 'Date of birth'], ['qualification_code', 'VARCHAR(50)', '', 'Qualification code (MD, RN, etc.)'], ['qualification_display', 'VARCHAR(255)', '', 'Qualification description'], ['specialty_code', 'VARCHAR(50)', '', 'Specialty code'], ['specialty_display', 'VARCHAR(255)', '', 'Specialty name (Cardiology, Endocrinology, etc.)'], ['organization_id', 'UUID', 'FK → organization.id', 'Associated organization'], ['telecom_phone', 'VARCHAR(50)', '', 'Phone number'], ['telecom_email', 'VARCHAR(255)', '', 'Email address']]
));

// patient
C.push(h3('1.2.3 patient'));
C.push(p('Core patient demographics table.'));
C.push(tbl(['Column', 'Type', 'Constraints', 'Description'],
  [['id', 'UUID', 'PK', 'Patient UUID (used in all API calls)'], ['active', 'BOOLEAN', 'DEFAULT true', 'Whether patient record is active'], ['gender', 'VARCHAR(10)', '', 'Gender (male/female)'], ['birth_date', 'DATE', '', 'Date of birth'], ['deceased_flag', 'BOOLEAN', 'DEFAULT false', 'Whether patient is deceased'], ['deceased_date', 'DATE', '', 'Date of death (if applicable)'], ['marital_status_code', 'VARCHAR(20)', '', 'Marital status code (M, S, D, W)'], ['marital_status_display', 'VARCHAR(50)', '', 'Marital status display'], ['language_code', 'VARCHAR(10)', '', 'Preferred language code (en, es, etc.)'], ['language_display', 'VARCHAR(50)', '', 'Language display name'], ['primary_practitioner_id', 'UUID', 'FK → practitioner.id', 'Primary care doctor'], ['managing_organization_id', 'UUID', 'FK → organization.id', 'Managing healthcare org']]
));

C.push(h3('1.2.4 patient_identifier'));
C.push(tbl(['Column', 'Type', 'Constraints', 'Description'],
  [['id', 'UUID', 'PK', 'Row ID'], ['patient_id', 'UUID', 'FK → patient.id', 'Patient reference'], ['system', 'VARCHAR(255)', '', 'Identifier system URI'], ['value', 'VARCHAR(100)', 'NOT NULL', 'Identifier value (MRN number, SSN, etc.)'], ['type_code', 'VARCHAR(10)', '', 'Type code (MR for MRN, SS for SSN)']]
));

C.push(h3('1.2.5 patient_name / patient_address / patient_telecom'));
C.push(p('Sub-tables for patient name parts, addresses, and contact information. Each has patient_id FK → patient.id. Patient can have multiple names (official, nickname), addresses (home, work), and telecom entries (phone, email, fax).'));

C.push(pb());
C.push(h2('1.3 Clinical Tables — Detailed Schema'));

// encounter
C.push(h3('1.3.1 encounter'));
C.push(p('Unified table for all visit types: inpatient (IMP), outpatient (AMB), and emergency (EMER). Replaces the old Visit_Admission + Visit_Outpatient tables.'));
C.push(tbl(['Column', 'Type', 'Constraints', 'Description'],
  [['id', 'UUID', 'PK', 'Encounter UUID'], ['status', 'VARCHAR(20)', '', 'finished | in-progress | planned | cancelled'], ['encounter_class', 'VARCHAR(10)', '', 'IMP (inpatient) | AMB (outpatient) | EMER (emergency)'], ['type_code', 'VARCHAR(50)', '', 'Visit type code'], ['type_display', 'VARCHAR(255)', '', 'Visit type description'], ['patient_id', 'UUID', 'FK → patient.id', 'Patient reference'], ['practitioner_id', 'UUID', 'FK → practitioner.id', 'Attending practitioner'], ['period_start', 'TIMESTAMP', '', 'Admission/visit start datetime'], ['period_end', 'TIMESTAMP', '', 'Discharge/visit end datetime'], ['admission_location', 'VARCHAR(255)', '', 'Admission ward/unit'], ['discharge_location', 'VARCHAR(255)', '', 'Discharge destination'], ['discharge_disposition_code', 'VARCHAR(50)', '', 'Disposition code (home, transfer, etc.)'], ['reason_code', 'VARCHAR(50)', '', 'Reason for visit code'], ['reason_display', 'VARCHAR(255)', '', 'Reason for visit text'], ['diagnosis_text', 'TEXT', '', 'Diagnosis description'], ['insurance', 'VARCHAR(255)', '', 'Insurance information'], ['clinical_notes', 'TEXT', '', 'Clinical notes (stored as extension in FHIR response)']]
));

// condition
C.push(h3('1.3.2 condition'));
C.push(tbl(['Column', 'Type', 'Constraints', 'Description'],
  [['id', 'UUID', 'PK', 'Condition UUID'], ['patient_id', 'UUID', 'FK → patient.id', 'Patient reference'], ['encounter_id', 'UUID', 'FK → encounter.id', 'Associated encounter'], ['recorder_id', 'UUID', 'FK → practitioner.id', 'Recording practitioner'], ['condition_code_id', 'INTEGER', 'FK → Condition_Master.row_id', 'FK to master ICD code table'], ['clinical_status', 'VARCHAR(20)', '', 'active | inactive | resolved | remission'], ['verification_status', 'VARCHAR(20)', '', 'confirmed | provisional | differential'], ['severity_code', 'VARCHAR(50)', '', 'Severity code'], ['severity_display', 'VARCHAR(100)', '', 'Severity description (mild, moderate, severe)'], ['seq_num', 'INTEGER', '', '1 = primary diagnosis, 2 = secondary'], ['onset_date', 'DATE', '', 'When condition started'], ['abatement_date', 'DATE', '', 'When condition resolved (if applicable)'], ['recorded_date', 'DATE', '', 'When condition was recorded']]
));

// observation
C.push(h3('1.3.3 observation'));
C.push(p('Stores lab results and vital signs. Links to Measurement_Master via observation_code_id for LOINC code resolution.'));
C.push(tbl(['Column', 'Type', 'Constraints', 'Description'],
  [['id', 'UUID', 'PK', 'Observation UUID'], ['patient_id', 'UUID', 'FK → patient.id', 'Patient reference'], ['encounter_id', 'UUID', 'FK → encounter.id', 'Associated encounter'], ['performer_id', 'UUID', 'FK → practitioner.id', 'Performing practitioner'], ['observation_code_id', 'INTEGER', 'FK → Measurement_Master.row_id', 'FK to master LOINC code table'], ['status', 'VARCHAR(20)', '', 'final | preliminary | amended'], ['value_quantity', 'DECIMAL', '', 'Numeric value (e.g., 9.2 for HbA1c)'], ['value_unit', 'VARCHAR(50)', '', 'Unit of measurement (%, mg/dL, etc.)'], ['value_string', 'VARCHAR(255)', '', 'Text value (for non-numeric observations)'], ['interpretation_code', 'VARCHAR(20)', '', 'H (high) | L (low) | N (normal) | A (abnormal)'], ['effective_date', 'TIMESTAMP', '', 'When observation was taken'], ['issued', 'TIMESTAMP', '', 'When result was issued']]
));

C.push(h3('1.3.4 procedure'));
C.push(tbl(['Column', 'Type', 'Constraints', 'Description'],
  [['id', 'UUID', 'PK', 'Procedure UUID'], ['patient_id', 'UUID', 'FK → patient.id', 'Patient'], ['encounter_id', 'UUID', 'FK → encounter.id', 'Encounter'], ['performer_id', 'UUID', 'FK → practitioner.id', 'Surgeon/performer'], ['procedure_code_id', 'INTEGER', 'FK → Procedure_Master.row_id', 'FK to CPT master'], ['cpt_code', 'VARCHAR(20)', '', 'CPT code (e.g., 99222, 82947)'], ['status', 'VARCHAR(20)', '', 'completed | in-progress | not-done'], ['description', 'TEXT', '', 'Procedure description'], ['performed_start', 'TIMESTAMP', '', 'Start datetime'], ['performed_end', 'TIMESTAMP', '', 'End datetime'], ['body_site_code', 'VARCHAR(50)', '', 'Body site code'], ['outcome_code', 'VARCHAR(50)', '', 'Outcome code']]
));

C.push(h3('1.3.5 medication_request'));
C.push(tbl(['Column', 'Type', 'Constraints', 'Description'],
  [['id', 'UUID', 'PK', 'MedicationRequest UUID'], ['patient_id', 'UUID', 'FK → patient.id', 'Patient'], ['encounter_id', 'UUID', 'FK → encounter.id', 'Encounter'], ['requester_id', 'UUID', 'FK → practitioner.id', 'Prescribing doctor'], ['medication_code_id', 'INTEGER', 'FK → medication_code_master.id', 'FK to drug master'], ['status', 'VARCHAR(20)', '', 'active | stopped | completed | on-hold'], ['intent', 'VARCHAR(20)', '', 'order | plan | proposal'], ['priority', 'VARCHAR(20)', '', 'routine | urgent | stat'], ['dosage_text', 'VARCHAR(255)', '', 'Dosage instructions'], ['dose_value', 'DECIMAL', '', 'Dose amount (e.g., 500)'], ['dose_unit', 'VARCHAR(20)', '', 'Dose unit (mg, mL, etc.)'], ['frequency_text', 'VARCHAR(100)', '', 'Frequency (daily, BID, etc.)'], ['reason_code', 'VARCHAR(50)', '', 'Reason for prescription'], ['note', 'TEXT', '', 'Notes (care gap markers: "self-discontinued", etc.)'], ['authored_on', 'DATE', '', 'When prescribed'], ['valid_start', 'DATE', '', 'Start of validity'], ['valid_end', 'DATE', '', 'End of validity']]
));

C.push(h3('1.3.6 Other Clinical Tables'));
C.push(p('The following tables follow the same UUID PK + patient_id FK + audit columns pattern:'));
C.push(tbl(['Table', 'Key Fields', 'Purpose'],
  [['appointment', 'patient_id, practitioner_id, status (booked/fulfilled/noshow/cancelled), start_time, end_time, description, location', 'Scheduled visits'], ['allergy_intolerance', 'patient_id, criticality, code_value, code_display, reaction_substance, reaction_manifestation, reaction_severity', 'Patient allergies'], ['diagnostic_report', 'patient_id, encounter_id, status, category_code, code_display, effective_date, conclusion', 'Lab/imaging reports'], ['service_request', 'patient_id, status (active/completed), intent, priority, code_display, authored_on', 'Referrals and orders'], ['immunization', 'patient_id, status, vaccine_code, vaccine_display, occurrence_date, lot_number', 'Vaccinations'], ['document_reference', 'patient_id, author_id, type_code (11506-3=Clinical, 34108-1=Admin), description, content_url, content_type', 'Clinical documents']]
));

C.push(pb());
C.push(h2('1.4 Care Program Tables'));
C.push(tbl(['Table', 'Key Fields', 'Purpose'],
  [['episode_of_care', 'patient_id, managing_organization_id, care_manager_id (FK→practitioner), type_code, type_display, status (active/finished), period_start, period_end', 'Care programs (e.g., Diabetes Management, CHF Program)'], ['episode_of_care_diagnosis', 'episode_of_care_id (FK), condition_id (FK→condition), role_code, rank', 'Links care programs to diagnoses'], ['episode_of_care_encounter', 'episode_of_care_id (FK), encounter_id (FK→encounter)', 'Links care programs to encounters'], ['episode_of_care_status_history', 'episode_of_care_id (FK), status, period_start, period_end', 'Tracks status changes over time']]
));

C.push(h2('1.5 Master / Lookup Tables'));

C.push(h3('1.5.1 Condition_Master (14,567 rows)'));
C.push(tbl(['Column', 'Type', 'Description'],
  [['row_id', 'INTEGER', 'PK — referenced by condition.condition_code_id'], ['icd9_code', 'VARCHAR(20)', 'ICD-9 or ICD-10 code (e.g., 25000, E11.9)'], ['short_title', 'VARCHAR(100)', 'Short description (e.g., DMII wo cmp)'], ['long_title', 'VARCHAR(500)', 'Full description'], ['category', 'VARCHAR(100)', 'Category grouping'], ['cat_code', 'VARCHAR(20)', 'Category code']]
));

C.push(h3('1.5.2 Measurement_Master (773 rows)'));
C.push(tbl(['Column', 'Type', 'Description'],
  [['row_id', 'INTEGER', 'PK — referenced by observation.observation_code_id'], ['itemid', 'INTEGER', 'Internal item ID'], ['label', 'VARCHAR(200)', 'Observation label (e.g., Hemoglobin A1c, Heart Rate)'], ['fluid', 'VARCHAR(50)', 'Body fluid type (Blood, Urine, etc.)'], ['category', 'VARCHAR(50)', 'Category (Chemistry, Hematology, etc.)'], ['loinc_code', 'VARCHAR(20)', 'LOINC code (e.g., 4548-4, 8867-4)'], ['expected_unit', 'VARCHAR(50)', 'Expected unit (%, mg/dL, /min, etc.)']]
));

C.push(h3('1.5.3 Procedure_Master (134 rows)'));
C.push(tbl(['Column', 'Type', 'Description'],
  [['row_id', 'INTEGER', 'PK — referenced by procedure.procedure_code_id'], ['category', 'VARCHAR(100)', 'Procedure category'], ['sectionrange', 'VARCHAR(50)', 'CPT section range'], ['sectionheader', 'VARCHAR(200)', 'Section header name'], ['codesuffix', 'VARCHAR(20)', 'Code suffix'], ['mincodeinsubsection', 'INTEGER', 'Min CPT code in subsection'], ['maxcodeinsubsection', 'INTEGER', 'Max CPT code in subsection']]
));

C.push(h3('1.5.4 medication_code_master (~20 rows)'));
C.push(tbl(['Column', 'Type', 'Description'],
  [['id', 'INTEGER', 'PK — referenced by medication_request.medication_code_id'], ['code_system', 'VARCHAR(255)', 'Code system URI'], ['code_value', 'VARCHAR(50)', 'Drug code (e.g., METF500, INSR)'], ['code_display', 'VARCHAR(255)', 'Display name (e.g., Metformin 500mg)'], ['generic_name', 'VARCHAR(255)', 'Generic drug name'], ['form_code', 'VARCHAR(50)', 'Drug form code (TAB, INJ, etc.)'], ['form_display', 'VARCHAR(100)', 'Form description (Tablet, Injection, etc.)'], ['active', 'BOOLEAN', 'Whether drug is active in formulary']]
));

C.push(h2('1.6 FK Chain — Observation Resolution'));
C.push(p('The critical observation lookup chain:'));
C.push(code('Frontend sends LOINC code (e.g., "4548-4" for HbA1c)'));
C.push(code('  → Backend searches Measurement_Master WHERE loinc_code = "4548-4"'));
C.push(code('  → Gets row_id (e.g., 53)'));
C.push(code('  → Backend searches observation WHERE observation_code_id = 53'));
C.push(code('  → Returns observation with code.coding populated from Measurement_Master'));
C.push(pb());

// ═══ SECTION 2: FHIR APIs ═══
C.push(h1('2. FHIR R4 API Specifications'));
C.push(pBold('Base URL: ', 'https://fhirassist.rsystems.com:3001'));
C.push(pBold('Authentication: ', 'Bearer token in Authorization header'));
C.push(pBold('Response Format: ', 'FHIR R4 Bundle — { resourceType: "Bundle", entry: [{ resource: {...} }, ...] }'));
C.push(pBold('Pagination: ', 'page (0-indexed) + size params. Default: page=0, size=100'));

C.push(h2('2.1 All 14 FHIR Endpoints'));
C.push(tbl(['#', 'Resource', 'Method', 'Endpoint', 'Key Query Parameters'],
  [['1', 'Patient', 'GET', '/baseR4/Patient', 'GIVEN, FAMILY, EMAIL, GENDER, BIRTHDATE, _ID'], ['2', 'Condition', 'GET', '/baseR4/Condition', 'patient, code (ICD), page, size'], ['3', 'Procedure', 'GET', '/baseR4/Procedure', 'patient, code (CPT), page, size'], ['4', 'MedicationRequest', 'GET', '/baseR4/MedicationRequest', 'patient, drug_code, status, page, size'], ['5', 'Encounter', 'GET', '/baseR4/Encounter', 'patient, status, class, date (range), page, size'], ['6', 'Observation', 'GET', '/baseR4/Observation/search', 'patient, code (LOINC), category, date, page, size'], ['7', 'ServiceRequest', 'GET', '/baseR4/ServiceRequest', 'patient, _id, page, size'], ['8', 'DocumentReference', 'GET', '/baseR4/DocumentReference', 'patient, _id, type.coding, page, size'], ['9', 'DiagnosticReport', 'GET', '/baseR4/DiagnosticReport', 'patient, _id, page, size'], ['10', 'EpisodeOfCare', 'GET', '/baseR4/EpisodeOfCare', 'patient, status, type, _id, page, size'], ['11', 'Practitioner', 'GET', '/baseR4/Practitioner', 'name, specialty, _id, page, size'], ['12', 'AllergyIntolerance', 'GET', '/baseR4/AllergyIntolerance', 'patient, _id, page, size'], ['13', 'Appointment', 'GET', '/baseR4/Appointment', 'patient, status, _id, page, size'], ['14', 'Immunization', 'GET', '/baseR4/Immunization', 'patient, _id, page, size']]
));

C.push(h2('2.2 Specialized Endpoints'));
C.push(tbl(['Endpoint', 'Method', 'Purpose'],
  [['/baseR4/Observation/vitals/search?patient={id}', 'GET', 'Fetch vitals only (BP, HR, temp, SpO2)'], ['/baseR4/Encounter/$count?organization={id}&status=...&date=...', 'GET', 'Count encounters for KPI analytics'], ['/baseR4/Practitioner/fetch-patients-by-practitioner?id={id}', 'GET', 'Get patients linked to a practitioner']]
));

C.push(h2('2.3 Response Structure Example'));
C.push(p('All FHIR APIs return a Bundle:'));
C.push(code('{ "resourceType": "Bundle", "total": 5,'));
C.push(code('  "entry": ['));
C.push(code('    { "resource": { "resourceType": "Condition", "id": "uuid", ... } },'));
C.push(code('    { "resource": { "resourceType": "Condition", "id": "uuid", ... } }'));
C.push(code('  ] }'));

C.push(h2('2.4 Date Range Filtering'));
C.push(p('Encounters and observations support date range queries using two date params:'));
C.push(code('GET /baseR4/Encounter?patient={id}&date=gt2025-01-01&date=lt2026-01-01'));
C.push(p('The gt/lt prefixes mean "greater than" and "less than" respectively.'));
C.push(pb());

// ═══ SECTION 3: CUSTOM APIs ═══
C.push(h1('3. Custom Backend API Specifications'));

C.push(h2('3.1 User Management'));
C.push(tbl(['Method', 'Endpoint', 'Body / Params', 'Response', 'Auth'],
  [['POST', '/api/v1/users/login', '{ email, password }', '{ token, role, userId, refId, email }', 'None'], ['GET', '/api/v1/users', '—', 'Array of user objects', 'Bearer (Admin)'], ['POST', '/api/v1/users', '{ email, password, role, refId, isActive }', 'Created user object', 'Bearer (Admin)'], ['PATCH', '/api/v1/users/{id}', '{ role?, refId?, isActive? }', 'Updated user object', 'Bearer (Admin)']]
));

C.push(h2('3.2 Task Queue'));
C.push(tbl(['Method', 'Endpoint', 'Body / Params', 'Response'],
  [['POST', '/baseR4/portal/create-recommendations', '[{ patientId, priority, action, description, aiRationale, dueDate }]', 'Created records with actionId UUIDs'], ['GET', '/baseR4/portal/task-queue?patientId=...&status=...', 'status: pending | in-process | completed', 'Array of task objects'], ['PATCH', '/baseR4/portal/update-task?actionId=...&status=...', 'status: pending | in-process | completed', 'Updated task object']]
));

C.push(h2('3.3 AI Recommendations'));
C.push(tbl(['Method', 'Endpoint', 'Body / Params', 'Response'],
  [['POST', '/baseR4/Practitioner/ai-recommendation', '{ patientId, practitionerId, payloads: [strings] }', '201 Created — Communication resource'], ['GET', '/baseR4/Patient/ai-recommendation?patientId=...', '—', 'Bundle of Communication resources (status: preparation=pending, completed=approved)'], ['POST', '/baseR4/Practitioner/ai-recommended-action', '{ patientId, practitionerId, title, description, priority, urgencyNote }', 'Created action resource'], ['GET', '/baseR4/Patient/ai-recommended-actions?patientId=...', '—', 'Bundle with action entries (extensions for title, priority, urgency, verified-at)']]
));

C.push(h2('3.4 Clinical Analysis History'));
C.push(tbl(['Method', 'Endpoint', 'Body / Params', 'Response'],
  [['POST', '/baseR4/agent/clinical-analysis', '{ heading, summary, points: [strings], patientId, organizationId }', 'Saved analysis record'], ['GET', '/baseR4/agent/clinical-analysis/patient/{id}', '—', 'Array of { id, heading, summary, points, createdAt }']]
));

C.push(h2('3.5 Review & Care Coordination'));
C.push(tbl(['Method', 'Endpoint', 'Body / Params', 'Response'],
  [['GET', '/baseR4/portal/get-review?patientId=...', '—', '{ reviewId, parentId, isReviewed, createdDate }'], ['POST', '/baseR4/portal/create-review', '{ patientId }', 'Created review record'], ['POST', '/baseR4/CareCoordinationNote', '{ patientId, coordinatorEmail, coordinatorName, coordinatorRole, careNotes }', '201 Created — DocumentReference resource'], ['GET', '/baseR4/CareCoordinationNote/search?patientId=...&coordinatorEmail=...', '—', 'Bundle of DocumentReference entries']]
));

C.push(h2('3.6 Risk Prediction'));
C.push(tbl(['Method', 'Endpoint', 'Params', 'Response Format'],
  [['GET', '/api/v1/predict/risk-insights?patient_id=...', 'patient_id (UUID)', 'HTML with embedded var D={...} JSON in <script> tag']]
));
C.push(p('Response parsing: Brace-depth counting algorithm extracts JSON from HTML. Contains risk_level, risk_percentage, risk_drivers[], protective_factors[] for cvd, diabetes, cancer categories.'));
C.push(pb());

// ═══ SECTION 4: SQL OBJECTS ═══
C.push(h1('4. SQL Objects & Stored Procedures'));
C.push(p('The backend is a Spring Boot application that auto-generates SQL from JPA entity annotations. The database layer does not expose raw stored procedures to the frontend. Instead, the Spring Data JPA repository layer provides the following query operations:'));

C.push(h2('4.1 Key Query Operations'));
C.push(tbl(['Operation', 'SQL Equivalent', 'Used By'],
  [['Patient search by name/email/ID', 'SELECT * FROM patient WHERE given LIKE ? OR family LIKE ? OR id = ?', 'Patient Search API'], ['Conditions by patient', 'SELECT c.*, cm.icd9_code, cm.short_title FROM condition c JOIN Condition_Master cm ON c.condition_code_id = cm.row_id WHERE c.patient_id = ?', 'Condition API'], ['Observations by patient + LOINC', 'SELECT o.*, mm.loinc_code, mm.label FROM observation o JOIN Measurement_Master mm ON o.observation_code_id = mm.row_id WHERE o.patient_id = ? AND mm.loinc_code = ?', 'Observation API'], ['Encounters by status + date range', 'SELECT * FROM encounter WHERE patient_id = ? AND status = ? AND period_start > ? AND period_start < ?', 'Encounter API'], ['Encounter count by org', 'SELECT COUNT(*) FROM encounter WHERE organization_id = ? AND status = ? AND period_start BETWEEN ? AND ?', 'Encounter $count API'], ['Medications by patient + status', 'SELECT mr.*, mcm.code_display FROM medication_request mr JOIN medication_code_master mcm ON mr.medication_code_id = mcm.id WHERE mr.patient_id = ?', 'MedicationRequest API'], ['EpisodeOfCare with care manager', 'SELECT eoc.*, p.given, p.family FROM episode_of_care eoc JOIN practitioner p ON eoc.care_manager_id = p.id WHERE eoc.patient_id = ?', 'EpisodeOfCare API'], ['Documents by type code', 'SELECT * FROM document_reference WHERE patient_id = ? AND type_code = ?', 'DocumentReference API (type.coding filter)'], ['Patients by practitioner', 'SELECT DISTINCT p.* FROM patient p JOIN encounter e ON p.id = e.patient_id WHERE e.practitioner_id = ?', 'Practitioner/fetch-patients API']]
));

C.push(h2('4.2 Indexes (Inferred)'));
C.push(p('Based on query patterns, the following indexes are critical for performance:'));
C.push(tbl(['Table', 'Indexed Columns', 'Purpose'],
  [['encounter', 'patient_id, status, period_start', 'Date range + status filtering'], ['condition', 'patient_id, condition_code_id', 'Patient condition lookups'], ['observation', 'patient_id, observation_code_id, effective_date', 'Patient observation lookups by LOINC code'], ['medication_request', 'patient_id, status', 'Active/stopped medication queries'], ['appointment', 'patient_id, status, start_time', 'Upcoming appointment queries'], ['episode_of_care', 'patient_id, status', 'Active care program lookups'], ['document_reference', 'patient_id, type_code', 'Document type filtering']]
));
C.push(pb());

// ═══ SECTION 5: AI DETAILS ═══
C.push(h1('5. AI / LLM Technical Details'));

C.push(h2('5.1 Model Configuration'));
C.push(tbl(['Parameter', 'Value'],
  [['Provider', 'Azure OpenAI'], ['Model', 'gpt-4.1-mini'], ['Deployment', 'care-coordination-project'], ['API Version', '2025-01-01-preview'], ['Endpoint', 'https://care-coordination-project.openai.azure.com/openai/deployments/gpt-4.1-mini/chat/completions'], ['Max Tokens', '500 (general) / 1500 (agents) / 3500 (dashboard analysis)'], ['Temperature', '0.2–0.4 (low for consistent structured output)'], ['Streaming', 'Supported via api/chat.js proxy (SSE format)']]
));

C.push(h2('5.2 AI Prompts Catalog'));
C.push(p('All prompts are defined in src/config/prompts.js and return structured JSON:'));
C.push(tbl(['Prompt', 'Output Format', 'Used In'],
  [['HEALTH_STATUS_PROMPT', '{ status: Good|Fair|Poor|Critical, reason, riskScore: 0-100 }', 'PatientView — My Health container'], ['CONDITIONS_PROMPT', '["Disease 1", "Disease 2"]', 'PatientView — primary conditions display'], ['HEALTH_SUMMARY_PROMPT', '{ condition, summary }', 'PatientView — Health Summary container'], ['APPT_SUMMARY_PROMPT', '{ summary }', 'PatientView — appointment visit summaries'], ['APPT_INSTRUCTIONS_PROMPT', '["instruction 1", "instruction 2", "instruction 3"]', 'PatientView — follow-up instructions'], ['AI_ACTIONS_PROMPT', '[{ title, priority, timeframe, description, rationale }]', 'PatientView — AI Recommended Actions'], ['DEDUP_INSTRUCTIONS_PROMPT', '["unique instruction 1", ...]', 'ProviderView — semantic deduplication'], ['TASKS_PROMPT', '["task 1", "task 2"]', 'PatientView — Things to Do Today']]
));

C.push(h2('5.3 Proxy Architecture'));
C.push(p('All AI calls are proxied through Vercel Edge Functions to keep the API key server-side:'));
C.push(code('Browser → POST /api/chat → Vercel Edge (api/chat.js) → Azure OpenAI'));
C.push(p('The proxy adds the api-key header and streams the response back. The frontend never has access to AZURE_OPENAI_KEY.'));

C.push(h2('5.4 HEDIS Quality Measure Calculations'));
C.push(p('Implemented in src/services/hedis.js with custom logic following NCQA specifications:'));
C.push(tbl(['Measure', 'Eligible Criteria', 'Met Criteria'],
  [['Comprehensive Diabetes Care (HbA1c)', 'Has condition code starting with E11', 'HbA1c observation (LOINC 4548-4) in past year'], ['Controlling High Blood Pressure', 'Has condition code starting with I10', 'Latest SBP < 140 AND DBP < 90'], ['Breast Cancer Screening', 'Female, age 50-74', 'Mammography (LOINC 24606-6) in past 2 years'], ['Colorectal Cancer Screening', 'Age 50-75', 'Colonoscopy or FIT test in past year'], ['Adult BMI Assessment', 'Age 18+', 'BMI observation (LOINC 39156-5) in past year'], ['Medication Reconciliation', 'Had inpatient encounter in past year', 'Medication reconciliation within 30 days of discharge'], ['Fall Risk Management', 'Age 65+', 'Fall risk assessment in past year'], ['Care for Older Adults', 'Age 66+', 'Medication review + functional assessment in past year']]
));
C.push(pb());

// ═══ SECTION 6: MULTI-AGENT ═══
C.push(h1('6. Multi-Agent System Architecture'));

C.push(h2('6.1 Server-Side Implementation (api/agents.js)'));
C.push(p('The agent pipeline runs entirely on Vercel Edge Functions (server-side). It is a single HTTP endpoint that orchestrates multiple LLM calls:'));
C.push(code('POST /api/agents'));
C.push(code('Body: { patientId: "uuid", agents: ["clinical", "financial", "ops"], token: "jwt" }'));
C.push(empty());
C.push(p('Execution flow:', { bold: true }));
C.push(p('1. Parse request → extract patientId, agent list, auth token'));
C.push(p('2. For each agent in parallel (Promise.all):'));
C.push(bullet('Send system prompt + tools to Azure OpenAI (function calling mode)'));
C.push(bullet('LLM responds with tool_calls → execute FHIR API calls server-side'));
C.push(bullet('Return tool results to LLM → LLM produces analysis JSON'));
C.push(bullet('Up to 5 iterations of tool calling per agent'));
C.push(p('3. Combine all agent outputs → send to Recommendation Agent'));
C.push(p('4. Return { agents: { clinical, financial, ops }, recommendations: { instructions, actions } }'));

C.push(h2('6.2 Agent System Prompts'));
C.push(p('Each agent has a system prompt that instructs it to use FHIR tools and return grouped categories. The prompts instruct the LLM to:'));
C.push(bullet('Call specific FHIR tools to fetch patient data'));
C.push(bullet('Analyze the returned data against clinical guidelines'));
C.push(bullet('Return ONLY valid JSON with categories as keys'));
C.push(bullet('Be specific — reference actual values, dates, and codes from the data'));

C.push(h2('6.3 Tool Execution Flow'));
C.push(p('When the LLM requests a tool call, the server-side executeTool() function:'));
C.push(p('1. Maps tool name to FHIR endpoint path'));
C.push(p('2. Calls the FHIR API using the patient\'s auth token'));
C.push(p('3. Extracts relevant fields from each Bundle entry (max 50 entries)'));
C.push(p('4. Returns stringified JSON to the LLM as tool result'));
C.push(p('5. LLM uses the data to form its analysis'));

C.push(h2('6.4 Frontend Progress Tracking'));
C.push(p('The frontend simulates progress with setInterval timers:'));
C.push(bullet('Each agent gets an independent progress bar incrementing at random intervals (8-13% per 800ms)'));
C.push(bullet('Progress caps at 90% until the API response arrives'));
C.push(bullet('On API completion: all three agents snap to 100%, recommendation agent starts'));
C.push(bullet('Overall progress = average of all 4 agent percentages'));
C.push(pb());

// ═══ SECTION 7: ENCRYPTION ═══
C.push(h1('7. Data Encryption'));

C.push(h2('7.1 AES-256-GCM Encryption'));
C.push(p('The FHIR backend optionally encrypts all API responses using AES-256-GCM:'));
C.push(tbl(['Aspect', 'Detail'],
  [['Algorithm', 'AES-256-GCM (Galois/Counter Mode)'], ['Key Size', '256-bit (32 bytes)'], ['Key Format', 'Base64-encoded in VITE_DECRYPT_KEY environment variable'], ['IV Size', '12 bytes (prepended to ciphertext)'], ['Encrypted Response', '{ encrypted: true, payload: "<base64 string>" }'], ['Decryption', 'First 12 bytes = IV, remainder = ciphertext → AES-GCM decrypt → JSON'], ['Current Status', 'Disabled by backend team (frontend handles both modes)']]
));

C.push(h2('7.2 Implementation'));
C.push(code('// src/services/fhir.js'));
C.push(code('async function decryptPayload(payloadB64) {'));
C.push(code('  const data = base64ToUint8(payloadB64);'));
C.push(code('  const iv = data.slice(0, 12);       // First 12 bytes = IV'));
C.push(code('  const ciphertext = data.slice(12);   // Rest = encrypted data'));
C.push(code('  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);'));
C.push(code('  return JSON.parse(new TextDecoder().decode(decrypted));'));
C.push(code('}'));
C.push(pb());

// ═══ SECTION 8: ENVIRONMENT ═══
C.push(h1('8. Environment Configuration'));

C.push(h2('8.1 Frontend Environment'));
C.push(tbl(['Variable', 'File', 'Description'],
  [['VITE_DECRYPT_KEY', '.env', 'AES-256-GCM key (Base64). Used by maybeDecrypt() in fhir.js']]
));

C.push(h2('8.2 Server Environment (Vercel)'));
C.push(tbl(['Variable', 'Set In', 'Description'],
  [['AZURE_OPENAI_KEY', 'Vercel Dashboard → Environment Variables', 'Azure OpenAI API key. Used by api/chat.js and api/agents.js']]
));

C.push(h2('8.3 External Service URLs'));
C.push(tbl(['Service', 'URL', 'Port'],
  [['FHIR R4 Backend', 'https://fhirassist.rsystems.com:3001', '3001'], ['Risk Prediction API', 'https://fhirassist.rsystems.com:8081/api/v1/predict/risk-insights', '8081'], ['Azure OpenAI', 'https://care-coordination-project.openai.azure.com', '443'], ['Vercel (Production)', 'https://patient360-three.vercel.app', '443']]
));

C.push(empty(), empty());
C.push(new Paragraph({ children: [new TextRun({ text: '— End of Technical Document —', italics: true, size: 22, color: GRAY, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { before: 400 } }));

const doc = new Document({
  sections: [{ properties: { page: { margin: { top: 1100, bottom: 900, left: 1100, right: 1100 } } },
    headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'Patient 360 Portal — Technical Document', size: 16, color: GRAY, font: 'Calibri', italics: true })], alignment: AlignmentType.RIGHT })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: 'Confidential — R Systems International  |  Page ', size: 16, color: GRAY, font: 'Calibri' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY, font: 'Calibri' })], alignment: AlignmentType.CENTER })] }) },
    children: C }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync('D:\\new api integration\\patient360\\Documents\\Technical_Document.docx', buffer);
console.log('Technical_Document.docx generated!');
