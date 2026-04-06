## 1. Parser: @privacy block decorator

- [x] 1.1 Add `privacy?: Record<string, KnotValue>` field to `PanelNode` in `packages/parser/src/types.ts`
- [x] 1.2 Add `@privacy` recognition in panel parse loop (match AT_UNKNOWN with value "@privacy", call `parseKnotBlock()`)
- [x] 1.3 Include `privacy` in PanelNode return (`privacy: privacy || undefined`)
- [x] 1.4 Add parser test: `@privacy { framework: gdpr, dpa_ref: "..." }` produces correct `PanelNode.privacy` record
- [x] 1.5 Add parser test: panel without `@privacy` has `privacy: undefined`

## 2. Validator: wire @privacy to E_PRIVACY_BYPASS

- [x] 2.1 Replace `panelHasPrivacyDecorator` stub with `panel.privacy != null` check
- [x] 2.2 Add test: E_PRIVACY_BYPASS fires when `@privacy { framework: gdpr }` declared without private-data rod
- [x] 2.3 Add test: E_PRIVACY_BYPASS does NOT fire when `@privacy` declared with private-data rod present
- [x] 2.4 Add test: E_PRIVACY_BYPASS does NOT fire when `@privacy` is absent

## 3. Privacy validator test coverage

- [x] 3.1 Add test: E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY fires for special-category data with disallowed basis
- [x] 3.2 Add test: E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY does NOT fire with consent basis
- [x] 3.3 Add test: E_BDSG_EMPLOYEE_CATEGORY fires for employee_data:true without employee_category under gdpr.bdsg

## 4. CLI: strux build tests

- [x] 4.1 Create `packages/cli/src/__tests__/build.test.ts`
- [x] 4.2 Test: successful build writes files to `.openstrux/build/` with `@openstrux/build` package.json
- [x] 4.3 Test: missing config exits with code 1 and reports config error
- [x] 4.4 Test: parse error exits with code 1 and reports parse error
- [x] 4.5 Test: no matching .strux files warns and returns without output

## 5. Housekeeping

- [x] 5.1 Move `packages/diagnostics.md` to `docs/diagnostics.md` (fixes Vitest/esbuild loader conflict)
- [x] 5.2 Verify all 352 tests pass across 8 packages
