## Context

The backend already has significant infrastructure in place for this feature:
- Project entity includes `autoSynthesisEnabled` field with database migration
- API endpoints support the field in `UpdateProjectDto`
- CLI push command already checks and respects the auto-synthesis setting
- API key encryption service provides hash generation and comparison functionality
- API key status endpoints return hash information

**Current Gap**: The frontend console application doesn't expose these capabilities to users. This is primarily a frontend integration task.

**Stakeholders**: Development teams using Fabrick for automated synthesis workflows, project administrators managing API key settings.

## Goals / Non-Goals

**Goals:**
- Expose auto-synthesis toggle in project settings UI with clear labeling
- Display API key hashes immediately when settings forms load for transparency
- Implement hash-based change detection to prevent unnecessary API key resubmission
- Ensure organization settings support API key updates with hash display
- Maintain existing API key validation logic and security patterns

**Non-Goals:**
- Changing backend API contracts (already implemented)
- Adding audit logging for auto-synthesis changes (explicitly excluded per issue)
- Modifying CLI behavior (already implemented)
- Adding organization-level auto-synthesis toggle (project-only feature)

## Decisions

**Frontend-Only Implementation**: Since backend infrastructure exists, this is purely a frontend integration task. This reduces risk and implementation complexity.

**Reuse Existing Hash Display Pattern**: Leverage the existing `ApiKeyStatusDisplay` component pattern that shows truncated hashes (last 8 characters). This maintains consistency with current UI patterns.

**Hash-Based Form Optimization**: Store the initial API key hash on form load and compare with form state to determine if the key field should be included in update payloads. This prevents accidental key loss during other settings updates.

**Separate Organization Settings Support**: Add API key management to organization settings but exclude the auto-synthesis toggle, as synthesis is project-scoped. This aligns with the backend schema design.

## Risks / Trade-offs

**UI Complexity**: Adding hash display and change detection logic to forms increases frontend complexity → Mitigation: Reuse existing components and patterns from `ApiKeyStatusDisplay`

**Hash Visibility**: Displaying even truncated hashes could be considered a security concern → Mitigation: This follows existing patterns already in production, truncated hashes don't expose sensitive data

**Form State Management**: Managing hash comparison state could introduce bugs in form submission → Mitigation: Use clear state variables and comprehensive testing of form submission scenarios

**User Confusion**: Auto-synthesis toggle might be unclear to users → Mitigation: Add clear help text explaining that synthesis runs automatically after CLI pushes when enabled