# Audit Skill

## Purpose
This skill is designed to perform systematic reviews of the PESSY application. It focuses on identifying logical loops, UI regressions, data sanitation issues (anti-placeholder policy), and architectural inconsistencies.

## Audit Workflow
1. **Navigation Check**: Review `App.tsx` and context providers for routing logic. Ensure logged-in users are not redirected to onboarding if data exists.
2. **Modal Integrity**: Identify triggers for key modals (`DocumentScannerModal`, `ExportReportModal`, `EditEventModal`). Ensure they are only triggered by explicit user actions.
3. **Data Sanitation**: Scan for hardcoded strings following the "Anti-Placeholder" policy.
4. **Context State Review**: Audit `AuthContext`, `PetContext`, and `MedicalContext` for inconsistent or race-condition prone states.

## Standards
- Professional code style.
- No dummy data in production.
- Responsive and predictable navigation.
- Consistent use of Gemini AI for data extraction only when requested.
