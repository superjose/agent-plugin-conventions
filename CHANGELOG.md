# Changelog

## 0.2.0

Breaking: component implementations now require `ComponentName/index.tsx`.
Component test names remain `ComponentName.test.tsx` / `.spec.tsx`.
Add configurable default-export route entrypoint exemptions.
Restrict name-based operation detection to PascalCase, avoiding React Query hooks.

## 0.1.0

Initial extraction of ten conventions rules from Notaflash, with Oxlint JSON and ESLint flat-config presets.
