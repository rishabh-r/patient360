# HEDIS Quality Measures — Implementation Guide
## Patient 360 Portal

---

## 1. What is HEDIS?

HEDIS (Healthcare Effectiveness Data and Information Set) is a standardized quality measurement tool developed by NCQA (National Committee for Quality Assurance). Used by over 90% of US health plans, HEDIS consists of 81 measures across 5 domains of care that allow "apples-to-apples" comparison of healthcare quality.

---

## 2. What We Implemented

We implemented **Option 2: Custom HEDIS Measure Logic** — calculating HEDIS scores directly in JavaScript using our existing FHIR R4 APIs, without requiring the full CQL (Clinical Quality Language) engine pipeline.

### Why Option 2 (Custom Logic) instead of Option 1 (Full CQL Engine)?

| Factor | Option 1 (CQL Engine) | Option 2 (Custom Logic) — Chosen |
|---|---|---|
| New dependencies | Java CQL-to-ELM translator, VSAC value sets, NCQA license | None — uses existing FHIR APIs |
| Tech stack fit | Adds Java to our JS/React stack | Pure JavaScript, same stack |
| Time to deliver | 4-6 weeks | 1-2 weeks |
| Clinical accuracy | Uses official CQL definitions | Same formulas coded directly (HEDIS specs are public) |
| Cost | NCQA license fee + infrastructure | Zero |
| Upgrade path | N/A | Can migrate to CQL engine later if CMS submission needed |

### Resources Evaluated

1. **cqframework/cql-execution** — Official JS CQL engine (reference implementation)
2. **cqframework/cql-exec-fhir** — FHIR data connector for CQL engine
3. **cqframework/hedis-ig** — FHIR HEDIS Implementation Guide with 12 sample measures
4. **google/cql** — Google's experimental Go CQL engine (not production-ready)
5. **popHealth** — ONC population health tool (abandoned since 2016)
6. **Tuva Health** — Commercial paid platform (not open-source)
7. **NCQA Digital Content** — Official HEDIS content (requires paid license)

---

## 3. Implementation Architecture

### File Structure
```
src/services/hedis.js     — HEDIS calculation engine (measures + scoring logic)
src/pages/CareManagerView.jsx  — HEDIS section in Care Manager Analytics
src/pages/HealthcareProviderView.jsx — HEDIS section in Provider Analytics
src/styles/caremanager.css — HEDIS card styling (Care Manager)
src/styles/provider.css    — HEDIS card styling (Provider)
```

### Data Flow
```
1. User opens Analytics tab
2. System gets list of patients (from org or practitioner)
3. For EACH patient, 5 parallel FHIR API calls:
   → GET /baseR4/Patient/find?id={pid}           (demographics, birthDate)
   → GET /baseR4/Condition?patient={pid}          (diagnoses — ICD codes)
   → GET /baseR4/Observation/search?patient={pid} (lab results — LOINC codes)
   → GET /baseR4/Observation/vitals/search?patient={pid} (vitals — BP, HR, etc.)
   → GET /baseR4/MedicationRequest?patient={pid}  (medications — status)
4. For each of 8 measures:
   → Check ELIGIBILITY (denominator): does this patient qualify?
   → Check MET (numerator): does this patient pass the measure?
5. Calculate rate = (met / eligible) × 100
6. Display results with gap analysis
```

---

## 4. HEDIS Measures — Formulas

### Measure 1: HbA1c Testing
- **Domain**: Diabetes Care
- **What it measures**: Were diabetic patients tested for HbA1c in the past year?
- **Eligible (Denominator)**: Patient has a Condition with ICD code starting with E11 (Type 2 Diabetes) OR condition display contains "diabetes"
- **Met (Numerator)**: Patient has an Observation with LOINC code 4548-4 (Hemoglobin A1c) or 17856-6 (HbA1c IFCC) dated within the past 365 days
- **Formula**: `Rate = (patients with HbA1c test / diabetic patients) × 100`
- **Target**: ≥ 80% (green)

### Measure 2: HbA1c Control (<7%)
- **Domain**: Diabetes Care
- **What it measures**: Is the diabetic patient's blood sugar well-controlled?
- **Eligible**: Same as Measure 1 (has diabetes)
- **Met**: Most recent HbA1c observation value < 7.0%
- **Formula**: `Rate = (diabetic patients with HbA1c < 7.0 / diabetic patients) × 100`
- **Target**: ≥ 80% (green)

### Measure 3: HbA1c Poor Control (>9%) — INVERTED
- **Domain**: Diabetes Care
- **What it measures**: How many diabetic patients have dangerously uncontrolled blood sugar?
- **Eligible**: Same as Measure 1 (has diabetes)
- **Met**: Most recent HbA1c observation value > 9.0%
- **Formula**: `Rate = (diabetic patients with HbA1c > 9.0 / diabetic patients) × 100`
- **Target**: ≤ 10% is good (this is an INVERTED measure — lower is better)
- **Note**: Progress bar shows in RED. A rate of 5% means only 5% of diabetic patients have poor control — that's good.

### Measure 4: Blood Pressure Control (<140/90)
- **Domain**: Blood Pressure
- **What it measures**: Is the hypertensive patient's BP under control?
- **Eligible**: Patient has a Condition with ICD code I10 (Essential Hypertension) OR display contains "hypertension" or "high blood pressure"
- **Met**: Latest systolic BP (LOINC 8480-6) < 140 mmHg AND latest diastolic BP (LOINC 8462-4) < 90 mmHg (from Vitals API)
- **Formula**: `Rate = (hypertensive patients with BP < 140/90 / hypertensive patients) × 100`
- **Target**: ≥ 80% (green)

### Measure 5: Kidney Screening (Nephropathy)
- **Domain**: Diabetes Care
- **What it measures**: Are diabetic patients getting kidney function tested?
- **Eligible**: Patient has diabetes (E11.x)
- **Met**: Patient has eGFR (LOINC 48642-3) OR ACR (LOINC 14959-1) OR estimated GFR (LOINC 33914-3) tested within the past year
- **Formula**: `Rate = (diabetic patients with kidney test / diabetic patients) × 100`
- **Target**: ≥ 80% (green)

### Measure 6: Medication Adherence
- **Domain**: Medication Management
- **What it measures**: Are patients taking their prescribed medications without stopping?
- **Eligible**: Patient has at least 1 MedicationRequest
- **Met**: NONE of the patient's medications have status = "stopped"
- **Formula**: `Rate = (patients with no stopped meds / patients with any meds) × 100`
- **Target**: ≥ 80% (green)

### Measure 7: Cholesterol Screening
- **Domain**: Preventive Care
- **What it measures**: Are adult patients getting cholesterol tested?
- **Eligible**: Patient age ≥ 18 (calculated from birthDate)
- **Met**: Patient has Total Cholesterol (2093-3), HDL (2085-9), LDL direct (2089-1), or LDL calculated (2090-9) tested within the past year
- **Formula**: `Rate = (adults with cholesterol test / adults) × 100`
- **Target**: ≥ 80% (green)

### Measure 8: LDL Control (<100 mg/dL)
- **Domain**: Cardiovascular
- **What it measures**: Is LDL cholesterol controlled in high-risk patients?
- **Eligible**: Patient has hypertension (I10) OR diabetes (E11) OR coronary artery disease (I25)
- **Met**: Most recent LDL (LOINC 2089-1 or 2090-9) value < 100 mg/dL
- **Formula**: `Rate = (high-risk patients with LDL < 100 / high-risk patients) × 100`
- **Target**: ≥ 80% (green)

---

### Measure 9: Breast Cancer Screening (BCS)
- **Domain**: Preventive Care
- **What it measures**: Did eligible women get a mammogram?
- **Eligible (Denominator)**: Patient gender = `female` AND age between 50–74 (inclusive), calculated from `Patient.birthDate`
- **Met (Numerator)**: Patient had a mammogram within the past **27 months** (per NCQA BCS specification). Checked via:
  1. `GET /baseR4/Procedure?patient={id}` — looks for CPT codes `77051–77067` (Breast mammography range from `procedure_code_master.csv` row 84) OR procedure display containing "mammog" or "mammogram"
  2. `GET /baseR4/DiagnosticReport?patient={id}` — looks for LOINC `24606-6` (mammography) OR report display containing "mammog", "mammogram", or "breast"
- **Formula**: `Rate = (women 50-74 with mammogram in 27 months / women 50-74) × 100`
- **Target**: ≥ 80% (green)
- **Why 27 months**: NCQA uses 27 months (not 24) to account for scheduling variability — a woman who had a mammogram in January 2024 and schedules her next in March 2026 is still compliant.
- **Where the CPT codes come from**: `procedure_code_master.csv` row 84: category "Radiology", section "70000-79999", subsection "77051-77059" labeled "Breast mammography". We extend to 77067 to include screening mammography (bilateral) per AMA CPT.
- **Note**: If no female patients aged 50-74 exist in the population, this measure won't appear (0 eligible).

## 5. UI — How It Appears in Analytics

### Location
- **Care Manager Dashboard** → Analytics tab → bottom section titled "HEDIS Quality Measures"
- **Healthcare Provider Dashboard** → Analytics tab → bottom section titled "HEDIS Quality Measures"

### Card Layout (2-column grid)
Each measure is displayed as a card containing:

```
┌─────────────────────────────────────┐
│ DIABETES CARE              87%      │  ← Domain (purple) + Rate (green/orange/red)
│ HbA1c Testing                       │  ← Measure name
│ Diabetic patients who had HbA1c...  │  ← Description
│ ████████████████████░░░             │  ← Progress bar (blue, or red for inverted)
│ 7 of 8 eligible patients            │  ← Counts
│ ▶ 1 gap                            │  ← Expandable: click to see patient names
│   • James Mitchell                  │
└─────────────────────────────────────┘
```

### Color Coding
| Rate | Color | Meaning |
|---|---|---|
| ≥ 80% | Green | Good performance |
| 60-79% | Orange | Fair — needs improvement |
| < 60% | Red | Poor — action needed |

For inverted measures (HbA1c Poor Control):
| Rate | Color | Meaning |
|---|---|---|
| ≤ 10% | Green | Good (few patients with poor control) |
| 11-25% | Orange | Fair |
| > 25% | Red | Poor (too many patients uncontrolled) |

### Gap Analysis
Clicking the "X gaps" expandable section reveals which specific patients did NOT meet the measure — enabling targeted outreach.

---

## 6. FHIR API Endpoints Used

| API | What it provides | HEDIS usage |
|---|---|---|
| `GET /baseR4/Patient/find?id={id}` | Demographics, birthDate | Age calculation for eligibility |
| `GET /baseR4/Condition?patient={id}` | Diagnoses (ICD codes) | Diabetes (E11), Hypertension (I10), CAD (I25) |
| `GET /baseR4/Observation/search?patient={id}` | Lab results (LOINC codes) | HbA1c, LDL, eGFR, Cholesterol |
| `GET /baseR4/Observation/vitals/search?patient={id}` | Vital signs | Systolic/Diastolic BP |
| `GET /baseR4/MedicationRequest?patient={id}` | Medications + status | Stopped vs active medications |
| `GET /baseR4/Procedure?patient={id}` | Procedures performed (CPT codes) | Mammogram screening (CPT 77051-77067) |
| `GET /baseR4/DiagnosticReport?patient={id}` | Diagnostic reports | Mammogram reports (LOINC 24606-6) |

---

## 7. Upgrade Path to Option 1 (CQL Engine)

If official CMS submission or NCQA certification is ever required:

1. Install `cql-execution` + `cql-exec-fhir` npm packages
2. Obtain NCQA Digital Content Services license
3. Set up VSAC value set downloads
4. Replace `hedis.js` calculation logic with CQL engine execution
5. **UI stays exactly the same** — only the backend calculation changes

---

*Document prepared: May 27, 2026*
*Project: Patient 360 Portal*
*Implementation: Option 2 — Custom HEDIS Measure Logic*
