import { callFhirApi, buildUrl } from './fhir';

/**
 * HEDIS Measures — Option 2 (Custom Logic)
 *
 * Each measure has:
 *   - id: unique key
 *   - name: display name
 *   - description: what it checks
 *   - domain: HEDIS domain
 *   - eligible(patient): does this patient qualify for the denominator?
 *   - met(patient): does this patient meet the numerator criteria?
 *
 * Formulas follow NCQA published specifications.
 */

const MEASUREMENT_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

function hasConditionCode(conditions, codePrefix) {
  return conditions.some(c => {
    const code = (c.code?.coding?.[0]?.code || '').toUpperCase();
    const display = (c.code?.coding?.[0]?.display || '').toLowerCase();
    if (typeof codePrefix === 'string') {
      const p = codePrefix.toUpperCase();
      if (code.startsWith(p)) return true;
      if (p === 'E11' && display.includes('diabetes')) return true;
      if (p === 'I10' && (display.includes('hypertension') || display.includes('high blood pressure'))) return true;
      if (p === 'J44' && (display.includes('copd') || display.includes('chronic obstructive'))) return true;
    }
    return false;
  });
}

function hasObsInPastYear(observations, loincCodes, now) {
  const cutoff = new Date(now.getTime() - MEASUREMENT_YEAR_MS);
  return observations.some(o => {
    const code = o.code?.coding?.[0]?.code || '';
    const date = new Date(o.effectiveDateTime || 0);
    return loincCodes.includes(code) && date >= cutoff;
  });
}

function getLatestObsValue(observations, loincCodes) {
  let latest = null;
  for (const o of observations) {
    const code = o.code?.coding?.[0]?.code || '';
    if (!loincCodes.includes(code)) continue;
    const date = new Date(o.effectiveDateTime || 0);
    const val = o.valueQuantity?.value;
    if (val == null) continue;
    if (!latest || date > latest.date) latest = { date, value: val };
  }
  return latest;
}

function getPatientAge(birthDate) {
  if (!birthDate) return 0;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / MEASUREMENT_YEAR_MS);
}

const HEDIS_MEASURES = [
  {
    id: 'cdc_hba1c_testing',
    name: 'HbA1c Testing',
    description: 'Diabetic patients who had HbA1c tested in the past year',
    domain: 'Diabetes Care',
    eligible: (pt) => hasConditionCode(pt.conditions, 'E11'),
    met: (pt) => hasObsInPastYear(pt.observations, ['4548-4', '17856-6'], pt.now),
  },
  {
    id: 'cdc_hba1c_control',
    name: 'HbA1c Control (<7%)',
    description: 'Diabetic patients with most recent HbA1c < 7.0%',
    domain: 'Diabetes Care',
    eligible: (pt) => hasConditionCode(pt.conditions, 'E11'),
    met: (pt) => {
      const latest = getLatestObsValue(pt.observations, ['4548-4']);
      return latest != null && latest.value < 7.0;
    },
  },
  {
    id: 'cdc_hba1c_poor',
    name: 'HbA1c Poor Control (>9%)',
    description: 'Diabetic patients with most recent HbA1c > 9.0% (lower is better)',
    domain: 'Diabetes Care',
    invertedMeasure: true,
    eligible: (pt) => hasConditionCode(pt.conditions, 'E11'),
    met: (pt) => {
      const latest = getLatestObsValue(pt.observations, ['4548-4']);
      return latest != null && latest.value > 9.0;
    },
  },
  {
    id: 'cbp_control',
    name: 'BP Control (<140/90)',
    description: 'Hypertensive patients with most recent BP < 140/90 mmHg',
    domain: 'Blood Pressure',
    eligible: (pt) => hasConditionCode(pt.conditions, 'I10'),
    met: (pt) => {
      const sys = getLatestObsValue(pt.vitals, ['8480-6']);
      const dia = getLatestObsValue(pt.vitals, ['8462-4']);
      if (!sys || !dia) return false;
      return sys.value < 140 && dia.value < 90;
    },
  },
  {
    id: 'cdc_kidney',
    name: 'Kidney Screening',
    description: 'Diabetic patients with eGFR or ACR tested in the past year',
    domain: 'Diabetes Care',
    eligible: (pt) => hasConditionCode(pt.conditions, 'E11'),
    met: (pt) => hasObsInPastYear(pt.observations, ['48642-3', '14959-1', '33914-3'], pt.now),
  },
  {
    id: 'med_adherence',
    name: 'Medication Adherence',
    description: 'Patients with all prescribed medications active (none stopped)',
    domain: 'Medication Management',
    eligible: (pt) => pt.medications.length > 0,
    met: (pt) => !pt.medications.some(m => m.status === 'stopped'),
  },
  {
    id: 'cholesterol_screening',
    name: 'Cholesterol Screening',
    description: 'Patients 18+ with cholesterol tested in the past year',
    domain: 'Preventive Care',
    eligible: (pt) => getPatientAge(pt.birthDate) >= 18,
    met: (pt) => hasObsInPastYear(pt.observations, ['2093-3', '2085-9', '2089-1', '2090-9'], pt.now),
  },
  {
    id: 'ldl_control',
    name: 'LDL Control (<100)',
    description: 'Patients with cardiovascular risk and LDL < 100 mg/dL',
    domain: 'Cardiovascular',
    eligible: (pt) => hasConditionCode(pt.conditions, 'I10') || hasConditionCode(pt.conditions, 'E11') || hasConditionCode(pt.conditions, 'I25'),
    met: (pt) => {
      const latest = getLatestObsValue(pt.observations, ['2089-1', '2090-9']);
      return latest != null && latest.value < 100;
    },
  },
  {
    id: 'bcs_screening',
    name: 'Breast Cancer Screening',
    description: 'Women 50–74 who had a mammogram in the past 27 months',
    domain: 'Preventive Care',
    eligible: (pt) => pt.gender === 'female' && (() => { const age = getPatientAge(pt.birthDate); return age >= 50 && age <= 74; })(),
    met: (pt) => {
      const cutoff = new Date(pt.now.getTime() - 27 * 30.44 * 24 * 60 * 60 * 1000);
      return (pt.procedures || []).some(p => {
        const code = p.code?.coding?.[0]?.code || '';
        const display = (p.code?.coding?.[0]?.display || '').toLowerCase();
        const date = new Date(p.performedDateTime || p.performedPeriod?.start || 0);
        const isMammo = (parseInt(code) >= 77051 && parseInt(code) <= 77067) || display.includes('mammog') || display.includes('mammogram');
        return isMammo && date >= cutoff;
      }) || (pt.diagnosticReports || []).some(r => {
        const code = r.code?.coding?.[0]?.code || '';
        const display = (r.code?.coding?.[0]?.display || r.code?.text || '').toLowerCase();
        const date = new Date(r.effectiveDateTime || r.issued || 0);
        const isMammo = code === '24606-6' || display.includes('mammog') || display.includes('mammogram') || display.includes('breast');
        return isMammo && date >= cutoff;
      });
    },
  },
];

/**
 * Calculate HEDIS scores for a list of patients.
 * @param {Array} patientIds - array of patient IDs
 * @param {Function} callFhirApiFn - the callFhirApi function
 * @param {Function} buildUrlFn - the buildUrl function
 * @param {string} fhirBase - FHIR base URL
 * @returns {Promise<{measures: Array, patientResults: Object}>}
 */
export async function calculateHedisScores(patientIds, callFhirApiFn, buildUrlFn, fhirBase, onProgress) {
  const now = new Date();
  const patientData = [];

  for (let idx = 0; idx < patientIds.length; idx++) {
    const pid = patientIds[idx];
    try {
      const [ptRes, condRes, obsRes, vitalsRes, medRes, procRes, drRes] = await Promise.all([
        callFhirApiFn(buildUrlFn('/baseR4/Patient/find', { id: pid })).catch(() => null),
        callFhirApiFn(buildUrlFn('/baseR4/Condition', { patient: pid, page: 0, size: 100 })).catch(() => null),
        callFhirApiFn(buildUrlFn('/baseR4/Observation/search', { patient: pid, page: 0, size: 200 })).catch(() => null),
        callFhirApiFn(`${fhirBase}/baseR4/Observation/vitals/search?patient=${pid}`).catch(() => null),
        callFhirApiFn(buildUrlFn('/baseR4/MedicationRequest', { patient: pid, page: 0, size: 200 })).catch(() => null),
        callFhirApiFn(buildUrlFn('/baseR4/Procedure', { patient: pid, page: 0, size: 100 })).catch(() => null),
        callFhirApiFn(buildUrlFn('/baseR4/DiagnosticReport', { patient: pid, page: 0, size: 100 })).catch(() => null),
      ]);

      const pt = ptRes?.entry?.[0]?.resource || ptRes || {};
      const given = pt.name?.[0]?.given?.join(' ') || '';
      const family = pt.name?.[0]?.family || '';

      const conditions = (condRes?.entry || []).map(e => e.resource).filter(Boolean);
      const observations = (obsRes?.entry || []).map(e => e.resource).filter(Boolean);
      const vitals = (vitalsRes?.entry || []).map(e => e.resource).filter(Boolean);
      const medications = (medRes?.entry || []).map(e => e.resource).filter(Boolean);

      if (idx < 3) {
        console.log(`[HEDIS] Patient ${pid}:`, {
          name: `${given} ${family}`.trim(),
          birthDate: pt.birthDate,
          gender: pt.gender,
          conditionCount: conditions.length,
          conditionCodes: conditions.slice(0, 5).map(c => ({ code: c.code?.coding?.[0]?.code, display: c.code?.coding?.[0]?.display })),
          obsCount: observations.length,
          vitalsCount: vitals.length,
          medCount: medications.length,
        });
      }

      patientData.push({
        id: pid,
        name: `${given} ${family}`.trim(),
        birthDate: pt.birthDate || '',
        gender: pt.gender || '',
        conditions,
        observations,
        vitals,
        medications,
        procedures: (procRes?.entry || []).map(e => e.resource).filter(Boolean),
        diagnosticReports: (drRes?.entry || []).map(e => e.resource).filter(Boolean),
        now,
      });
    } catch (err) { console.error(`[HEDIS] Error for patient ${pid}:`, err); }
    if (onProgress) onProgress(idx + 1, patientIds.length);
  }

  const measures = HEDIS_MEASURES.map(m => {
    const eligible = patientData.filter(pt => m.eligible(pt));
    const met = eligible.filter(pt => m.met(pt));
    const rate = eligible.length > 0 ? Math.round((met.length / eligible.length) * 100) : null;
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      domain: m.domain,
      invertedMeasure: m.invertedMeasure || false,
      eligible: eligible.length,
      met: met.length,
      rate,
      metPatients: met.map(p => p.name),
      gapPatients: eligible.filter(pt => !m.met(pt)).map(p => p.name),
    };
  }).filter(m => m.eligible > 0);

  return { measures, totalPatients: patientData.length };
}

export { HEDIS_MEASURES };
