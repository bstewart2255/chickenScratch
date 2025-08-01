// Updated API functions for signature authentication flow
// Replace the stubbed functions in your HTML file with these implementations

// Global variables that should be defined in the calling context
let isSignUp = true; // Track which flow we're in
let currentUsername = ''; // Store username

// API URL configuration - adjust based on environment
const API_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://chickenscratch.onrender.com';

// 1. Check username availability (for sign-up) or existence (for sign-in)
async function checkUsernameAvailability(username) {
    try {
        if (isSignUp) {
            // For sign-up: check if username is available
            const response = await fetch(`${API_URL}/api/check-username`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            
            if (!response.ok) {
                if (response.status === 409) {
                    throw new Error('Username already taken, please choose another');
                }
                throw new Error('Error checking username availability');
            }
            
            const data = await response.json();
            return data;
        } else {
            // For sign-in: check if username exists
            const response = await fetch(`${API_URL}/api/check-user-exists`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Username does not exist, please sign up first');
                }
                throw new Error('Error checking username');
            }
            
            const data = await response.json();
            return data;
        }
    } catch (error) {
        if (error.message.includes('fetch')) {
            throw new Error('Connection error, please try again');
        }
        throw error;
    }
}

// 2. Save individual drawing/signature steps during the flow
async function saveDrawingData(drawingData) {
    try {
        // Extract metrics from the signature pad data if available
        const metrics = {
            stroke_count: drawingData.raw?.length || 0,
            total_points: drawingData.raw?.reduce((sum, stroke) => sum + stroke.length, 0) || 0,
            duration_ms: drawingData.duration || 0
        };

        const response = await fetch(`${API_URL}/api/save-drawing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...drawingData,
                metrics: metrics
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save drawing');
        }
        
        const result = await response.json();
        console.log(`Step ${drawingData.step} saved successfully:`, result);
        return result;
    } catch (error) {
        if (error.message.includes('fetch')) {
            throw new Error('Connection error, please try again');
        }
        throw error;
    }
}

// 3. Complete the authentication flow (sign-up or sign-in)
async function completeAuthFlow() {
    try {
        if (isSignUp) {
            // Complete sign-up using temporary data
            console.log('Completing sign-up for:', currentUsername);
            
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUsername,
                    useTemporaryData: true,
                    metadata: {
                        device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
                        timestamp: Date.now(),
                        flowType: 'mobile-step-by-step'
                    }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Registration failed');
            }
            
            const result = await response.json();
            return { 
                type: 'signup', 
                username: currentUsername,
                ...result 
            };
        } else {
            // Complete sign-in with single signature
            console.log('Completing sign-in for:', currentUsername);
            
            // For sign-in, we need to get the saved signature data
            // The backend should have it from the saveDrawingData call
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUsername,
                    useTemporaryData: true,
                    metadata: {
                        device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
                        timestamp: Date.now(),
                        flowType: 'mobile-sign-in'
                    }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                
                // Handle specific authentication failure
                if (response.status === 401) {
                    throw new Error('Signature verification failed. Please try again.');
                }
                
                throw new Error(errorData.error || 'Sign-in failed');
            }
            
            const result = await response.json();
            return { 
                type: 'signin', 
                username: currentUsername,
                ...result 
            };
        }
    } catch (error) {
        if (error.message.includes('fetch')) {
            throw new Error('Connection error, please try again');
        }
        throw error;
    }
}

// Optional: Add this function to clear temporary data if needed
async function clearTemporaryData(username) {
    try {
        const response = await fetch(`${API_URL}/api/temp-drawings/${username}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            console.warn('Failed to clear temporary data');
        }
    } catch (error) {
        console.warn('Error clearing temporary data:', error);
    }
}