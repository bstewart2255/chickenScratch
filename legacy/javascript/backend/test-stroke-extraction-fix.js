const { extractStrokeDataFromSignaturePad } = require('./server.js');

// Test cases to verify the fixes
function testStrokeExtractionFixes() {
    console.log('Testing extractStrokeDataFromSignaturePad fixes...\n');
    
    // Test 1: Normal SignaturePad v4 format
    const test1 = {
        raw: [
            { points: [[100, 200], [101, 201], [102, 202]] },
            { points: [[300, 400], [301, 401]] }
        ]
    };
    
    console.log('Test 1 - Normal SignaturePad v4 format:');
    const result1 = extractStrokeDataFromSignaturePad(JSON.stringify(test1));
    console.log('Input:', JSON.stringify(test1));
    console.log('Output:', JSON.stringify(result1));
    console.log('Expected: Array with 2 stroke arrays');
    console.log('Pass:', Array.isArray(result1) && result1.length === 2 ? '✓' : '✗');
    console.log('');
    
    // Test 2: Nested data property with string
    const test2 = {
        data: JSON.stringify({
            raw: [
                { points: [[100, 200], [101, 201]] }
            ]
        })
    };
    
    console.log('Test 2 - Nested data property with string:');
    const result2 = extractStrokeDataFromSignaturePad(test2);
    console.log('Input:', JSON.stringify(test2));
    console.log('Output:', JSON.stringify(result2));
    console.log('Expected: Array with 1 stroke array');
    console.log('Pass:', Array.isArray(result2) && result2.length === 1 ? '✓' : '✗');
    console.log('');
    
    // Test 3: Nested data property with object
    const test3 = {
        data: {
            raw: [
                { points: [[100, 200], [101, 201]] }
            ]
        }
    };
    
    console.log('Test 3 - Nested data property with object:');
    const result3 = extractStrokeDataFromSignaturePad(test3);
    console.log('Input:', JSON.stringify(test3));
    console.log('Output:', JSON.stringify(result3));
    console.log('Expected: Array with 1 stroke array');
    console.log('Pass:', Array.isArray(result3) && result3.length === 1 ? '✓' : '✗');
    console.log('');
    
    // Test 4: Deeply nested data properties
    const test4 = {
        data: JSON.stringify({
            data: {
                raw: [
                    { points: [[100, 200], [101, 201]] }
                ]
            }
        })
    };
    
    console.log('Test 4 - Deeply nested data properties:');
    const result4 = extractStrokeDataFromSignaturePad(test4);
    console.log('Input:', JSON.stringify(test4));
    console.log('Output:', JSON.stringify(result4));
    console.log('Expected: Array with 1 stroke array');
    console.log('Pass:', Array.isArray(result4) && result4.length === 1 ? '✓' : '✗');
    console.log('');
    
    // Test 5: Invalid JSON in data property
    const test5 = {
        data: 'invalid json string'
    };
    
    console.log('Test 5 - Invalid JSON in data property:');
    const result5 = extractStrokeDataFromSignaturePad(test5);
    console.log('Input:', JSON.stringify(test5));
    console.log('Output:', result5);
    console.log('Expected: null (due to parsing error)');
    console.log('Pass:', result5 === null ? '✓' : '✗');
    console.log('');
    
    // Test 6: Maximum recursion depth test
    let deepNested = { data: 'test' };
    for (let i = 0; i < 10; i++) {
        deepNested = { data: deepNested };
    }
    
    console.log('Test 6 - Maximum recursion depth test:');
    const result6 = extractStrokeDataFromSignaturePad(deepNested);
    console.log('Input: Deeply nested object (10 levels)');
    console.log('Output:', result6);
    console.log('Expected: null (due to max depth limit)');
    console.log('Pass:', result6 === null ? '✓' : '✗');
    console.log('');
    
    console.log('All tests completed!');
}

// Run the tests
testStrokeExtractionFixes(); 