// Drawing verification algorithms for each drawing type

// Calculate distance between two points
function distance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Calculate angle between three points
function angle(p1, p2, p3) {
    const a = distance(p1, p2);
    const b = distance(p2, p3);
    const c = distance(p1, p3);
    return Math.acos((a * a + b * b - c * c) / (2 * a * b)) * 180 / Math.PI;
}

// Extract key points from strokes (expects normalized stroke data)
function extractKeyPoints(strokes) {
    const points = [];
    
    if (!Array.isArray(strokes)) {
        console.warn('extractKeyPoints: strokes is not an array:', typeof strokes);
        return points;
    }
    
    strokes.forEach((stroke, strokeIndex) => {
        // After normalization, strokes should be arrays of points
        if (Array.isArray(stroke)) {
            stroke.forEach((point, pointIndex) => {
                if (point && typeof point === 'object' && (point.x !== undefined || point.y !== undefined)) {
                    points.push(point);
                } else {
                    console.warn(`extractKeyPoints: invalid point at stroke ${strokeIndex}, point ${pointIndex}:`, point);
                }
            });
        }
        // Handle case where stroke might be a single point object
        else if (stroke && typeof stroke === 'object' && (stroke.x !== undefined || stroke.y !== undefined)) {
            points.push(stroke);
        }
        else {
            console.warn(`extractKeyPoints: stroke ${strokeIndex} has unsupported format:`, typeof stroke, stroke);
        }
    });
    
    return points;
}

// Compare face drawings
async function compareFaceDrawings(storedFace, attemptFace) {
    try {
        // Ensure both objects have strokes property
        if (!storedFace || !attemptFace) {
            console.warn('Missing face drawing data:', { storedFace: !!storedFace, attemptFace: !!attemptFace });
            return { score: 0, error: 'Missing face drawing data' };
        }

        // Handle different data structures
        let storedStrokes = storedFace.strokes || storedFace.raw || storedFace.data || [];
        let attemptStrokes = attemptFace.strokes || attemptFace.raw || attemptFace.data || [];
        
        // If the data is stored as a string, try to parse it
        if (typeof storedStrokes === 'string') {
            try {
                storedStrokes = JSON.parse(storedStrokes);
            } catch (e) {
                console.warn('Failed to parse stored strokes:', e);
                storedStrokes = [];
            }
        }
        if (typeof attemptStrokes === 'string') {
            try {
                attemptStrokes = JSON.parse(attemptStrokes);
            } catch (e) {
                console.warn('Failed to parse attempt strokes:', e);
                attemptStrokes = [];
            }
        }
        
        // Handle case where strokes might be stored as a JSON string in the database
        if (Array.isArray(storedStrokes) && storedStrokes.length > 0 && typeof storedStrokes[0] === 'string') {
            try {
                storedStrokes = storedStrokes.map(stroke => JSON.parse(stroke));
            } catch (e) {
                console.warn('Failed to parse stored stroke strings:', e);
                storedStrokes = [];
            }
        }
        if (Array.isArray(attemptStrokes) && attemptStrokes.length > 0 && typeof attemptStrokes[0] === 'string') {
            try {
                attemptStrokes = attemptStrokes.map(stroke => JSON.parse(stroke));
            } catch (e) {
                console.warn('Failed to parse attempt stroke strings:', e);
                attemptStrokes = [];
            }
        }

        // Ensure we have valid arrays after parsing
        if (!Array.isArray(storedStrokes)) {
            console.warn('Invalid stored strokes data after parsing:', typeof storedStrokes);
            storedStrokes = [];
        }
        if (!Array.isArray(attemptStrokes)) {
            console.warn('Invalid attempt strokes data after parsing:', typeof attemptStrokes);
            attemptStrokes = [];
        }

        // Normalize stroke data to consistent format
        const normalizedStoredStrokes = normalizeStrokeData(storedStrokes);
        const normalizedAttemptStrokes = normalizeStrokeData(attemptStrokes);
        
        const storedPoints = extractKeyPoints(normalizedStoredStrokes);
        const attemptPoints = extractKeyPoints(normalizedAttemptStrokes);
        
        // Basic metrics with safety checks
        const strokeCountScore = normalizedStoredStrokes.length === 0 || normalizedAttemptStrokes.length === 0 ? 0 :
            1 - Math.abs(normalizedStoredStrokes.length - normalizedAttemptStrokes.length) / Math.max(normalizedStoredStrokes.length, normalizedAttemptStrokes.length);
        
        const pointCountScore = storedPoints.length === 0 || attemptPoints.length === 0 ? 0 :
            1 - Math.abs(storedPoints.length - attemptPoints.length) / Math.max(storedPoints.length, attemptPoints.length);
        
        // Bounding box comparison
        const storedBounds = calculateBoundingBox(storedPoints);
        const attemptBounds = calculateBoundingBox(attemptPoints);
        const sizeScore = storedBounds.width === 0 || attemptBounds.width === 0 ? 0 :
            1 - Math.abs((storedBounds.width * storedBounds.height) - (attemptBounds.width * attemptBounds.height)) / 
                Math.max(storedBounds.width * storedBounds.height, attemptBounds.width * attemptBounds.height);
        
        // Feature detection (simplified - checks for eye-like and mouth-like patterns)
        const storedFeatures = detectFaceFeatures(normalizedStoredStrokes);
        const attemptFeatures = detectFaceFeatures(normalizedAttemptStrokes);
        const featureScore = compareFeatures(storedFeatures, attemptFeatures);
        
        // Weighted average
        const score = (strokeCountScore * 0.2 + pointCountScore * 0.2 + sizeScore * 0.3 + featureScore * 0.3) * 100;
        
        return {
            score: Math.round(score),
            details: {
                strokeCount: { stored: normalizedStoredStrokes.length, attempt: normalizedAttemptStrokes.length },
                pointCount: { stored: storedPoints.length, attempt: attemptPoints.length },
                features: { stored: storedFeatures, attempt: attemptFeatures }
            }
        };
    } catch (error) {
        console.error('Error comparing face drawings:', error);
        return { score: 0, error: error.message };
    }
}

// Compare star drawings
async function compareStarDrawings(storedStar, attemptStar) {
    try {
        // Ensure both objects have strokes property
        if (!storedStar || !attemptStar) {
            console.warn('Missing star drawing data:', { storedStar: !!storedStar, attemptStar: !!attemptStar });
            return { score: 0, error: 'Missing star drawing data' };
        }

        // Handle different data structures
        let storedStrokes = storedStar.strokes || storedStar.raw || storedStar.data || [];
        let attemptStrokes = attemptStar.strokes || attemptStar.raw || attemptStar.data || [];
        
        // If the data is stored as a string, try to parse it
        if (typeof storedStrokes === 'string') {
            try {
                storedStrokes = JSON.parse(storedStrokes);
            } catch (e) {
                console.warn('Failed to parse stored star strokes:', e);
                storedStrokes = [];
            }
        }
        if (typeof attemptStrokes === 'string') {
            try {
                attemptStrokes = JSON.parse(attemptStrokes);
            } catch (e) {
                console.warn('Failed to parse attempt star strokes:', e);
                attemptStrokes = [];
            }
        }
        
        // Handle case where strokes might be stored as a JSON string in the database
        if (Array.isArray(storedStrokes) && storedStrokes.length > 0 && typeof storedStrokes[0] === 'string') {
            try {
                storedStrokes = storedStrokes.map(stroke => JSON.parse(stroke));
            } catch (e) {
                console.warn('Failed to parse stored star stroke strings:', e);
                storedStrokes = [];
            }
        }
        if (Array.isArray(attemptStrokes) && attemptStrokes.length > 0 && typeof attemptStrokes[0] === 'string') {
            try {
                attemptStrokes = attemptStrokes.map(stroke => JSON.parse(stroke));
            } catch (e) {
                console.warn('Failed to parse attempt star stroke strings:', e);
                attemptStrokes = [];
            }
        }

        // Ensure we have valid arrays after parsing
        if (!Array.isArray(storedStrokes)) {
            console.warn('Invalid stored star strokes data after parsing:', typeof storedStrokes);
            storedStrokes = [];
        }
        if (!Array.isArray(attemptStrokes)) {
            console.warn('Invalid attempt star strokes data after parsing:', typeof attemptStrokes);
            attemptStrokes = [];
        }

        // Normalize stroke data to consistent format
        const normalizedStoredStrokes = normalizeStrokeData(storedStrokes);
        const normalizedAttemptStrokes = normalizeStrokeData(attemptStrokes);
        
        const storedPoints = extractKeyPoints(normalizedStoredStrokes);
        const attemptPoints = extractKeyPoints(normalizedAttemptStrokes);
        
        // Detect star points
        const storedStarPoints = detectStarPoints(storedPoints);
        const attemptStarPoints = detectStarPoints(attemptPoints);
        
        // Point count comparison
        const pointCountScore = storedStarPoints.length === attemptStarPoints.length ? 1 : 
                               Math.max(0, 1 - Math.abs(storedStarPoints.length - attemptStarPoints.length) * 0.2);
        
        // Symmetry analysis
        const storedSymmetry = calculateStarSymmetry(storedStarPoints);
        const attemptSymmetry = calculateStarSymmetry(attemptStarPoints);
        const symmetryScore = 1 - Math.abs(storedSymmetry - attemptSymmetry);
        
        // Size comparison
        const storedSize = calculateStarSize(storedStarPoints);
        const attemptSize = calculateStarSize(attemptStarPoints);
        const sizeScore = 1 - Math.abs(storedSize - attemptSize) / Math.max(storedSize, attemptSize);
        
        // Weighted average
        const score = (pointCountScore * 0.4 + symmetryScore * 0.3 + sizeScore * 0.3) * 100;
        
        return {
            score: Math.round(score),
            details: {
                pointCount: { stored: storedStarPoints.length, attempt: attemptStarPoints.length },
                symmetry: { stored: storedSymmetry, attempt: attemptSymmetry }
            }
        };
    } catch (error) {
        console.error('Error comparing star drawings:', error);
        return { score: 0, error: error.message };
    }
}

// Compare house drawings
async function compareHouseDrawings(storedHouse, attemptHouse) {
    try {
        // Handle different data structures
        let storedStrokes = storedHouse.strokes || storedHouse.raw || storedHouse.data || [];
        let attemptStrokes = attemptHouse.strokes || attemptHouse.raw || attemptHouse.data || [];
        
        // If the data is stored as a string, try to parse it
        if (typeof storedStrokes === 'string') {
            try {
                storedStrokes = JSON.parse(storedStrokes);
            } catch (e) {
                console.warn('Failed to parse stored house strokes:', e);
                storedStrokes = [];
            }
        }
        if (typeof attemptStrokes === 'string') {
            try {
                attemptStrokes = JSON.parse(attemptStrokes);
            } catch (e) {
                console.warn('Failed to parse attempt house strokes:', e);
                attemptStrokes = [];
            }
        }
        
        // Handle case where strokes might be stored as a JSON string in the database
        if (Array.isArray(storedStrokes) && storedStrokes.length > 0 && typeof storedStrokes[0] === 'string') {
            try {
                storedStrokes = storedStrokes.map(stroke => JSON.parse(stroke));
            } catch (e) {
                console.warn('Failed to parse stored house stroke strings:', e);
                storedStrokes = [];
            }
        }
        if (Array.isArray(attemptStrokes) && attemptStrokes.length > 0 && typeof attemptStrokes[0] === 'string') {
            try {
                attemptStrokes = attemptStrokes.map(stroke => JSON.parse(stroke));
            } catch (e) {
                console.warn('Failed to parse attempt house stroke strings:', e);
                attemptStrokes = [];
            }
        }
        
        // Normalize stroke data to consistent format
        const normalizedStoredStrokes = normalizeStrokeData(storedStrokes);
        const normalizedAttemptStrokes = normalizeStrokeData(attemptStrokes);
        
        const storedComponents = detectHouseComponents(normalizedStoredStrokes);
        const attemptComponents = detectHouseComponents(normalizedAttemptStrokes);
        
        // Component presence comparison
        const componentScore = compareHouseComponents(storedComponents, attemptComponents);
        
        // Proportion comparison
        const storedProportions = calculateHouseProportions(storedComponents);
        const attemptProportions = calculateHouseProportions(attemptComponents);
        const proportionScore = compareProportions(storedProportions, attemptProportions);
        
        // Structure similarity
        const structureScore = compareHouseStructure(normalizedStoredStrokes, normalizedAttemptStrokes);
        
        // Weighted average
        const score = (componentScore * 0.4 + proportionScore * 0.3 + structureScore * 0.3) * 100;
        
        return {
            score: Math.round(score),
            details: {
                components: { stored: storedComponents, attempt: attemptComponents },
                proportions: { stored: storedProportions, attempt: attemptProportions }
            }
        };
    } catch (error) {
        console.error('Error comparing house drawings:', error);
        return { score: 0, error: error.message };
    }
}

// Compare connect-dots drawings
async function compareConnectDotsDrawings(storedDots, attemptDots) {
    try {
        // Handle different data structures
        let storedStrokes = storedDots.strokes || storedDots.raw || storedDots.data || [];
        let attemptStrokes = attemptDots.strokes || attemptDots.raw || attemptDots.data || [];
        
        // If the data is stored as a string, try to parse it
        if (typeof storedStrokes === 'string') {
            try {
                storedStrokes = JSON.parse(storedStrokes);
            } catch (e) {
                console.warn('Failed to parse stored dots strokes:', e);
                storedStrokes = [];
            }
        }
        if (typeof attemptStrokes === 'string') {
            try {
                attemptStrokes = JSON.parse(attemptStrokes);
            } catch (e) {
                console.warn('Failed to parse attempt dots strokes:', e);
                attemptStrokes = [];
            }
        }
        
        // Handle case where strokes might be stored as a JSON string in the database
        if (Array.isArray(storedStrokes) && storedStrokes.length > 0 && typeof storedStrokes[0] === 'string') {
            try {
                storedStrokes = storedStrokes.map(stroke => JSON.parse(stroke));
            } catch (e) {
                console.warn('Failed to parse stored dots stroke strings:', e);
                storedStrokes = [];
            }
        }
        if (Array.isArray(attemptStrokes) && attemptStrokes.length > 0 && typeof attemptStrokes[0] === 'string') {
            try {
                attemptStrokes = attemptStrokes.map(stroke => JSON.parse(stroke));
            } catch (e) {
                console.warn('Failed to parse attempt dots stroke strings:', e);
                attemptStrokes = [];
            }
        }
        
        // Normalize stroke data to consistent format
        const normalizedStoredStrokes = normalizeStrokeData(storedStrokes);
        const normalizedAttemptStrokes = normalizeStrokeData(attemptStrokes);
        
        const storedPath = extractConnectPath(normalizedStoredStrokes);
        const attemptPath = extractConnectPath(normalizedAttemptStrokes);
        
        // Path order comparison
        const orderScore = comparePathOrder(storedPath, attemptPath);
        
        // Path efficiency comparison
        const storedEfficiency = calculatePathEfficiency(storedPath);
        const attemptEfficiency = calculatePathEfficiency(attemptPath);
        const efficiencyScore = 1 - Math.abs(storedEfficiency - attemptEfficiency) / Math.max(storedEfficiency, attemptEfficiency);
        
        // Pattern accuracy
        const patternScore = comparePatternAccuracy(storedPath, attemptPath);
        
        // Weighted average
        const score = (orderScore * 0.4 + efficiencyScore * 0.3 + patternScore * 0.3) * 100;
        
        return {
            score: Math.round(score),
            details: {
                pathLength: { stored: storedPath.length, attempt: attemptPath.length },
                efficiency: { stored: storedEfficiency, attempt: attemptEfficiency }
            }
        };
    } catch (error) {
        console.error('Error comparing connect-dots drawings:', error);
        return { score: 0, error: error.message };
    }
}

// Helper functions

// Normalize stroke data to handle different formats
function normalizeStrokeData(strokes) {
    if (!Array.isArray(strokes)) {
        console.warn('normalizeStrokeData: strokes is not an array:', typeof strokes);
        return [];
    }
    
    return strokes.map((stroke, index) => {
        // Handle SignaturePad v4 format: stroke is an object with points array
        if (stroke && typeof stroke === 'object' && stroke.points && Array.isArray(stroke.points)) {
            return stroke.points;
        }
        // Handle legacy format: stroke is directly an array of points
        else if (Array.isArray(stroke)) {
            return stroke;
        }
        // Handle case where stroke might be a single point object
        else if (stroke && typeof stroke === 'object' && (stroke.x !== undefined || stroke.y !== undefined)) {
            return [stroke];
        }
        else {
            console.warn(`normalizeStrokeData: stroke ${index} has unsupported format:`, typeof stroke, stroke);
            return [];
        }
    });
}

function calculateBoundingBox(points) {
    if (!points || points.length === 0) return { width: 0, height: 0 };
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    });
    
    return {
        width: maxX - minX,
        height: maxY - minY,
        minX, maxX, minY, maxY
    };
}

function detectFaceFeatures(strokes) {
    // Simplified feature detection - looks for circular patterns (eyes) and curved lines (mouth)
    const features = {
        eyeCount: 0,
        hasNose: false,
        hasMouth: false
    };
    
    strokes.forEach(stroke => {
        // After normalization, strokes should be arrays of points
        if (Array.isArray(stroke)) {
            if (isCircularStroke(stroke)) {
                features.eyeCount++;
            } else if (isCurvedLine(stroke)) {
                features.hasMouth = true;
            }
        }
    });
    
    return features;
}

function isCircularStroke(stroke) {
    if (stroke.length < 10) return false;
    const first = stroke[0];
    const last = stroke[stroke.length - 1];
    const dist = distance(first, last);
    const pathLength = calculatePathLength(stroke);
    return dist < pathLength * 0.2; // Closed loop
}

function isCurvedLine(stroke) {
    if (stroke.length < 5) return false;
    // Check if middle points deviate from straight line between endpoints
    const first = stroke[0];
    const last = stroke[stroke.length - 1];
    const middle = stroke[Math.floor(stroke.length / 2)];
    const straightDist = distance(first, last);
    const curvedDist = distance(first, middle) + distance(middle, last);
    return curvedDist > straightDist * 1.1;
}

function calculatePathLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        length += distance(points[i - 1], points[i]);
    }
    return length;
}

function compareFeatures(features1, features2) {
    let score = 0;
    if (features1.eyeCount === features2.eyeCount) score += 0.4;
    else score += 0.4 * (1 - Math.abs(features1.eyeCount - features2.eyeCount) / 4);
    
    if (features1.hasMouth === features2.hasMouth) score += 0.3;
    if (features1.hasNose === features2.hasNose) score += 0.3;
    
    return score;
}

function detectStarPoints(points) {
    // Find extrema points that form the star tips
    const center = calculateCentroid(points);
    const extrema = [];
    
    // Simple approach: find points furthest from center in different directions
    const angles = [];
    points.forEach(p => {
        const a = Math.atan2(p.y - center.y, p.x - center.x);
        const d = distance(p, center);
        angles.push({ angle: a, distance: d, point: p });
    });
    
    // Sort by angle and find peaks
    angles.sort((a, b) => a.angle - b.angle);
    
    // Find local maxima in distance
    for (let i = 0; i < angles.length; i++) {
        const prev = angles[(i - 1 + angles.length) % angles.length];
        const curr = angles[i];
        const next = angles[(i + 1) % angles.length];
        
        if (curr.distance > prev.distance * 0.8 && curr.distance > next.distance * 0.8) {
            extrema.push(curr.point);
        }
    }
    
    return extrema;
}

function calculateCentroid(points) {
    const sum = points.reduce((acc, p) => ({
        x: acc.x + p.x,
        y: acc.y + p.y
    }), { x: 0, y: 0 });
    
    return {
        x: sum.x / points.length,
        y: sum.y / points.length
    };
}

function calculateStarSymmetry(starPoints) {
    if (starPoints.length < 3) return 0;
    
    const center = calculateCentroid(starPoints);
    const distances = starPoints.map(p => distance(p, center));
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((acc, d) => acc + Math.pow(d - avgDistance, 2), 0) / distances.length;
    
    return 1 - (Math.sqrt(variance) / avgDistance);
}

function calculateStarSize(starPoints) {
    const bounds = calculateBoundingBox(starPoints);
    return Math.sqrt(bounds.width * bounds.height);
}

function detectHouseComponents(strokes) {
    const components = {
        hasRoof: false,
        hasDoor: false,
        windowCount: 0,
        hasChimney: false
    };
    
    strokes.forEach(stroke => {
        // After normalization, strokes should be arrays of points
        if (Array.isArray(stroke)) {
            if (isTriangularShape(stroke)) {
                components.hasRoof = true;
            } else if (isRectangularShape(stroke)) {
                const bounds = calculateBoundingBox(stroke);
                if (bounds.height > bounds.width * 1.5) {
                    components.hasDoor = true;
                } else {
                    components.windowCount++;
                }
            }
        }
    });
    
    return components;
}

function isTriangularShape(stroke) {
    // Simplified check - looks for 3 main direction changes
    if (stroke.length < 10) return false;
    
    let directionChanges = 0;
    let lastDirection = null;
    
    for (let i = 1; i < stroke.length; i++) {
        const direction = Math.atan2(stroke[i].y - stroke[i-1].y, stroke[i].x - stroke[i-1].x);
        if (lastDirection !== null && Math.abs(direction - lastDirection) > Math.PI / 4) {
            directionChanges++;
        }
        lastDirection = direction;
    }
    
    return directionChanges >= 2 && directionChanges <= 4;
}

function isRectangularShape(stroke) {
    // Check for ~4 right angles
    if (stroke.length < 10) return false;
    
    let rightAngles = 0;
    for (let i = 2; i < stroke.length; i++) {
        const a = angle(stroke[i-2], stroke[i-1], stroke[i]);
        if (Math.abs(a - 90) < 20) rightAngles++;
    }
    
    return rightAngles >= 3;
}

function compareHouseComponents(comp1, comp2) {
    let score = 0;
    if (comp1.hasRoof === comp2.hasRoof) score += 0.3;
    if (comp1.hasDoor === comp2.hasDoor) score += 0.3;
    if (comp1.hasChimney === comp2.hasChimney) score += 0.1;
    
    const windowDiff = Math.abs(comp1.windowCount - comp2.windowCount);
    score += 0.3 * Math.max(0, 1 - windowDiff * 0.3);
    
    return score;
}

function calculateHouseProportions(components) {
    // Simplified proportions based on component presence
    return {
        roofToBodyRatio: components.hasRoof ? 0.3 : 0,
        doorToBodyRatio: components.hasDoor ? 0.2 : 0,
        windowSymmetry: components.windowCount >= 2 ? 0.8 : 0.5
    };
}

function compareProportions(prop1, prop2) {
    const roofDiff = Math.abs(prop1.roofToBodyRatio - prop2.roofToBodyRatio);
    const doorDiff = Math.abs(prop1.doorToBodyRatio - prop2.doorToBodyRatio);
    const windowDiff = Math.abs(prop1.windowSymmetry - prop2.windowSymmetry);
    
    return 1 - (roofDiff + doorDiff + windowDiff) / 3;
}

function compareHouseStructure(strokes1, strokes2) {
    // Compare overall structure similarity
    const points1 = extractKeyPoints(strokes1);
    const points2 = extractKeyPoints(strokes2);
    
    const bounds1 = calculateBoundingBox(points1);
    const bounds2 = calculateBoundingBox(points2);
    
    const aspectRatio1 = bounds1.width / bounds1.height;
    const aspectRatio2 = bounds2.width / bounds2.height;
    
    return 1 - Math.abs(aspectRatio1 - aspectRatio2) / Math.max(aspectRatio1, aspectRatio2);
}

function extractConnectPath(strokes) {
    // Extract the connection order from strokes
    const path = [];
    strokes.forEach(stroke => {
        // After normalization, strokes should be arrays of points
        if (Array.isArray(stroke) && stroke.length > 0) {
            path.push(stroke[0]); // Start point of each stroke
        }
    });
    return path;
}

function comparePathOrder(path1, path2) {
    if (path1.length !== path2.length) {
        return Math.max(0, 1 - Math.abs(path1.length - path2.length) * 0.1);
    }
    
    // Compare the sequence of connections
    let matchScore = 0;
    for (let i = 0; i < path1.length; i++) {
        // Check if points are in similar positions
        const dist = distance(path1[i], path2[i]);
        const maxDist = Math.max(
            calculateBoundingBox(path1).width,
            calculateBoundingBox(path1).height
        );
        matchScore += 1 - Math.min(dist / maxDist, 1);
    }
    
    return matchScore / path1.length;
}

function calculatePathEfficiency(path) {
    if (path.length < 2) return 1;
    
    const totalLength = calculatePathLength(path);
    const optimalLength = calculateOptimalPathLength(path);
    
    return optimalLength / totalLength;
}

function calculateOptimalPathLength(points) {
    // Calculate minimum spanning tree length (simplified)
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        totalLength += distance(points[i-1], points[i]);
    }
    return totalLength;
}

function comparePatternAccuracy(path1, path2) {
    // Compare the overall pattern shape
    const shape1 = normalizeShape(path1);
    const shape2 = normalizeShape(path2);
    
    let similarity = 0;
    const minLen = Math.min(shape1.length, shape2.length);
    
    for (let i = 0; i < minLen; i++) {
        const dist = distance(shape1[i], shape2[i]);
        similarity += 1 - Math.min(dist / 100, 1);
    }
    
    return similarity / minLen;
}

function normalizeShape(points) {
    if (points.length === 0) return [];
    
    const bounds = calculateBoundingBox(points);
    const scale = Math.max(bounds.width, bounds.height);
    
    return points.map(p => ({
        x: (p.x - bounds.minX) / scale * 100,
        y: (p.y - bounds.minY) / scale * 100
    }));
}

// Debug function to log drawing data structure
function debugDrawingData(drawing, label) {
    console.log(`=== ${label} Drawing Data ===`);
    console.log('Type:', typeof drawing);
    console.log('Keys:', drawing ? Object.keys(drawing) : 'null');
    
    if (drawing && drawing.strokes) {
        console.log('Strokes type:', typeof drawing.strokes);
        console.log('Strokes is array:', Array.isArray(drawing.strokes));
        if (Array.isArray(drawing.strokes) && drawing.strokes.length > 0) {
            console.log('First stroke type:', typeof drawing.strokes[0]);
            console.log('First stroke keys:', drawing.strokes[0] ? Object.keys(drawing.strokes[0]) : 'null');
            if (drawing.strokes[0] && drawing.strokes[0].points) {
                console.log('First stroke points type:', typeof drawing.strokes[0].points);
                console.log('First stroke points is array:', Array.isArray(drawing.strokes[0].points));
                if (Array.isArray(drawing.strokes[0].points) && drawing.strokes[0].points.length > 0) {
                    console.log('First point:', drawing.strokes[0].points[0]);
                }
            }
        }
    }
    console.log('========================');
}

// Main comparison function
async function compareDrawings(storedDrawing, attemptDrawing, drawingType) {
    // Debug the data structures
    debugDrawingData(storedDrawing, 'Stored');
    debugDrawingData(attemptDrawing, 'Attempt');
    
    switch (drawingType) {
        case 'face':
            return await compareFaceDrawings(storedDrawing, attemptDrawing);
        case 'star':
            return await compareStarDrawings(storedDrawing, attemptDrawing);
        case 'house':
            return await compareHouseDrawings(storedDrawing, attemptDrawing);
        case 'connect_dots':
            return await compareConnectDotsDrawings(storedDrawing, attemptDrawing);
        default:
            return { score: 0, error: 'Unknown drawing type' };
    }
}

module.exports = {
    compareDrawings,
    compareFaceDrawings,
    compareStarDrawings,
    compareHouseDrawings,
    compareConnectDotsDrawings
};