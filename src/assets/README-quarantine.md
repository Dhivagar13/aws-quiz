# Asset quarantine note

## `aws-logo.jpeg`
- Source: workspace file `aws logo-.jpeg` (unsafe name with space + trailing dash).
- Visual verify at 100% and 200%: orange pixel identicon on light gray, NOT official AWS branding.
- Decision: quarantined. File kept for provenance but NEVER imported in UI.
- UI uses text lockup `AWS SBG` instead to avoid trademark misuse.

## `mec-logo.jpg`
- Source: workspace file `logo.jpg`.
- Visual verify: Mailam Engineering College banner with NAAC/NBA/TCS marks.
- Approved for header use in `src/components/Layout.tsx` with white chip backing.
- Keep aspect ratio, do not stretch.
