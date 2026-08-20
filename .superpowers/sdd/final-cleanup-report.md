# Final Cleanup Report - SMS OTP Password Recovery Branch

## Summary
Applied two minor, low-risk cleanups to the completed password-recovery feature branch.

## Fix 1: Remove Dead Code - `normalizePhone` Function

**Status:** COMPLETED

**Details:**
- **File:** `src/app/api/student/primeiro-acesso/route.ts`
- **Removed:** `normalizePhone()` function definition (lines 26-31)
- **Verification:** Grep confirmed zero call sites; function was only defined with no usages
- **Reason:** The old `recover` action that used this function was replaced by the SMS OTP wizard endpoints (`identify`, `set-phone`, `resend`, `confirm`) in commit 27497b0
- **Typecheck:** `npm run typecheck` passes with no errors

## Fix 2: Reword Stale Security Backlog Row

**Status:** COMPLETED

**Details:**
- **File:** `CLAUDE.md` section "⚠️ Pendências de segurança conhecidas"
- **Changed Row:** Line 116 (was 🔴 CRÍTICO, now 🟡 MÉDIO)
- **Before:**
  ```
  | 🔴 CRÍTICO | `api/student/primeiro-acesso` (action `reset` + `search`) | Reset de senha de **qualquer** usuário sem autenticação nem prova de identidade (CPF/nascimento); `search` enumera usuários. **Fix:** exigir prova de identidade + rate limit. |
  ```
- **After:**
  ```
  | 🟡 MÉDIO | `api/student/primeiro-acesso` (action `search`) | `search` (usada pelo fluxo de primeiro acesso) ainda devolve `userId`/`email` e permite enumeração de usuários. O reset de senha (`identify`/`confirm`) já exige prova de identidade + SMS OTP + rate limit (ver Fase 2 do plano de recuperação). **Fix:** blindar `search` para não devolver dados identificáveis. |
  ```
- **Scope:** Row now correctly scopes security debt to only the remaining `search` action enumeration issue, acknowledging that the password reset functionality is now protected with SMS OTP + identity proof + rate limiting
- **Verification:** Markdown table formatting confirmed intact

## Verification Results
- ✅ `npm run typecheck` passes (no errors from removed function)
- ✅ CLAUDE.md table formatting valid (pipes aligned, row structure intact)
- ✅ No uncommitted changes besides these two files
- ✅ Git diff shows only the expected edits (normalizePhone removal + security row reword)

## Files Modified
1. `src/app/api/student/primeiro-acesso/route.ts` - Removed unused `normalizePhone()` function
2. `CLAUDE.md` - Updated security backlog row for `api/student/primeiro-acesso`

## Commit
Ready for commit: `chore: remove dead normalizePhone helper and reword stale security backlog row`
