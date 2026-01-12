# Compliance Audit Preparation Checklist

**Comprehensive Guide for Audit Readiness**

Version 1.0 | 2026-01-08

---

## Purpose

This checklist provides a structured approach to preparing for compliance audits including SOC 2 Type II, ISO 27001, NIST 800-53, GDPR, and EU AI Act assessments. Use it to ensure all evidence is gathered, controls are operating effectively, and teams are prepared for auditor inquiries.

---

## Table of Contents

1. [Audit Calendar](#1-audit-calendar)
2. [Pre-Audit Timeline](#2-pre-audit-timeline)
3. [SOC 2 Type II Checklist](#3-soc-2-type-ii-checklist)
4. [ISO 27001 Checklist](#4-iso-27001-checklist)
5. [NIST 800-53 Checklist](#5-nist-800-53-checklist)
6. [GDPR Checklist](#6-gdpr-checklist)
7. [EU AI Act Checklist](#7-eu-ai-act-checklist)
8. [Evidence Collection Guide](#8-evidence-collection-guide)
9. [Control Owner Responsibilities](#9-control-owner-responsibilities)
10. [Interview Preparation](#10-interview-preparation)
11. [Common Findings & Remediation](#11-common-findings--remediation)
12. [Audit Day Logistics](#12-audit-day-logistics)
13. [Post-Audit Activities](#13-post-audit-activities)

---

## 1. Audit Calendar

### Annual Audit Schedule

| Audit | Type | Timing | Duration | Lead |
|-------|------|--------|----------|------|
| SOC 2 Type II | External | Q1 (Jan-Mar) | 4-6 weeks | Compliance |
| ISO 27001 Surveillance | External | Q2 (Apr-Jun) | 1 week | Compliance |
| ISO 27001 Recertification | External | Every 3 years | 2 weeks | Compliance |
| NIST 800-53 Assessment | Internal/External | Q3 (Jul-Sep) | 2-3 weeks | Security |
| GDPR Review | Internal | Q4 (Oct-Dec) | 2 weeks | Privacy |
| EU AI Act Assessment | External | Q4 (Oct-Dec) | 2 weeks | Compliance |
| Internal Audit | Internal | Quarterly | 1 week each | Internal Audit |
| Penetration Test | External | Annual + continuous | 2-4 weeks | Security |

### Key Dates Template

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUDIT TIMELINE 2026                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Q1: SOC 2 Type II                                              │
│  ├── Dec 15: Evidence collection starts                         │
│  ├── Jan 15: Evidence collection complete                       │
│  ├── Jan 20: Auditor fieldwork begins                          │
│  ├── Feb 28: Fieldwork complete                                │
│  ├── Mar 15: Draft report received                             │
│  └── Mar 31: Final report issued                               │
│                                                                 │
│  Q2: ISO 27001 Surveillance                                     │
│  ├── Apr 1: Pre-audit self-assessment                          │
│  ├── Apr 15: Document review submitted                         │
│  ├── May 1-5: On-site audit                                    │
│  └── May 31: Certificate maintained                            │
│                                                                 │
│  Q3: NIST Assessment                                            │
│  ├── Jul 1: Control mapping review                             │
│  ├── Jul 15: Evidence collection                               │
│  ├── Aug 1-15: Assessment                                      │
│  └── Sep 1: Report and remediation plan                        │
│                                                                 │
│  Q4: GDPR/EU AI Act                                             │
│  ├── Oct 1: Privacy impact assessment review                   │
│  ├── Oct 15: AI system documentation review                    │
│  ├── Nov 1-15: Assessment activities                           │
│  └── Dec 15: Reports finalized                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Pre-Audit Timeline

### 12 Weeks Before Audit

| Week | Activities | Owner | Status |
|------|------------|-------|--------|
| **Week 12** | Confirm audit dates with auditor | Compliance | ☐ |
| | Identify control owners | Compliance | ☐ |
| | Review prior audit findings | Compliance | ☐ |
| | Verify remediation of prior findings | Control Owners | ☐ |
| **Week 11** | Distribute evidence request list | Compliance | ☐ |
| | Schedule control owner meetings | Compliance | ☐ |
| | Review and update policies | Policy Owners | ☐ |
| **Week 10** | Begin evidence collection | Control Owners | ☐ |
| | Update system documentation | Engineering | ☐ |
| | Review access control lists | Security | ☐ |
| **Week 9** | Continue evidence collection | Control Owners | ☐ |
| | Conduct control self-assessments | Control Owners | ☐ |
| | Identify gaps and remediate | Control Owners | ☐ |
| **Week 8** | Mid-point evidence review | Compliance | ☐ |
| | Address collection gaps | Control Owners | ☐ |
| | Update evidence repository | Compliance | ☐ |

### 8-4 Weeks Before Audit

| Week | Activities | Owner | Status |
|------|------------|-------|--------|
| **Week 7** | Complete evidence collection | Control Owners | ☐ |
| | Quality review of evidence | Compliance | ☐ |
| | Remediate any control gaps | Control Owners | ☐ |
| **Week 6** | Finalize evidence packages | Compliance | ☐ |
| | Prepare interview participants | Compliance | ☐ |
| | Conduct mock interviews | Compliance | ☐ |
| **Week 5** | Submit evidence to auditor | Compliance | ☐ |
| | Address auditor questions | Control Owners | ☐ |
| | Confirm logistics | Compliance | ☐ |
| **Week 4** | Final preparation meetings | All | ☐ |
| | Executive briefing | Compliance | ☐ |
| | Confirm interview schedule | Compliance | ☐ |

### Final 4 Weeks

| Week | Activities | Owner | Status |
|------|------------|-------|--------|
| **Week 3** | Address any pre-audit questions | Control Owners | ☐ |
| | Prepare conference rooms | Facilities | ☐ |
| | Test remote access (if needed) | IT | ☐ |
| **Week 2** | Final team briefing | Compliance | ☐ |
| | Distribute interview schedule | Compliance | ☐ |
| | Prepare executive summary | Compliance | ☐ |
| **Week 1** | Last-minute evidence requests | Control Owners | ☐ |
| | Confirm all logistics | Compliance | ☐ |
| | Day-before readiness check | Compliance | ☐ |
| **Audit Week** | Support auditors | All | ☐ |
| | Daily status meetings | Compliance | ☐ |
| | Address findings in real-time | Control Owners | ☐ |

---

## 3. SOC 2 Type II Checklist

### Trust Service Criteria Coverage

#### CC1: Control Environment

| Control | Evidence Required | Owner | Status |
|---------|-------------------|-------|--------|
| CC1.1 | Board/management oversight documentation | Exec | ☐ |
| CC1.2 | Organizational structure chart | HR | ☐ |
| CC1.3 | Authority and responsibility definitions | HR | ☐ |
| CC1.4 | Security awareness training records | HR/Security | ☐ |
| CC1.5 | Performance evaluation criteria | HR | ☐ |

**Evidence Checklist:**
- [ ] Board meeting minutes mentioning security
- [ ] Organizational chart
- [ ] Job descriptions with security responsibilities
- [ ] Training completion records (all employees)
- [ ] Security policy acknowledgment records
- [ ] Performance reviews including security metrics

#### CC2: Communication and Information

| Control | Evidence Required | Owner | Status |
|---------|-------------------|-------|--------|
| CC2.1 | Internal communication policies | Compliance | ☐ |
| CC2.2 | Security policies and procedures | Security | ☐ |
| CC2.3 | External communication procedures | Compliance | ☐ |

**Evidence Checklist:**
- [ ] Information security policy
- [ ] Policy distribution records
- [ ] Employee handbook
- [ ] External communication templates
- [ ] Customer notification procedures
- [ ] Incident communication records

#### CC3: Risk Assessment

| Control | Evidence Required | Owner | Status |
|---------|-------------------|-------|--------|
| CC3.1 | Risk assessment methodology | Security | ☐ |
| CC3.2 | Risk register | Security | ☐ |
| CC3.3 | Fraud risk assessment | Compliance | ☐ |
| CC3.4 | Change risk assessment | Engineering | ☐ |

**Evidence Checklist:**
- [ ] Annual risk assessment report
- [ ] Risk register with ratings
- [ ] Risk treatment plans
- [ ] Fraud risk assessment
- [ ] Vendor risk assessments
- [ ] Change management risk reviews

#### CC4: Monitoring Activities

| Control | Evidence Required | Owner | Status |
|---------|-------------------|-------|--------|
| CC4.1 | Monitoring procedures | Security | ☐ |
| CC4.2 | Internal audit reports | Internal Audit | ☐ |

**Evidence Checklist:**
- [ ] Security monitoring dashboards
- [ ] SIEM alert configurations
- [ ] Internal audit reports
- [ ] Management review meeting minutes
- [ ] KPI/metric reports
- [ ] Exception reports and resolutions

#### CC5: Control Activities

| Control | Evidence Required | Owner | Status |
|---------|-------------------|-------|--------|
| CC5.1 | Control activity documentation | Compliance | ☐ |
| CC5.2 | Technology general controls | IT | ☐ |
| CC5.3 | Control deployment evidence | Control Owners | ☐ |

**Evidence Checklist:**
- [ ] Control matrix
- [ ] Control testing results
- [ ] Technology control configurations
- [ ] Segregation of duties matrix
- [ ] Control exception documentation

#### CC6: Logical and Physical Access Controls

| Control | Evidence Required | Owner | Status |
|---------|-------------------|-------|--------|
| CC6.1 | Access control policy | Security | ☐ |
| CC6.2 | User provisioning records | IT | ☐ |
| CC6.3 | Access review records | Security | ☐ |
| CC6.4 | Physical access controls | Facilities | ☐ |
| CC6.5 | Data disposal procedures | IT | ☐ |
| CC6.6 | Encryption implementation | Security | ☐ |
| CC6.7 | Data transmission security | Security | ☐ |
| CC6.8 | Malware prevention | Security | ☐ |

**Evidence Checklist:**
- [ ] Access control policy
- [ ] User access provisioning tickets
- [ ] Quarterly access reviews
- [ ] Terminated user access removal evidence
- [ ] Physical access logs
- [ ] Visitor logs
- [ ] Data center security certifications
- [ ] Encryption configurations
- [ ] TLS certificates
- [ ] Antivirus/EDR deployment evidence

#### CC7: System Operations

| Control | Evidence Required | Owner | Status |
|---------|-------------------|-------|--------|
| CC7.1 | Security event detection | Security | ☐ |
| CC7.2 | Security incident response | Security | ☐ |
| CC7.3 | Recovery procedures | IT | ☐ |
| CC7.4 | Backup procedures | IT | ☐ |
| CC7.5 | Recovery testing | IT | ☐ |

**Evidence Checklist:**
- [ ] SIEM configuration and alerts
- [ ] Security incident tickets
- [ ] Incident response playbooks
- [ ] Incident post-mortems
- [ ] Backup configurations
- [ ] Backup monitoring reports
- [ ] Disaster recovery plan
- [ ] DR test results

#### CC8: Change Management

| Control | Evidence Required | Owner | Status |
|---------|-------------------|-------|--------|
| CC8.1 | Change management policy | Engineering | ☐ |

**Evidence Checklist:**
- [ ] Change management policy
- [ ] Sample change tickets (10-15)
- [ ] Change approval evidence
- [ ] Emergency change procedures
- [ ] Change calendar/CAB minutes

#### CC9: Risk Mitigation

| Control | Evidence Required | Owner | Status |
|---------|-------------------|-------|--------|
| CC9.1 | Vendor management program | Compliance | ☐ |
| CC9.2 | Business continuity plan | Operations | ☐ |

**Evidence Checklist:**
- [ ] Vendor management policy
- [ ] Critical vendor list
- [ ] Vendor assessments
- [ ] Business continuity plan
- [ ] BCP testing results

### SOC 2 Evidence Summary Table

| Category | Items Needed | Collected | Reviewed |
|----------|--------------|-----------|----------|
| Policies | 15-20 | ☐ | ☐ |
| Access Reviews | 4 quarters | ☐ | ☐ |
| Change Tickets | 15-20 samples | ☐ | ☐ |
| Incident Tickets | All security incidents | ☐ | ☐ |
| Training Records | All employees | ☐ | ☐ |
| Risk Assessments | Annual + vendors | ☐ | ☐ |
| Backup Evidence | 12 months | ☐ | ☐ |
| Monitoring Reports | 12 months | ☐ | ☐ |

---

## 4. ISO 27001 Checklist

### ISMS Documentation

| Document | Required | Status | Last Updated |
|----------|----------|--------|--------------|
| Information Security Policy | Yes | ☐ | |
| ISMS Scope Statement | Yes | ☐ | |
| Risk Assessment Methodology | Yes | ☐ | |
| Risk Assessment Report | Yes | ☐ | |
| Risk Treatment Plan | Yes | ☐ | |
| Statement of Applicability | Yes | ☐ | |
| Security Objectives | Yes | ☐ | |
| Roles and Responsibilities | Yes | ☐ | |
| Competence Evidence | Yes | ☐ | |
| Communication Plan | Yes | ☐ | |
| Document Control Procedure | Yes | ☐ | |
| Operational Planning | Yes | ☐ | |
| Internal Audit Procedure | Yes | ☐ | |
| Management Review Minutes | Yes | ☐ | |
| Nonconformity Records | Yes | ☐ | |
| Continual Improvement Records | Yes | ☐ | |

### Annex A Controls Checklist

#### A.5 Information Security Policies

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.5.1.1 | Policies for information security | CISO | ☐ |
| A.5.1.2 | Review of policies | CISO | ☐ |

#### A.6 Organization of Information Security

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.6.1.1 | Security roles and responsibilities | HR | ☐ |
| A.6.1.2 | Segregation of duties | Security | ☐ |
| A.6.1.3 | Contact with authorities | Legal | ☐ |
| A.6.1.4 | Contact with special interest groups | Security | ☐ |
| A.6.1.5 | Security in project management | PMO | ☐ |
| A.6.2.1 | Mobile device policy | IT | ☐ |
| A.6.2.2 | Teleworking policy | IT/HR | ☐ |

#### A.7 Human Resource Security

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.7.1.1 | Screening | HR | ☐ |
| A.7.1.2 | Terms of employment | HR | ☐ |
| A.7.2.1 | Management responsibilities | HR | ☐ |
| A.7.2.2 | Security awareness training | Security | ☐ |
| A.7.2.3 | Disciplinary process | HR | ☐ |
| A.7.3.1 | Termination responsibilities | HR | ☐ |

#### A.8 Asset Management

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.8.1.1 | Inventory of assets | IT | ☐ |
| A.8.1.2 | Ownership of assets | IT | ☐ |
| A.8.1.3 | Acceptable use | IT | ☐ |
| A.8.1.4 | Return of assets | HR/IT | ☐ |
| A.8.2.1 | Classification of information | Security | ☐ |
| A.8.2.2 | Labeling of information | Security | ☐ |
| A.8.2.3 | Handling of assets | Security | ☐ |
| A.8.3.1 | Management of removable media | IT | ☐ |
| A.8.3.2 | Disposal of media | IT | ☐ |
| A.8.3.3 | Physical media transfer | IT | ☐ |

#### A.9 Access Control

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.9.1.1 | Access control policy | Security | ☐ |
| A.9.1.2 | Access to networks | Security | ☐ |
| A.9.2.1 | User registration | IT | ☐ |
| A.9.2.2 | User access provisioning | IT | ☐ |
| A.9.2.3 | Privileged access | Security | ☐ |
| A.9.2.4 | Secret authentication info | Security | ☐ |
| A.9.2.5 | Review of access rights | Security | ☐ |
| A.9.2.6 | Removal of access rights | IT | ☐ |
| A.9.3.1 | Use of secret authentication | Users | ☐ |
| A.9.4.1 | Information access restriction | Security | ☐ |
| A.9.4.2 | Secure log-on procedures | IT | ☐ |
| A.9.4.3 | Password management | IT | ☐ |
| A.9.4.4 | Use of privileged utilities | IT | ☐ |
| A.9.4.5 | Access control to source code | Engineering | ☐ |

#### A.10 Cryptography

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.10.1.1 | Policy on cryptographic controls | Security | ☐ |
| A.10.1.2 | Key management | Security | ☐ |

#### A.11 Physical and Environmental Security

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.11.1.1 | Physical security perimeter | Facilities | ☐ |
| A.11.1.2 | Physical entry controls | Facilities | ☐ |
| A.11.1.3 | Securing offices | Facilities | ☐ |
| A.11.1.4 | External threats protection | Facilities | ☐ |
| A.11.1.5 | Working in secure areas | Facilities | ☐ |
| A.11.1.6 | Delivery and loading areas | Facilities | ☐ |
| A.11.2.1 | Equipment siting | IT | ☐ |
| A.11.2.2 | Supporting utilities | Facilities | ☐ |
| A.11.2.3 | Cabling security | Facilities | ☐ |
| A.11.2.4 | Equipment maintenance | IT | ☐ |
| A.11.2.5 | Removal of assets | IT | ☐ |
| A.11.2.6 | Off-premises security | IT | ☐ |
| A.11.2.7 | Secure disposal | IT | ☐ |
| A.11.2.8 | Unattended user equipment | Users | ☐ |
| A.11.2.9 | Clear desk/screen | Users | ☐ |

#### A.12 Operations Security

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.12.1.1 | Documented procedures | IT | ☐ |
| A.12.1.2 | Change management | Engineering | ☐ |
| A.12.1.3 | Capacity management | IT | ☐ |
| A.12.1.4 | Separation of environments | Engineering | ☐ |
| A.12.2.1 | Malware controls | Security | ☐ |
| A.12.3.1 | Information backup | IT | ☐ |
| A.12.4.1 | Event logging | Security | ☐ |
| A.12.4.2 | Protection of log information | Security | ☐ |
| A.12.4.3 | Admin and operator logs | Security | ☐ |
| A.12.4.4 | Clock synchronization | IT | ☐ |
| A.12.5.1 | Software installation | IT | ☐ |
| A.12.6.1 | Vulnerability management | Security | ☐ |
| A.12.6.2 | Software installation restrictions | IT | ☐ |
| A.12.7.1 | Audit controls | Internal Audit | ☐ |

#### A.13 Communications Security

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.13.1.1 | Network controls | Security | ☐ |
| A.13.1.2 | Security of network services | Security | ☐ |
| A.13.1.3 | Segregation in networks | Security | ☐ |
| A.13.2.1 | Information transfer policies | Security | ☐ |
| A.13.2.2 | Agreements on transfer | Legal | ☐ |
| A.13.2.3 | Electronic messaging | IT | ☐ |
| A.13.2.4 | Confidentiality agreements | Legal | ☐ |

#### A.14 System Development

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.14.1.1 | Security requirements | Engineering | ☐ |
| A.14.1.2 | Securing application services | Engineering | ☐ |
| A.14.1.3 | Protecting transactions | Engineering | ☐ |
| A.14.2.1 | Secure development policy | Engineering | ☐ |
| A.14.2.2 | Change control procedures | Engineering | ☐ |
| A.14.2.3 | Technical review after changes | Engineering | ☐ |
| A.14.2.4 | Restrictions on changes | Engineering | ☐ |
| A.14.2.5 | Secure development principles | Engineering | ☐ |
| A.14.2.6 | Secure development environment | Engineering | ☐ |
| A.14.2.7 | Outsourced development | Engineering | ☐ |
| A.14.2.8 | System security testing | Security | ☐ |
| A.14.2.9 | System acceptance testing | QA | ☐ |
| A.14.3.1 | Protection of test data | Engineering | ☐ |

#### A.15 Supplier Relationships

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.15.1.1 | Supplier security policy | Compliance | ☐ |
| A.15.1.2 | Security in agreements | Legal | ☐ |
| A.15.1.3 | ICT supply chain | Compliance | ☐ |
| A.15.2.1 | Supplier service monitoring | Compliance | ☐ |
| A.15.2.2 | Supplier service changes | Compliance | ☐ |

#### A.16 Incident Management

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.16.1.1 | Responsibilities and procedures | Security | ☐ |
| A.16.1.2 | Reporting security events | Security | ☐ |
| A.16.1.3 | Reporting weaknesses | Security | ☐ |
| A.16.1.4 | Assessment of events | Security | ☐ |
| A.16.1.5 | Response to incidents | Security | ☐ |
| A.16.1.6 | Learning from incidents | Security | ☐ |
| A.16.1.7 | Collection of evidence | Security | ☐ |

#### A.17 Business Continuity

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.17.1.1 | Planning continuity | Operations | ☐ |
| A.17.1.2 | Implementing continuity | Operations | ☐ |
| A.17.1.3 | Verify and review | Operations | ☐ |
| A.17.2.1 | Availability of facilities | IT | ☐ |

#### A.18 Compliance

| Control | Evidence | Owner | Status |
|---------|----------|-------|--------|
| A.18.1.1 | Applicable legislation | Legal | ☐ |
| A.18.1.2 | Intellectual property | Legal | ☐ |
| A.18.1.3 | Protection of records | Compliance | ☐ |
| A.18.1.4 | Privacy and PII | Privacy | ☐ |
| A.18.1.5 | Regulation of cryptography | Legal | ☐ |
| A.18.2.1 | Independent review | Internal Audit | ☐ |
| A.18.2.2 | Compliance with policies | Compliance | ☐ |
| A.18.2.3 | Technical compliance | Security | ☐ |

---

## 5. NIST 800-53 Checklist

### Control Family Summary

| Family | ID | Controls | Priority | Status |
|--------|-----|----------|----------|--------|
| Access Control | AC | 25 | High | ☐ |
| Awareness & Training | AT | 6 | Medium | ☐ |
| Audit & Accountability | AU | 16 | High | ☐ |
| Assessment & Authorization | CA | 9 | Medium | ☐ |
| Configuration Management | CM | 14 | High | ☐ |
| Contingency Planning | CP | 13 | High | ☐ |
| Identification & Authentication | IA | 12 | High | ☐ |
| Incident Response | IR | 10 | High | ☐ |
| Maintenance | MA | 6 | Medium | ☐ |
| Media Protection | MP | 8 | Medium | ☐ |
| Physical & Environmental | PE | 20 | Medium | ☐ |
| Planning | PL | 9 | Low | ☐ |
| Program Management | PM | 16 | Medium | ☐ |
| Personnel Security | PS | 9 | Medium | ☐ |
| Risk Assessment | RA | 7 | High | ☐ |
| System & Services Acquisition | SA | 23 | High | ☐ |
| System & Communications | SC | 44 | High | ☐ |
| System & Information Integrity | SI | 20 | High | ☐ |

### High-Priority Controls Checklist

#### Access Control (AC)

| Control | Description | Evidence | Status |
|---------|-------------|----------|--------|
| AC-1 | Policy and procedures | Access control policy | ☐ |
| AC-2 | Account management | User provisioning records | ☐ |
| AC-3 | Access enforcement | RBAC configuration | ☐ |
| AC-5 | Separation of duties | Duty matrix | ☐ |
| AC-6 | Least privilege | Access review evidence | ☐ |
| AC-7 | Unsuccessful logon attempts | Lockout configuration | ☐ |
| AC-11 | Session lock | Timeout settings | ☐ |
| AC-17 | Remote access | VPN configuration | ☐ |
| AC-18 | Wireless access | WiFi security config | ☐ |
| AC-19 | Mobile devices | MDM policy | ☐ |

#### Audit & Accountability (AU)

| Control | Description | Evidence | Status |
|---------|-------------|----------|--------|
| AU-1 | Policy and procedures | Audit policy | ☐ |
| AU-2 | Audit events | Event list | ☐ |
| AU-3 | Content of audit records | Log samples | ☐ |
| AU-4 | Audit storage capacity | Retention config | ☐ |
| AU-5 | Response to failures | Alert configuration | ☐ |
| AU-6 | Audit review | Review procedures | ☐ |
| AU-9 | Protection of audit info | Access controls | ☐ |
| AU-11 | Audit record retention | Retention evidence | ☐ |
| AU-12 | Audit generation | Logging config | ☐ |

#### System & Communications Protection (SC)

| Control | Description | Evidence | Status |
|---------|-------------|----------|--------|
| SC-1 | Policy and procedures | SC policy | ☐ |
| SC-7 | Boundary protection | Firewall rules | ☐ |
| SC-8 | Transmission confidentiality | TLS config | ☐ |
| SC-12 | Cryptographic key management | Key procedures | ☐ |
| SC-13 | Cryptographic protection | Encryption config | ☐ |
| SC-23 | Session authenticity | Session management | ☐ |
| SC-28 | Protection at rest | Encryption evidence | ☐ |

---

## 6. GDPR Checklist

### Article-by-Article Compliance

#### Chapter II: Principles (Art. 5-11)

| Article | Requirement | Evidence | Status |
|---------|-------------|----------|--------|
| Art. 5 | Processing principles | Privacy policy, data inventory | ☐ |
| Art. 6 | Lawful basis | Legal basis documentation | ☐ |
| Art. 7 | Consent conditions | Consent records, mechanisms | ☐ |
| Art. 9 | Special categories | Special data procedures | ☐ |

**Evidence Checklist:**
- [ ] Data processing inventory
- [ ] Lawful basis register
- [ ] Consent management system evidence
- [ ] Consent withdrawal records
- [ ] Purpose limitation documentation

#### Chapter III: Data Subject Rights (Art. 12-23)

| Article | Requirement | Evidence | Status |
|---------|-------------|----------|--------|
| Art. 12 | Transparent communication | Privacy notices | ☐ |
| Art. 13-14 | Information provision | Privacy policy | ☐ |
| Art. 15 | Right of access | DSR procedures | ☐ |
| Art. 16 | Right to rectification | DSR procedures | ☐ |
| Art. 17 | Right to erasure | Deletion procedures | ☐ |
| Art. 18 | Right to restriction | Restriction procedures | ☐ |
| Art. 20 | Data portability | Export capability | ☐ |
| Art. 21 | Right to object | Objection procedures | ☐ |
| Art. 22 | Automated decisions | AI decision documentation | ☐ |

**Evidence Checklist:**
- [ ] Privacy notice (all collection points)
- [ ] DSR request form
- [ ] DSR fulfillment records
- [ ] Response time tracking (30 days SLA)
- [ ] Data export functionality documentation
- [ ] Automated decision-making documentation

#### Chapter IV: Controller/Processor (Art. 24-43)

| Article | Requirement | Evidence | Status |
|---------|-------------|----------|--------|
| Art. 25 | Privacy by design | Design documentation | ☐ |
| Art. 28 | Processor agreements | DPAs with vendors | ☐ |
| Art. 30 | Records of processing | ROPA | ☐ |
| Art. 32 | Security measures | Security documentation | ☐ |
| Art. 33 | Breach notification | Breach procedures | ☐ |
| Art. 35 | Impact assessment | DPIAs | ☐ |
| Art. 37-39 | Data Protection Officer | DPO appointment | ☐ |

**Evidence Checklist:**
- [ ] Records of Processing Activities (ROPA)
- [ ] Data Processing Agreements (all processors)
- [ ] Sub-processor list and notifications
- [ ] Data Protection Impact Assessments
- [ ] Breach notification procedure
- [ ] Breach register
- [ ] DPO appointment letter
- [ ] DPO contact published

#### Chapter V: International Transfers (Art. 44-49)

| Article | Requirement | Evidence | Status |
|---------|-------------|----------|--------|
| Art. 44-45 | Transfer principles | Transfer documentation | ☐ |
| Art. 46 | Appropriate safeguards | SCCs, BCRs | ☐ |
| Art. 49 | Derogations | Derogation records | ☐ |

**Evidence Checklist:**
- [ ] Data transfer mapping
- [ ] Standard Contractual Clauses (signed)
- [ ] Transfer Impact Assessments
- [ ] Supplementary measures documentation

---

## 7. EU AI Act Checklist

### High-Risk AI System Requirements

| Requirement | Article | Evidence | Status |
|-------------|---------|----------|--------|
| Risk management system | Art. 9 | Risk management documentation | ☐ |
| Data governance | Art. 10 | Data quality procedures | ☐ |
| Technical documentation | Art. 11 | System documentation | ☐ |
| Record-keeping | Art. 12 | Logging implementation | ☐ |
| Transparency | Art. 13 | User information | ☐ |
| Human oversight | Art. 14 | Override mechanisms | ☐ |
| Accuracy & robustness | Art. 15 | Testing evidence | ☐ |

### Conformity Assessment Checklist

| Item | Description | Status |
|------|-------------|--------|
| System classification | Determine risk category | ☐ |
| Risk management | Establish continuous process | ☐ |
| Data requirements | Document training data quality | ☐ |
| Technical documentation | Complete per Annex IV | ☐ |
| Logging capability | Implement automatic logging | ☐ |
| User instructions | Prepare clear instructions | ☐ |
| Human oversight | Design oversight mechanisms | ☐ |
| Accuracy testing | Document performance metrics | ☐ |
| Robustness testing | Security and resilience testing | ☐ |
| Quality management | Establish QMS | ☐ |
| Conformity marking | Prepare CE marking | ☐ |
| Registration | Register in EU database | ☐ |

### Technical Documentation Requirements (Annex IV)

| Section | Content | Status |
|---------|---------|--------|
| 1 | General description | ☐ |
| 2 | Detailed system description | ☐ |
| 3 | Monitoring and control | ☐ |
| 4 | Risk management | ☐ |
| 5 | Changes during lifecycle | ☐ |
| 6 | Performance standards | ☐ |
| 7 | Data requirements | ☐ |
| 8 | Training data | ☐ |
| 9 | Human oversight | ☐ |
| 10 | Validation and testing | ☐ |

---

## 8. Evidence Collection Guide

### Evidence Quality Standards

| Criterion | Requirement | Example |
|-----------|-------------|---------|
| **Relevance** | Directly supports control | Access review → proves CC6.3 |
| **Completeness** | Covers full audit period | 12 months of data |
| **Accuracy** | Reflects actual state | Not mockups or drafts |
| **Timeliness** | Current or within period | Dated within audit scope |
| **Source** | From authoritative system | Direct system export |

### Evidence Types

| Type | Description | Best Practices |
|------|-------------|----------------|
| **Policies** | Formal documents | Version controlled, approved |
| **Procedures** | Operational guides | Dated, reviewed regularly |
| **Screenshots** | System configurations | Include date/time, URL |
| **Reports** | System-generated outputs | Unmodified exports |
| **Logs** | Activity records | Raw format, timestamps |
| **Tickets** | Work items | Complete with approvals |
| **Attestations** | Signed statements | Management signatures |
| **Contracts** | Legal agreements | Executed copies |

### Evidence Naming Convention

```
[CONTROL_ID]_[EVIDENCE_TYPE]_[DATE]_[DESCRIPTION].[EXT]

Examples:
CC6.3_AccessReview_2026Q1_QuarterlyUserReview.xlsx
AC-2_Screenshot_20260115_UserProvisioningProcess.png
A.9.2.5_Report_202601_PrivilegedAccessReview.pdf
```

### Evidence Repository Structure

```
/Audit_Evidence_2026/
├── /SOC2/
│   ├── /CC1_ControlEnvironment/
│   ├── /CC2_Communication/
│   ├── /CC3_RiskAssessment/
│   ├── /CC4_Monitoring/
│   ├── /CC5_ControlActivities/
│   ├── /CC6_LogicalPhysicalAccess/
│   ├── /CC7_SystemOperations/
│   ├── /CC8_ChangeManagement/
│   └── /CC9_RiskMitigation/
├── /ISO27001/
│   ├── /A5_Policies/
│   ├── /A6_Organization/
│   ├── /A7_HumanResources/
│   └── ...
├── /GDPR/
│   ├── /ROPA/
│   ├── /DSRs/
│   ├── /DPAs/
│   └── /DPIAs/
└── /Common/
    ├── /Policies/
    ├── /Training/
    └── /VendorAssessments/
```

### PROOF System Evidence Export

```python
# Export compliance evidence from PROOF system
from vorion import VorionClient

client = VorionClient()

# Export access control evidence
access_evidence = client.compliance.export(
    framework="SOC2",
    control="CC6.3",
    start_date="2025-01-01",
    end_date="2025-12-31",
    format="PDF"
)

# Export all evidence for audit
full_export = client.compliance.export_audit_package(
    framework="SOC2",
    audit_period="2025",
    include_artifacts=True
)
```

---

## 9. Control Owner Responsibilities

### Control Owner Matrix

| Control Area | Primary Owner | Backup Owner | Evidence Deadline |
|--------------|---------------|--------------|-------------------|
| Access Control | Security Manager | IT Director | Week -6 |
| Change Management | Engineering Lead | DevOps Manager | Week -6 |
| Incident Response | Security Manager | SOC Lead | Week -5 |
| Backup & Recovery | IT Director | SRE Lead | Week -5 |
| Vendor Management | Compliance Manager | Procurement | Week -5 |
| HR Security | HR Director | HR Manager | Week -4 |
| Physical Security | Facilities Manager | Office Manager | Week -4 |
| Training | HR Director | Security Manager | Week -4 |
| Policy Management | Compliance Manager | CISO | Week -3 |
| Risk Management | CISO | Security Manager | Week -3 |

### Control Owner Checklist

**Before Audit (Week -8 to -4):**
- [ ] Review assigned controls and evidence requirements
- [ ] Identify all evidence sources
- [ ] Collect evidence for audit period
- [ ] Review evidence for completeness
- [ ] Identify and remediate gaps
- [ ] Upload evidence to repository
- [ ] Complete control self-assessment

**During Audit:**
- [ ] Be available for interviews
- [ ] Respond to auditor questions within 24 hours
- [ ] Provide additional evidence as requested
- [ ] Escalate issues to compliance lead immediately
- [ ] Document any findings in real-time

**After Audit:**
- [ ] Review findings related to your controls
- [ ] Develop remediation plans
- [ ] Implement remediations within timelines
- [ ] Provide closure evidence
- [ ] Update procedures as needed

### Control Self-Assessment Template

```
Control ID: [CC6.3]
Control Name: [Access Reviews]
Owner: [Security Manager]
Assessment Date: [2026-01-15]

1. Control Design
   - Is the control designed appropriately? [Yes/No]
   - Any design gaps identified? [Description]

2. Control Operation
   - Did the control operate effectively? [Yes/No]
   - Were there any exceptions? [Count and description]
   - Were exceptions properly handled? [Yes/No]

3. Evidence Review
   - Is evidence complete for audit period? [Yes/No]
   - Any missing evidence? [Description]
   - Evidence quality acceptable? [Yes/No]

4. Gaps and Remediation
   - Gaps identified: [List]
   - Remediation actions: [List with owners and dates]

5. Self-Assessment Result
   - Overall assessment: [Effective / Partially Effective / Not Effective]
   - Auditor risk: [Low / Medium / High]

Signed: _______________ Date: _______________
```

---

## 10. Interview Preparation

### Common Interview Topics

| Role | Likely Topics | Preparation |
|------|---------------|-------------|
| **CISO** | Security strategy, risk appetite, governance | Review security roadmap |
| **Security Manager** | Controls, incidents, monitoring | Know incident counts |
| **IT Director** | Infrastructure, access, backups | Know system counts |
| **Engineering Lead** | SDLC, change management, deployments | Know deployment frequency |
| **HR Director** | Onboarding, offboarding, training | Know employee counts |
| **Compliance Manager** | Policies, vendor management, audits | Know vendor counts |
| **Operations** | BCP, DR, availability | Know RTO/RPO |

### Interview Do's and Don'ts

**Do:**
- Answer only what is asked
- Be honest about gaps
- Offer to follow up if unsure
- Provide specific examples
- Reference documented procedures
- Stay calm and professional

**Don't:**
- Volunteer extra information
- Guess or speculate
- Speak for other departments
- Get defensive about findings
- Promise capabilities that don't exist
- Contradict written documentation

### Sample Interview Questions & Answers

**Access Control:**

Q: "How are user access requests processed?"
A: "Access requests are submitted through ServiceNow, require manager approval, and are provisioned by IT within the SLA. I can show you a sample ticket."

Q: "How often are access reviews performed?"
A: "Quarterly for all users, monthly for privileged access. Reviews are documented in our GRC system."

**Change Management:**

Q: "Walk me through the change management process."
A: "Changes go through our Jira workflow: submission, risk assessment, testing, approval by change board, deployment, and validation. I have sample tickets to demonstrate."

Q: "How are emergency changes handled?"
A: "Emergency changes follow a separate expedited process with verbal approval, but must be documented within 24 hours and reviewed in the next CAB meeting."

**Incident Response:**

Q: "Describe a recent security incident."
A: "In Q3, we detected unauthorized access attempts. Our SIEM alerted the SOC, we contained within 15 minutes, investigated, confirmed no breach, and completed a post-mortem."

Q: "How do you determine if an incident is reportable?"
A: "We follow our incident classification matrix. Data breaches affecting personal data trigger GDPR notification requirements within 72 hours."

### Interview Schedule Template

| Time | Participant | Topic | Auditor |
|------|-------------|-------|---------|
| 9:00-9:30 | CISO | Opening, security overview | Lead |
| 9:30-10:30 | Security Manager | Access control, monitoring | Lead |
| 10:30-11:30 | IT Director | Infrastructure, backups | Associate |
| 11:30-12:00 | Break | | |
| 12:00-13:00 | Engineering Lead | SDLC, change management | Lead |
| 13:00-14:00 | Lunch | | |
| 14:00-15:00 | HR Director | HR security, training | Associate |
| 15:00-16:00 | Compliance Manager | Vendors, policies | Lead |
| 16:00-16:30 | CISO | Wrap-up, questions | Lead |

---

## 11. Common Findings & Remediation

### Most Common Audit Findings

| Finding | Frequency | Impact | Prevention |
|---------|-----------|--------|------------|
| Incomplete access reviews | Very High | Medium | Automate quarterly reviews |
| Missing termination evidence | High | Medium | Same-day offboarding process |
| Undocumented changes | High | High | Enforce change tickets |
| Outdated policies | Medium | Low | Annual review calendar |
| Incomplete training | Medium | Low | Automated tracking |
| Missing vendor assessments | Medium | Medium | Annual assessment schedule |
| Weak password policies | Medium | High | Enforce via technical controls |
| Missing backup testing | Medium | High | Quarterly DR tests |
| Incomplete incident tickets | Low | Medium | Ticket templates |
| Missing encryption | Low | Critical | Default encryption |

### Remediation Plan Template

```
Finding ID: [2026-SOC2-001]
Finding: [Quarterly access reviews not completed for Q3]
Control: [CC6.3]
Severity: [Medium]

Root Cause Analysis:
- Process owner was on leave
- No backup process established
- Manual process prone to delays

Remediation Actions:
| # | Action | Owner | Due Date | Status |
|---|--------|-------|----------|--------|
| 1 | Complete Q3 review | Security Mgr | 2026-01-20 | Pending |
| 2 | Assign backup owner | CISO | 2026-01-15 | Complete |
| 3 | Implement automation | IT Director | 2026-03-01 | Pending |
| 4 | Update procedure | Compliance | 2026-01-25 | Pending |

Closure Evidence Required:
- Completed Q3 access review
- Updated procedure with backup owner
- Automation implementation documentation

Target Closure: 2026-03-15
```

### Finding Severity Definitions

| Severity | Definition | Remediation Timeline |
|----------|------------|---------------------|
| **Critical** | Material weakness, immediate risk | 30 days |
| **High** | Significant deficiency | 60 days |
| **Medium** | Control deficiency | 90 days |
| **Low** | Observation, improvement opportunity | 180 days |

---

## 12. Audit Day Logistics

### Preparation Checklist

**Facilities:**
- [ ] Reserve conference room for audit duration
- [ ] Test video conferencing equipment
- [ ] Ensure reliable WiFi access
- [ ] Prepare guest WiFi credentials
- [ ] Stock refreshments
- [ ] Arrange parking/building access

**Technology:**
- [ ] Set up evidence sharing folder
- [ ] Test screen sharing capabilities
- [ ] Prepare demo environments
- [ ] Ensure auditor system access (if needed)
- [ ] Have backup laptop available

**Personnel:**
- [ ] Confirm interview availability
- [ ] Brief all participants
- [ ] Identify backup interviewees
- [ ] Distribute interview schedule
- [ ] Assign daily point of contact

### Daily Routine During Audit

**Morning (8:30 AM):**
- [ ] Check in with auditors
- [ ] Review prior day's requests
- [ ] Distribute today's schedule
- [ ] Address outstanding questions

**Throughout Day:**
- [ ] Monitor evidence requests
- [ ] Track request response times
- [ ] Support interviews
- [ ] Document any issues

**End of Day (4:30 PM):**
- [ ] Daily status meeting with auditors
- [ ] Review findings identified
- [ ] Prioritize overnight actions
- [ ] Update leadership

### Auditor Request Tracking

| Request # | Date | Description | Owner | Due | Status |
|-----------|------|-------------|-------|-----|--------|
| REQ-001 | 01/20 | Q3 access review | Security | 01/21 | ☐ |
| REQ-002 | 01/20 | Change tickets sample | Engineering | 01/21 | ☐ |
| REQ-003 | 01/20 | Vendor risk assessments | Compliance | 01/22 | ☐ |

### Escalation Contacts

| Issue Type | Contact | Phone |
|------------|---------|-------|
| Evidence availability | Compliance Lead | xxx-xxx-xxxx |
| Technical access | IT Director | xxx-xxx-xxxx |
| Executive questions | CISO | xxx-xxx-xxxx |
| Legal concerns | General Counsel | xxx-xxx-xxxx |
| Scheduling conflicts | Admin | xxx-xxx-xxxx |

---

## 13. Post-Audit Activities

### Immediate (Within 1 Week)

- [ ] Thank auditors and participants
- [ ] Collect all audit documentation
- [ ] Review preliminary findings
- [ ] Begin remediation planning
- [ ] Schedule management debrief

### Short-Term (Within 30 Days)

- [ ] Review draft audit report
- [ ] Provide management responses
- [ ] Finalize remediation plans
- [ ] Assign remediation owners
- [ ] Communicate results to leadership

### Remediation Tracking

| Finding | Owner | Due Date | Status | Evidence |
|---------|-------|----------|--------|----------|
| F-001 | Security | 2026-04-15 | In Progress | |
| F-002 | IT | 2026-03-30 | Not Started | |
| F-003 | Compliance | 2026-04-30 | Complete | Link |

### Lessons Learned

| Category | Issue | Improvement |
|----------|-------|-------------|
| Preparation | Evidence took too long | Start 2 weeks earlier |
| Interviews | SDLC questions unexpected | Better engineering prep |
| Evidence | Screenshots undated | Include date in filename |
| Process | Request tracking manual | Implement tracking tool |

### Continuous Improvement Actions

| Action | Owner | Due | Status |
|--------|-------|-----|--------|
| Automate access reviews | IT | Q2 | ☐ |
| Implement GRC tool | Compliance | Q3 | ☐ |
| Monthly control testing | Security | Ongoing | ☐ |
| Quarterly mock audits | Internal Audit | Ongoing | ☐ |

---

## Appendix A: Evidence Request List Template

### SOC 2 Standard Evidence Requests

| # | Control | Evidence Description | Format | Period |
|---|---------|---------------------|--------|--------|
| 1 | CC1.1 | Board meeting minutes | PDF | Annual |
| 2 | CC1.2 | Organization chart | PDF | Current |
| 3 | CC1.4 | Training completion records | Excel | Annual |
| 4 | CC2.2 | Information security policy | PDF | Current |
| 5 | CC3.1 | Risk assessment report | PDF | Annual |
| 6 | CC3.2 | Risk register | Excel | Current |
| 7 | CC4.1 | Security monitoring dashboard | Screenshot | Current |
| 8 | CC4.2 | Internal audit reports | PDF | Annual |
| 9 | CC5.1 | Control matrix | Excel | Current |
| 10 | CC6.1 | Access control policy | PDF | Current |
| 11 | CC6.2 | User provisioning samples | Tickets | 10-15 |
| 12 | CC6.3 | Access review evidence | Excel | Quarterly |
| 13 | CC6.4 | Termination access removal | Tickets | 5-10 |
| 14 | CC6.5 | Physical access logs | Report | Monthly |
| 15 | CC6.6 | Encryption configuration | Screenshot | Current |
| 16 | CC7.1 | SIEM alert configuration | Screenshot | Current |
| 17 | CC7.2 | Incident tickets | Tickets | All |
| 18 | CC7.3 | Backup configuration | Screenshot | Current |
| 19 | CC7.4 | DR test results | PDF | Annual |
| 20 | CC8.1 | Change management policy | PDF | Current |
| 21 | CC8.1 | Change ticket samples | Tickets | 15-20 |
| 22 | CC9.1 | Vendor assessments | PDF | Annual |
| 23 | CC9.2 | Business continuity plan | PDF | Current |

---

## Appendix B: Audit Communication Templates

### Pre-Audit Announcement

```
Subject: Upcoming [SOC 2 / ISO 27001] Audit - Action Required

Team,

Our annual [audit type] audit is scheduled for [dates].

Key dates:
- Evidence submission deadline: [date]
- Auditor fieldwork: [dates]
- Interviews: [dates]

Action required:
- Review your assigned controls (attached)
- Collect required evidence by [deadline]
- Upload to [repository location]
- Confirm interview availability

Questions? Contact [compliance lead].

Thank you for your support.
```

### Interview Scheduling Request

```
Subject: Audit Interview Request - [Date/Time]

Hi [Name],

You've been selected for an interview during our [audit type] audit.

Details:
- Date: [date]
- Time: [time]
- Duration: [duration]
- Location: [room / video link]
- Topic: [interview focus]

Preparation:
- Review attached control documentation
- Familiarize yourself with [specific procedures]
- Have examples ready for [common questions]

Please confirm your availability by [date].

Thank you,
[Compliance Lead]
```

### Daily Status Update

```
Subject: Audit Status Update - Day [#]

Team,

Day [#] Summary:

Completed:
- [Activity 1]
- [Activity 2]

Outstanding Requests:
| Request | Owner | Due | Status |
|---------|-------|-----|--------|
| [desc]  | [name]| [date]| [status]|

Findings Identified: [#]
- [Brief description of any findings]

Tomorrow's Schedule:
- [Activity 1]
- [Activity 2]

Escalations: [Any urgent items]

Please prioritize outstanding evidence requests.

[Compliance Lead]
```

---

## Appendix C: Quick Reference Card

### Key Deadlines

| Activity | Timing |
|----------|--------|
| Evidence collection start | Week -12 |
| Evidence collection complete | Week -4 |
| Evidence submission to auditor | Week -3 |
| Interview prep complete | Week -1 |
| Draft report review | Week +2 |
| Management response due | Week +3 |
| Final report issued | Week +4 |

### Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Compliance Lead | | | |
| CISO | | | |
| Legal | | | |
| Executive Sponsor | | | |

### Evidence Repository

| Location | URL/Path |
|----------|----------|
| Evidence folder | |
| GRC system | |
| Policy repository | |
| Training records | |

---

*Document Version: 1.0*
*Last Updated: 2026-01-08*
*Owner: Compliance Team*
*Review Cycle: Annual*
