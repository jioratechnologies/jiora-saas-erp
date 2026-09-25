# Rule: Standardized Client-Friendly Error Messages

## Purpose
Ensure all error feedback across the SaaS ERP application is short, understandable by non-technical clients, and never exposes internal database errors, HTTP status JSON, or stack traces.

## Guidelines
1. **Never Show Raw Technical Dumps**:
   - Forbid displaying raw JSON such as `{"statusCode":500,"message":"Internal server error"}`.
   - Forbid exposing Prisma error codes (e.g. `P2002`, `P2025`) or database constraint messages.

2. **Standard Message Mappings**:
   - **Duplicate Records (409 / P2002)**: `"A record with this name already exists. Please choose a different one."`
   - **Not Found (404 / P2025)**: `"The requested item could not be found."`
   - **Validation Failure (400 / 422)**: `"Please check your input and try again."`
   - **Forbidden / Unauthorized (401 / 403)**: `"You do not have permission to perform this action."` or `"Your session has expired. Please sign in again."`
   - **Network Error**: `"Unable to connect to the server. Please check your internet connection."`
   - **Server Error (500)**: `"Something went wrong on the server. Please try again in a moment."`

3. **Backend Service Requirement**:
   - In NestJS service methods, wrap operations with unique constraints or entity lookups in `try...catch` and rethrow as `ConflictException`, `NotFoundException`, or `BadRequestException` with clean messages.

4. **Frontend API & Toast Requirement**:
   - All errors passed to `toast.error()` or thrown by `api.request()` must pass through `formatErrorMessage()` in `apps/web/src/lib/error-formatter.ts`.
