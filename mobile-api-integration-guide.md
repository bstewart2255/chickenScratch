# Mobile API Integration Guide

## Overview
The API functions have been updated to connect to the real backend endpoints for the mobile signature authentication flow.

## Integration Steps

### 1. Add API URL Configuration
Add this at the top of your script section in the HTML file:

```javascript
// API URL configuration - adjust based on environment
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://chickenscratch.onrender.com';
```

### 2. Replace the Stubbed Functions

Replace the existing stubbed functions in your HTML with the implementations from `updated-api-functions.js`:

1. **checkUsernameAvailability(username)** - Now properly calls:
   - `/api/check-username` for sign-up (checks availability)
   - `/api/check-user-exists` for sign-in (verifies existence)

2. **saveDrawingData(drawingData)** - Now properly:
   - Calls `/api/save-drawing` endpoint
   - Includes metrics calculation from signature pad data
   - Maintains proper error handling

3. **completeAuthFlow()** - Now properly:
   - Calls `/register` with `useTemporaryData: true` for sign-up
   - Calls `/login` with `useTemporaryData: true` for sign-in
   - Includes device metadata and timestamps

## Backend Updates Made

1. **New Endpoints Added:**
   - `POST /api/check-username` - Check username availability
   - `POST /api/check-user-exists` - Verify user exists
   - `POST /api/save-drawing` - Save drawing steps temporarily
   - `GET /api/temp-drawings/:username` - Check temp data status
   - `DELETE /api/temp-drawings/:username` - Clear temp data

2. **Updated Endpoints:**
   - `/register` - Now supports `useTemporaryData` flag
   - `/login` - Now supports `useTemporaryData` flag

## Testing the Integration

1. Start your backend server:
   ```bash
   cd backend
   npm start
   ```

2. Open your HTML file and test:
   - Sign-up flow (11 steps)
   - Sign-in flow (1 step)
   - Username validation
   - Error handling

## Important Notes

- Temporary data is automatically cleaned up after 1 hour
- The backend stores drawings in memory (consider Redis for production)
- All API calls include proper error handling and user-friendly messages
- The flow maintains backward compatibility with the existing system

## Error Handling

The API functions handle these specific cases:
- Username already taken (409)
- User not found (404)
- Connection errors
- Server errors (500)
- Authentication failures (401)

Each error provides a user-friendly message that can be displayed in your UI.