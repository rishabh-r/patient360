import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, TabStopType, TabStopPosition } from 'docx';
import { writeFileSync } from 'fs';

const BLACK = '000000'; const DARK = '1E293B'; const BLUE = '0563C1';

const title = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 32, font: 'Calibri', color: BLACK })], alignment: AlignmentType.CENTER, spacing: { after: 40 } });
const contact = runs => new Paragraph({ children: runs.map(r => new TextRun({ size: 20, font: 'Calibri', color: BLACK, ...r })), alignment: AlignmentType.CENTER, spacing: { after: 40 } });
const link = (label, url) => new TextRun({ text: label, size: 20, font: 'Calibri', color: BLUE, underline: {} });

const sectionHead = t => new Paragraph({
  children: [new TextRun({ text: t, bold: true, size: 24, font: 'Calibri', color: BLACK })],
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 240, after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLACK } },
});

const jobLine = (titleText, right) => new Paragraph({
  children: [
    new TextRun({ text: titleText, bold: true, size: 21, font: 'Calibri' }),
    new TextRun({ text: '\t' + right, size: 21, font: 'Calibri' }),
  ],
  tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
  spacing: { after: 20 },
});

const subTitle = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, italics: true, size: 20, font: 'Calibri', color: '333333' })], spacing: { before: 80, after: 40 } });

const p = t => new Paragraph({ children: [new TextRun({ text: t, size: 20, font: 'Calibri', color: DARK })], spacing: { after: 60 } });

const bullet = t => new Paragraph({
  children: [new TextRun({ text: t, size: 20, font: 'Calibri', color: DARK })],
  bullet: { level: 0 },
  spacing: { after: 50 },
});

const bulletBold = (label, rest) => new Paragraph({
  children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri', color: DARK }), new TextRun({ text: rest, size: 20, font: 'Calibri', color: DARK })],
  bullet: { level: 0 },
  spacing: { after: 50 },
});

const empty = () => new Paragraph({ children: [], spacing: { after: 40 } });

const C = [];

// ─── HEADER ───
C.push(title('Rishabh Raj'));
C.push(contact([
  { text: 'rishabh.raj12099@gmail.com' },
  { text: '  |  ' },
  { text: '+91-8340182298' },
  { text: '  |  ' },
  { text: 'linkedin.com/in/rishabh-raj-78236b18a/', color: BLUE, underline: {} },
]));
C.push(contact([
  { text: 'Portfolio: ', bold: true },
  { text: 'https://my-portfolio-navy-six-97.vercel.app/', color: BLUE, underline: {} },
]));

// ─── SUMMARY ───
C.push(empty());
C.push(p('Generative AI Engineer with 4+ years of experience building LLM-powered solutions across AI voice agents, RAG pipelines, clinical chatbots, and structured automation workflows. Proficient in prompt engineering, agentic orchestration, function calling, and deploying production-grade applications using OpenAI, Azure OpenAI, Gemini, Vertex AI, Groq, and Python. Delivered end-to-end projects including hospital voice automation with Twilio, FHIR R4-integrated healthcare chatbots with care gap analysis dashboards, multi-agent clinical pipelines, portfolio data extractors, and AI agents deployed on GCP, Azure, and Vercel.'));

// ─── EXPERIENCE ───
C.push(sectionHead('Work Experience'));

// R Systems
C.push(jobLine('Senior Data Engineer (Gen AI Engineer), R Systems International – Noida', 'Sept 2025 – Present'));

C.push(subTitle('Key Client Project – US Med-Equip'));
C.push(p('Designed and deployed a fully conversational AI agent that handles inbound hospital calls requesting medical bed pickups. The agent verifies the caller, collects required pickup details, and automatically creates backend pickup orders.'));
C.push(bullet('Built dynamic pickup item assembly logic: the agent detects whether the caller provides barcode or model name, and appends structured objects into pickup_items_list for API submission.'));
C.push(bullet('Designed voice-optimized prompts to minimize re-confirmations while maintaining data accuracy, improving natural conversational tone.'));
C.push(bullet('Integrated Retell AI with Make.com workflows for webhook-triggered order creation, address normalization, and ZIP code resolution.'));
C.push(bullet('Engineered time inference module: if caller says "ASAP", agent calls date_and_time function; if caller says "tomorrow" or similar, agent requests specific date.'));
C.push(bullet('Ensured JSON schema compliance for pickup_items, enabling seamless POST requests into backend systems.'));
C.push(bullet('Architected a multi-step conversational workflow covering hospital identity verification, department validation, pickup item processing, patient association, and pickup scheduling.'));

C.push(subTitle('Key Client Project – Patient 360 Care Coordination Platform'));
C.push(p('Designed and built a multi-view React care coordination portal integrating FHIR R4 APIs, role-based access control, and AI-powered clinical insights across three distinct user roles.'));
C.push(bullet('Engineered a multi-role React (Vite) portal with RBAC-driven routing — Patient View, Healthcare Provider View, and Care Manager View — each serving FHIR-backed data per role via AES-256-GCM encrypted patient IDs in URL params, with session auto-logout and role-gated navigation.'));
C.push(bullet('Integrated FHIR R4 REST APIs (Patient, Condition, MedicationRequest, Observation, Appointment, EpisodeOfCare, DocumentReference) with Bearer token auth; implemented sessionStorage caching for AI-generated content to eliminate redundant LLM calls across re-renders.'));
C.push(bullet('Replaced monolithic system prompt with targeted, context-injected Azure OpenAI GPT-4.1-mini calls per UI section — AI health summaries, care plan tasks, and clinical recommendations generated live from FHIR response payloads with zero hardcoded clinical logic.'));
C.push(bullet('Built a multi-agent AI pipeline with 3 parallel agents (Clinical, Financial, Operations) each autonomously calling FHIR tools via function calling, with outputs synthesized by a Recommendation Agent for actionable care instructions.'));
C.push(bullet('Built healthcare provider analytics panel with high-risk patient flagging, HEDIS/MIPS gap tracking, 6 KPI cards, population health view, and a care manager org-level patient roster — all wired to a structured mock-to-live FHIR data pipeline.'));

C.push(subTitle('FHIR Medical Chatbot'));
C.push(p('Designed and deployed a fully conversational chatbot from scratch for the marketing team to showcase to several clients. The chatbot is based on FHIR medical services.'));
C.push(bullet('Developed an AI-powered clinical chatbot using Azure OpenAI function calling with 14 FHIR R4 tool schemas, enabling the LLM to autonomously resolve ICD/LOINC/CPT codes, chain API calls, and perform multi-step clinical reasoning across patient conditions, observations, and medications.'));
C.push(bullet('Built a secondary AI analysis pipeline for care gap detection — structured JSON (severity-ranked alerts, deteriorating trends, prioritised actions) extracted by a dedicated LLM call from cached FHIR responses, feeding an approval-to-task-queue workflow; integrated a risk-prediction ML API with a custom brace-depth JSON parser and auto-adaptive clinical trend charts.'));

// Tracxn
C.push(empty());
C.push(jobLine('Technical Program Manager (Gen AI Engineer), Tracxn Technologies – Bengaluru', 'June 2025 – Sept 2025'));

C.push(subTitle('Prompt Engineering & LLM Contributions'));
C.push(bulletBold('Built Scalable Prompting Pipelines for Automated Portfolio Extraction — ', 'Designed zero-shot and schema-constrained prompts for parsing portfolio company data from over 30,000 websites using CrawlAI. Created modular, reusable system prompts and versioned output schemas, enabling seamless integration into automation pipelines.'));
C.push(bulletBold('Implemented Version-Controlled Prompt Optimization Lifecycle — ', 'Migrated and refined prompts across multiple LLM platforms (Groq LLaMA → Gemini → Vertex AI), iteratively improving accuracy, edge case handling, and schema alignment through prompt versions (V1 to V5).'));
C.push(bulletBold('Designed Resume–JD Matching System with Comparative and Role Prompting — ', 'Developed a resume parser and job match evaluator using structured output and reasoning-based prompts. Implemented classification prompts with rationale generation ("Good Match", "Mediocre", etc.), supporting internal recruitment workflows.'));
C.push(bulletBold('Automated CXO Profile Updater Using Comparative Prompting and Context Injection — ', 'Scraped and cleaned company websites, injected structured Markdown into prompts, and compared data against internal CXO records. Used classification prompting (Create/Update/Ignore) with JSON schema output for reliable database updates.'));
C.push(bulletBold('Deployed LLM Pipelines on GCP — ', 'Provisioned Vertex AI endpoints for serving Gemini models, configured Cloud Run for containerized prompt execution microservices, and connected Vertex AI with CrawlAI ingestion pipelines via Cloud Functions for automated portfolio extraction at scale.'));
C.push(bulletBold('Led Prompt Design Documentation & Junior Enablement — ', 'Created prompt documentation templates, versioned prompt libraries, and test workflows. Conducted KT sessions to train junior engineers on prompt engineering strategies, edge case handling, and debugging techniques.'));

// HCL
C.push(empty());
C.push(jobLine('Technical Lead (Gen AI Engineer), HCL Technologies – Noida', 'Oct 2022 – Aug 2024'));

C.push(subTitle('Project 1: Finance Agentic Automation System'));
C.push(bulletBold('Designed Goal-Oriented Agentic Workflows with Structured Prompting — ', 'Architected prompts enabling multi-agent coordination for finance processes like invoice validation, anomaly detection, and audit logging.'));
C.push(bulletBold('Built Prompt Chains Using Role + Reasoning Prompts — ', 'Orchestrated multi-step prompt flows to simulate decision-making in financial operations, enabling dynamic task execution based on context and goals.'));

C.push(subTitle('Project 2: RAG-based Agentic AI Framework'));
C.push(bullet('Developed an end-to-end Retrieval-Augmented Generation (RAG) system with all three phases: ingestion, query, and generation.'));
C.push(bullet('Implemented document ingestion pipelines with embeddings, applied cosine similarity search for efficient retrieval, and built generation workflows for accurate and context-aware responses.'));
C.push(bullet('Integrated the RAG framework into an agentic workflow to dynamically use retrieved knowledge for decision-making and task execution.'));

C.push(subTitle('Project 3: Internal Web Portal Enhancement'));
C.push(bullet('Contributed to front-end development of internal tools, focusing on CSS layout, styling consistency, and responsive design.'));
C.push(bullet('Worked closely with full-stack teams to maintain UI/UX coherence across browsers and screen sizes.'));

// Infosys
C.push(empty());
C.push(jobLine('Systems Engineer (AI Engineer), Infosys Limited – Bengaluru', 'Mar 2021 – Jun 2022'));

C.push(subTitle('Project: ML Support – Azure Cloud AI Stack'));
C.push(bullet('Worked in a cloud ML support role where I helped resolve issues related to Azure ML deployments, training failures, and pipeline errors.'));
C.push(bullet('Built Python scripts to automate log parsing and reduce manual troubleshooting time, improving the team\'s support efficiency.'));
C.push(bullet('Gained exposure to production ML workflows, including endpoint deployment, model versioning, and real-time inference debugging.'));
C.push(bullet('Although not directly involved in model building, the role provided a strong foundation in ML operations, enabling a smooth transition into engineering roles.'));

// ─── EDUCATION ───
C.push(sectionHead('Education'));
C.push(jobLine('Birla Institute of Technology, Mesra — B.E. in Computer Science and Engineering', 'Aug 2016 – July 2020'));

// ─── SKILLS ───
C.push(sectionHead('Skills'));

C.push(new Paragraph({ children: [
  new TextRun({ text: 'Agentic AI & Multi-Agent Systems: ', bold: true, size: 20, font: 'Calibri' }),
  new TextRun({ text: 'Google ADK, Multi-Agent Orchestration, Agent-to-Agent Communication, Tool Calling, Function Calling, Workflow Design, Autonomous Decision-Making, Parallel Agent Execution, Result Synthesis', size: 20, font: 'Calibri' }),
], spacing: { after: 60 } }));

C.push(new Paragraph({ children: [
  new TextRun({ text: 'GenAI, RAG & Vector Databases: ', bold: true, size: 20, font: 'Calibri' }),
  new TextRun({ text: 'LLMs (GPT-4, Gemini, LLaMA), RAG Pipelines, Embeddings, FAISS, Pinecone, Chroma, Cosine Similarity Search, Document Chunking, Retrieval Optimization, Prompt Engineering (zero-shot, few-shot, chain-of-thought, structured JSON output, context injection, prompt versioning)', size: 20, font: 'Calibri' }),
], spacing: { after: 60 } }));

C.push(new Paragraph({ children: [
  new TextRun({ text: 'GCP AI & Deployment: ', bold: true, size: 20, font: 'Calibri' }),
  new TextRun({ text: 'Google Cloud Platform, Vertex AI, Cloud Run, Cloud Functions, AI Deployment, Model Serving, Endpoint Management, Model Versioning', size: 20, font: 'Calibri' }),
], spacing: { after: 60 } }));

C.push(new Paragraph({ children: [
  new TextRun({ text: 'LLM Tools & Platforms: ', bold: true, size: 20, font: 'Calibri' }),
  new TextRun({ text: 'OpenAI GPT, Azure OpenAI, Azure AI Foundry, Google Gemini, Groq (LLaMA), Vertex AI, CrawlAI, CrewAI, LangChain, Retell AI', size: 20, font: 'Calibri' }),
], spacing: { after: 60 } }));

C.push(new Paragraph({ children: [
  new TextRun({ text: 'Enterprise Integration & APIs: ', bold: true, size: 20, font: 'Calibri' }),
  new TextRun({ text: 'REST APIs, FHIR R4 API Integration, OpenAPI 3.0, Bearer Token Auth, AES-256-GCM Encryption, Webhook Integration, Enterprise System Integration, Make.com Workflows', size: 20, font: 'Calibri' }),
], spacing: { after: 60 } }));

C.push(new Paragraph({ children: [
  new TextRun({ text: 'Technical Skills: ', bold: true, size: 20, font: 'Calibri' }),
  new TextRun({ text: 'Python, Node.js, JavaScript (ES6+), React.js, HTML/CSS, JSON, Postman, Git', size: 20, font: 'Calibri' }),
], spacing: { after: 60 } }));

C.push(new Paragraph({ children: [
  new TextRun({ text: 'AI DevOps & Cloud: ', bold: true, size: 20, font: 'Calibri' }),
  new TextRun({ text: 'Azure OpenAI, Azure AI Foundry, GCP Vertex AI, Docker, CI/CD Pipelines, MLOps, Model Monitoring, Vercel Serverless', size: 20, font: 'Calibri' }),
], spacing: { after: 60 } }));

C.push(new Paragraph({ children: [
  new TextRun({ text: 'Additional: ', bold: true, size: 20, font: 'Calibri' }),
  new TextRun({ text: 'Healthcare AI (FHIR, HEDIS, ICD/LOINC/CPT), Chatbot Development, Voice AI, Multimodal AI, Knowledge Transfer, Documentation, Team Enablement', size: 20, font: 'Calibri' }),
], spacing: { after: 60 } }));

// ─── PROJECTS ───
C.push(sectionHead('Projects'));
C.push(new Paragraph({ children: [new TextRun({ text: 'Face Mask Detection', bold: true, size: 20, font: 'Calibri' })], spacing: { after: 40 } }));
C.push(bullet('Developed a lightweight face mask detection system using OpenCV and MobileNetV2, optimized for deployment on low-power devices.'));

// ─── ACHIEVEMENTS ───
C.push(sectionHead('Achievements'));
C.push(bullet('Outstanding appraisal at HCL with score more than 9 with outstanding feedback from manager.'));
C.push(bullet('MBA Entrance Exam Scores: CAT – 99.34 Percentile, XAT – 97.11 Percentile, GMAT FE – 98 Percentile (705 Score)'));
C.push(bullet('Probation period at R Systems was 3 months but received full-time offer within 2 months.'));

const doc = new Document({
  sections: [{
    properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
    children: C,
  }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync('D:\\new api integration\\the-time-traveller-main\\Rishabh_Raj_Resume_Updated.docx', buffer);
console.log('Resume generated!');
