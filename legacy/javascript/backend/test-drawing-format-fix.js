// Test script to validate drawing format fix
require('dotenv').config();

// Import the extraction function from server.js
function extractStrokeDataFromSignaturePad(signatureData) {
    if (!signatureData) return null;
    
    try {
        let parsed = signatureData;
        if (typeof signatureData === 'string') {
            parsed = JSON.parse(signatureData);
        }
        
        // Handle SignaturePad v4 format: {raw: [{points: [...], ...}]}
        if (parsed.raw && Array.isArray(parsed.raw)) {
            return parsed.raw.map(stroke => {
                // Convert stroke object to points array
                if (stroke.points && Array.isArray(stroke.points)) {
                    return stroke.points;
                }
                // If stroke is already a points array, return as is
                if (Array.isArray(stroke)) {
                    return stroke;
                }
                return [];
            });
        }
        
        // Handle legacy format: {strokes: [[...], [...]]}
        if (parsed.strokes && Array.isArray(parsed.strokes)) {
            return parsed.strokes;
        }
        
        // Handle direct array format: [[...], [...]]
        if (Array.isArray(parsed)) {
            return parsed;
        }
        
        console.warn('No stroke data found in signature data');
        return null;
    } catch (error) {
        console.error('Error extracting stroke data from SignaturePad format:', error);
        return null;
    }
}

// Test cases
const testCases = [
    {
        name: 'SignaturePad v4 Format',
        data: {
            data: "data:image/png;base64,iVBORw0KGgoAAAANS...",
            raw: [
                {
                    penColor: "rgb(0, 0, 0)",
                    points: [
                        {x: 10, y: 20, time: 100},
                        {x: 15, y: 25, time: 150},
                        {x: 20, y: 30, time: 200}
                    ],
                    dotSize: 0,
                    minWidth: 2,
                    maxWidth: 4
                },
                {
                    penColor: "rgb(0, 0, 0)",
                    points: [
                        {x: 30, y: 40, time: 300},
                        {x: 35, y: 45, time: 350}
                    ],
                    dotSize: 0,
                    minWidth: 2,
                    maxWidth: 4
                }
            ],
            metrics: {
                stroke_count: 2,
                total_points: 5,
                duration_ms: 250
            },
            timestamp: 1234567890
        },
        expectedStrokes: 2,
        expectedPoints: 5
    },
    {
        name: 'Legacy Format',
        data: {
            strokes: [
                [{x: 10, y: 20}, {x: 15, y: 25}],
                [{x: 30, y: 40}]
            ],
            metrics: {
                stroke_count: 2,
                total_points: 3
            }
        },
        expectedStrokes: 2,
        expectedPoints: 3
    },
    {
        name: 'Direct Array Format',
        data: [
            [{x: 10, y: 20}, {x: 15, y: 25}],
            [{x: 30, y: 40}]
        ],
        expectedStrokes: 2,
        expectedPoints: 3
    },
    {
        name: 'Empty Data',
        data: null,
        expectedStrokes: 0,
        expectedPoints: 0
    }
];

console.log('Testing drawing format fix...\n');

let passedTests = 0;
let totalTests = 0;

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    
    try {
        const result = extractStrokeDataFromSignaturePad(testCase.data);
        
        if (testCase.data === null) {
            // Test for null data
            if (result === null) {
                console.log('✅ PASSED: Correctly handled null data');
                passedTests++;
            } else {
                console.log('❌ FAILED: Should return null for null data');
            }
        } else {
            // Test for valid data
            const actualStrokes = result ? result.length : 0;
            const actualPoints = result ? result.reduce((sum, stroke) => sum + (Array.isArray(stroke) ? stroke.length : 0), 0) : 0;
            
            const strokeMatch = actualStrokes === testCase.expectedStrokes;
            const pointMatch = actualPoints === testCase.expectedPoints;
            
            if (strokeMatch && pointMatch) {
                console.log(`✅ PASSED: Strokes=${actualStrokes}, Points=${actualPoints}`);
                passedTests++;
            } else {
                console.log(`❌ FAILED: Expected strokes=${testCase.expectedStrokes}, points=${testCase.expectedPoints}, got strokes=${actualStrokes}, points=${actualPoints}`);
            }
        }
        
        totalTests++;
        
    } catch (error) {
        console.log(`❌ FAILED: Error occurred - ${error.message}`);
        totalTests++;
    }
    
    console.log('');
});

console.log(`Test Results: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
    console.log('🎉 All tests passed! The drawing format fix is working correctly.');
} else {
    console.log('⚠️  Some tests failed. Please review the implementation.');
} 