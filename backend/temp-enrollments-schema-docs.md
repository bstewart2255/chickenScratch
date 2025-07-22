# Temporary Enrollments Database Schema Documentation

## Overview
This schema supports the step-by-step signature collection flow for mobile web experience, allowing users to complete enrollment in multiple steps while maintaining session state in the database.

## Schema Design

### Tables

#### 1. `temp_enrollments`
Stores enrollment session information.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| session_id | VARCHAR(255) | Unique session identifier |
| username | VARCHAR(255) | Username being enrolled |
| flow_type | VARCHAR(20) | Either 'signup' or 'signin' |
| status | VARCHAR(20) | 'in_progress', 'completed', or 'expired' |
| device_info | TEXT | User agent string |
| metadata | JSONB | Additional session data (IP, timestamp, etc.) |
| created_at | TIMESTAMP | When enrollment started |
| updated_at | TIMESTAMP | Last activity timestamp |
| expires_at | TIMESTAMP | Auto-expiry time (2 hours default) |

#### 2. `temp_enrollment_steps`
Stores individual drawing steps within an enrollment.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| enrollment_id | INTEGER | Foreign key to temp_enrollments |
| step_number | INTEGER | Step number (1-11 for signup, 1 for signin) |
| step_type | VARCHAR(20) | 'signature', 'shape', or 'drawing' |
| instruction | TEXT | What the user was asked to draw |
| signature_data | TEXT | Base64 encoded image data |
| raw_data | JSONB | Raw signature pad data |
| metrics | JSONB | Calculated metrics for the drawing |
| completed_at | TIMESTAMP | When step was completed |

### Indexes

Performance-optimized indexes:
- `idx_temp_enrollments_session_id` - Fast session lookups
- `idx_temp_enrollments_username` - Username validation queries
- `idx_temp_enrollments_expires_at` - Cleanup operations
- `idx_users_username_lower` - Case-insensitive username searches

### Functions

#### `get_enrollment_progress(session_id)`
Returns current progress of an enrollment session.

```sql
SELECT * FROM get_enrollment_progress('sess_123');
```

Returns:
- total_steps: Expected steps (11 for signup, 1 for signin)
- completed_steps: Steps completed so far
- last_step_number: Most recent step
- last_step_type: Type of last step
- remaining_steps: Steps left to complete
- is_complete: Whether enrollment is ready

#### `complete_enrollment(session_id)`
Marks an enrollment as completed.

```sql
SELECT * FROM complete_enrollment('sess_123');
```

#### `cleanup_expired_enrollments()`
Removes expired sessions (runs periodically).

```sql
SELECT cleanup_expired_enrollments();
```

## API Integration

### Session Flow

1. **Username Check**
   - `/api/check-username` (signup)
   - `/api/check-user-exists` (signin)

2. **Drawing Collection**
   - `/api/save-drawing` saves each step
   - Returns session_id on first call
   - Tracks progress automatically

3. **Completion**
   - `/register` with `useTemporaryData: true`
   - `/login` with `useTemporaryData: true`

### Example API Calls

```javascript
// Start enrollment (first drawing)
POST /api/save-drawing
{
  "username": "john_doe",
  "step": 1,
  "type": "signature",
  "instruction": "Sign your name",
  "signature": "data:image/png;base64,...",
  "raw": {...},
  "metrics": {...}
}
// Returns: { sessionId: "sess_123", progress: {...} }

// Continue enrollment
POST /api/save-drawing
{
  "sessionId": "sess_123",
  "username": "john_doe",
  "step": 2,
  // ... rest of data
}

// Complete signup
POST /register
{
  "username": "john_doe",
  "sessionId": "sess_123",
  "useTemporaryData": true
}
```

## Benefits

1. **Reliability**: Data persists across connection issues
2. **Security**: Server-side session management
3. **Flexibility**: Support for different flow types
4. **Performance**: Optimized indexes for fast lookups
5. **Cleanup**: Automatic expiry of abandoned sessions

## Maintenance

### Regular Tasks
1. Run cleanup function hourly: `SELECT cleanup_expired_enrollments()`
2. Monitor table growth with expired sessions
3. Archive completed enrollments if needed

### Monitoring Queries

```sql
-- Check active sessions
SELECT username, flow_type, 
       (SELECT COUNT(*) FROM temp_enrollment_steps WHERE enrollment_id = te.id) as steps_completed,
       created_at, expires_at
FROM temp_enrollments te
WHERE status = 'in_progress'
ORDER BY created_at DESC;

-- Check expired sessions pending cleanup
SELECT COUNT(*) 
FROM temp_enrollments 
WHERE status = 'in_progress' 
AND expires_at < NOW();

-- Average steps per enrollment type
SELECT flow_type, AVG(step_count) as avg_steps
FROM (
    SELECT te.flow_type, COUNT(tes.id) as step_count
    FROM temp_enrollments te
    LEFT JOIN temp_enrollment_steps tes ON te.id = tes.enrollment_id
    WHERE te.status = 'completed'
    GROUP BY te.id, te.flow_type
) t
GROUP BY flow_type;
```

## Migration from In-Memory

The new database approach replaces the in-memory `temporaryDrawingStorage` Map with persistent storage, providing:
- Better scalability
- Data persistence across server restarts
- Support for load-balanced environments
- Built-in expiry and cleanup