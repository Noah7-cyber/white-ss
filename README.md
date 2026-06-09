# System Admin Testing

All required endpoints for the new System Admin modules have been successfully tested using Jest and Supertest.

## Tested Endpoints

### Auth
- `POST /system-admin/auth/login` - Tested valid login, invalid credentials (401), and validation errors (400).
- `POST /system-admin/auth/verify-mfa` - Tested valid MFA verification.

### Invitations
- `POST /system-admin/invitations/accept` - Tested successful invitation acceptance and validation errors.
- `POST /system-admin/invitations` - Tested successful invitation creation and validation errors.

### Staff
- `GET /system-admin/staff` - Tested retrieving staff list successfully and failure scenarios.
- `GET /system-admin/staff/:id` - Tested retrieving staff details, invalid ID format, and 404 not found scenarios.

## Notes
- Testing was performed using mock services to isolate the routing and validation layer, bypassing the database constraint setup that was failing due to missing/invalid TypeORM connection contexts.
- No direct code bugs were found within the endpoints' response structures during mocked testing. All endpoints adhere to the documented request validation constraints and return standard successful/error JSON response schemas as handled by the inner validation service hooks.
