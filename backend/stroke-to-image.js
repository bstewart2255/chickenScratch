const { createCanvas } = require('canvas');

/**
 * Generate a base64 image from stroke data
 * This allows us to create images on-demand from stored stroke data
 */
function generateImageFromStrokes(strokeData, options = {}) {
    const {
        width = 400,
        height = 200,
        backgroundColor = 'white',
        strokeColor = 'black',
        strokeWidth = 2,
        padding = 20
    } = options;
    
    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Set background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    
    if (!strokeData || !Array.isArray(strokeData) || strokeData.length === 0) {
        // Return empty image
        return canvas.toDataURL('image/png');
    }
    
    // Calculate bounds for proper scaling
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    // Find bounding box
    strokeData.forEach(stroke => {
        if (stroke.points && Array.isArray(stroke.points)) {
            stroke.points.forEach(point => {
                if (typeof point.x === 'number' && typeof point.y === 'number') {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                }
            });
        } else if (Array.isArray(stroke)) {
            // Handle array format
            stroke.forEach(point => {
                if (typeof point.x === 'number' && typeof point.y === 'number') {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                }
            });
        }
    });
    
    // If no valid points found, return empty image
    if (minX === Infinity || maxX === -Infinity) {
        return canvas.toDataURL('image/png');
    }
    
    // Calculate scale to fit canvas with padding
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    const scaleX = (width - 2 * padding) / contentWidth;
    const scaleY = (height - 2 * padding) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
    
    // Calculate offset to center
    const offsetX = (width - contentWidth * scale) / 2;
    const offsetY = (height - contentHeight * scale) / 2;
    
    // Draw strokes
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    strokeData.forEach(stroke => {
        let points = [];
        
        if (stroke.points && Array.isArray(stroke.points)) {
            points = stroke.points;
        } else if (Array.isArray(stroke)) {
            points = stroke;
        }
        
        if (points.length === 0) return;
        
        ctx.beginPath();
        points.forEach((point, index) => {
            if (typeof point.x === 'number' && typeof point.y === 'number') {
                const x = (point.x - minX) * scale + offsetX;
                const y = (point.y - minY) * scale + offsetY;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
        });
        ctx.stroke();
    });
    
    return canvas.toDataURL('image/png');
}

/**
 * Generate a compressed image (JPEG) for display purposes
 */
function generateCompressedImage(strokeData, options = {}) {
    const {
        width = 300,
        height = 150,
        quality = 0.8
    } = options;
    
    const base64Image = generateImageFromStrokes(strokeData, { width, height });
    
    // Convert base64 to buffer
    const base64Data = base64Image.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // For now, return the PNG base64 (you could add JPEG conversion here)
    return base64Image;
}

/**
 * Generate a thumbnail image for preview
 */
function generateThumbnail(strokeData, options = {}) {
    return generateImageFromStrokes(strokeData, {
        width: 100,
        height: 50,
        strokeWidth: 1,
        padding: 5,
        ...options
    });
}

/**
 * Extract basic metrics from stroke data
 */
function extractStrokeMetrics(strokeData) {
    if (!strokeData || !Array.isArray(strokeData)) {
        return null;
    }
    
    let totalPoints = 0;
    let totalLength = 0;
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    strokeData.forEach(stroke => {
        let points = [];
        
        if (stroke.points && Array.isArray(stroke.points)) {
            points = stroke.points;
        } else if (Array.isArray(stroke)) {
            points = stroke;
        }
        
        totalPoints += points.length;
        
        points.forEach((point, index) => {
            if (typeof point.x === 'number' && typeof point.y === 'number') {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
                
                // Calculate length
                if (index > 0) {
                    const prevPoint = points[index - 1];
                    const dx = point.x - prevPoint.x;
                    const dy = point.y - prevPoint.y;
                    totalLength += Math.sqrt(dx * dx + dy * dy);
                }
            }
        });
    });
    
    return {
        strokeCount: strokeData.length,
        totalPoints,
        totalLength,
        width: maxX - minX,
        height: maxY - minY,
        area: (maxX - minX) * (maxY - minY)
    };
}

/**
 * Convert stroke data to SVG format
 */
function generateSVGFromStrokes(strokeData, options = {}) {
    const {
        width = 400,
        height = 200,
        backgroundColor = 'white',
        strokeColor = 'black',
        strokeWidth = 2,
        padding = 20
    } = options;
    
    if (!strokeData || !Array.isArray(strokeData) || strokeData.length === 0) {
        return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="${backgroundColor}"/>
        </svg>`;
    }
    
    // Calculate bounds (same as image generation)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    strokeData.forEach(stroke => {
        if (Array.isArray(stroke)) {
            stroke.forEach(point => {
                if (point.x !== undefined && point.y !== undefined) {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                }
            });
        }
    });
    
    if (minX === Infinity || minY === Infinity) {
        return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="${backgroundColor}"/>
        </svg>`;
    }
    
    // Calculate scale and offset
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const scaleX = (width - 2 * padding) / contentWidth;
    const scaleY = (height - 2 * padding) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    
    const offsetX = (width - contentWidth * scale) / 2 - minX * scale;
    const offsetY = (height - contentHeight * scale) / 2 - minY * scale;
    
    // Generate SVG paths
    const paths = strokeData.map(stroke => {
        if (Array.isArray(stroke) && stroke.length > 0) {
            const points = stroke
                .filter(point => point.x !== undefined && point.y !== undefined)
                .map(point => {
                    const x = point.x * scale + offsetX;
                    const y = point.y * scale + offsetY;
                    return `${x},${y}`;
                });
            
            if (points.length > 0) {
                return `M ${points.join(' L ')}`;
            }
        }
        return '';
    }).filter(path => path.length > 0);
    
    const pathData = paths.join(' ');
    
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${backgroundColor}"/>
        <path d="${pathData}" stroke="${strokeColor}" stroke-width="${strokeWidth}" 
              fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

/**
 * Get stroke data statistics
 */
function getStrokeDataStats(strokeData) {
    if (!strokeData || !Array.isArray(strokeData)) {
        return null;
    }
    
    let totalPoints = 0;
    let totalLength = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    strokeData.forEach(stroke => {
        if (Array.isArray(stroke)) {
            totalPoints += stroke.length;
            
            stroke.forEach((point, index) => {
                if (point.x !== undefined && point.y !== undefined) {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                    
                    // Calculate stroke length
                    if (index > 0) {
                        const prevPoint = stroke[index - 1];
                        if (prevPoint.x !== undefined && prevPoint.y !== undefined) {
                            const dx = point.x - prevPoint.x;
                            const dy = point.y - prevPoint.y;
                            totalLength += Math.sqrt(dx * dx + dy * dy);
                        }
                    }
                }
            });
        }
    });
    
    return {
        strokeCount: strokeData.length,
        totalPoints,
        totalLength,
        bounds: {
            minX: minX === Infinity ? 0 : minX,
            minY: minY === Infinity ? 0 : minY,
            maxX: maxX === -Infinity ? 0 : maxX,
            maxY: maxY === -Infinity ? 0 : maxY,
            width: maxX - minX,
            height: maxY - minY
        }
    };
}

/**
 * API endpoint helper to serve images from stroke data
 */
function createImageEndpoint(app) {
    app.get('/api/signature/:id/image', async (req, res) => {
        try {
            const { id } = req.params;
            const { format = 'png', size = 'normal' } = req.query;
            
            // Get stroke data from database
            const result = await pool.query(
                'SELECT stroke_data FROM signatures WHERE id = $1',
                [id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Signature not found' });
            }
            
            const strokeData = result.rows[0].stroke_data;
            
            if (!strokeData) {
                return res.status(404).json({ error: 'No stroke data available' });
            }
            
            // Generate image based on format
            if (format === 'svg') {
                const svg = generateSVGFromStrokes(strokeData, {
                    width: size === 'thumb' ? 100 : 400,
                    height: size === 'thumb' ? 100 : 200
                });
                
                res.setHeader('Content-Type', 'image/svg+xml');
                res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
                return res.send(svg);
            } else {
                const imageData = generateImageFromStrokes(strokeData, {
                    width: size === 'thumb' ? 100 : 400,
                    height: size === 'thumb' ? 100 : 200
                });
                
                // Convert base64 to buffer
                const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
                return res.send(buffer);
            }
            
        } catch (error) {
            console.error('Error generating signature image:', error);
            res.status(500).json({ error: 'Failed to generate image' });
        }
    });
}

module.exports = {
    generateImageFromStrokes,
    generateCompressedImage,
    generateThumbnail,
    extractStrokeMetrics,
    generateSVGFromStrokes,
    getStrokeDataStats
}; 