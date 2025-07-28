# Environment Variables Setup

## Security Fix: Database Credentials

This project has been updated to use environment variables instead of hardcoded database credentials.

## Required Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://signatureauth_user:XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV@dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com/signatureauth

# Alternative environment variables for individual components
DB_HOST=dpg-d1tsq36r433s73e4gtvg-a.oregon-postgres.render.com
DB_PORT=5432
DB_NAME=signatureauth
DB_USER=signatureauth_user
DB_PASSWORD=XVzIXGqeLXanJIqn5aVwLIRcXmrGmmpV
```

## Installation

1. Install the `dotenv` package if not already installed:
   ```bash
   npm install dotenv
   ```

2. Create the `.env` file with your database credentials

3. The `.env` file is already in `.gitignore` to prevent credentials from being committed

## Files Updated

The following files have been updated to use environment variables instead of hardcoded credentials:

- `backend/check_auth_attempts.js`
- `backend/check_migration_status.js`
- `backend/check_shapes_columns.js`
- `backend/check_tables.js`
- `backend/execute_migration.js`
- `backend/investigate_base64_shapes.js`
- `backend/investigation.js`
- `backend/run_backup.js`
- `backend/run_backup_corrected.js`
- `backend/run_backup_simple.js`
- `backend/run_migration.js`
- `backend/run_migration_fixed.js`
- `backend/run_post_validation.js`
- `backend/setupDatabase.js`
- `backend/improved_exportMLDataForTraining.js`
- `backend/checkData.js`
- `backend/verifyMetrics.js`

## Security Benefits

- Database credentials are no longer exposed in source code
- Different environments can use different database configurations
- Credentials can be rotated without code changes
- Follows security best practices for credential management 