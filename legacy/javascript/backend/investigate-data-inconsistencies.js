require('dotenv').config();
const pool = require('./db');

async function investigateDataInconsistencies() {
    console.log('\n=== DATA INCONSISTENCY INVESTIGATION ===\n');

    try {
        // 1. Data Format Distribution Analysis
        console.log('1. DATA FORMAT DISTRIBUTION ANALYSIS');
        console.log('------------------------------------');
        
        const dataFormatQuery = `
            SELECT 
                'signatures' as table_name,
                data_format,
                COUNT(*) as count,
                MIN(created_at) as earliest,
                MAX(created_at) as latest
            FROM signatures 
            WHERE data_format IS NOT NULL
            GROUP BY data_format
            UNION ALL
            SELECT 
                'shapes' as table_name,
                data_format,
                COUNT(*) as count,
                MIN(created_at) as earliest,
                MAX(created_at) as latest
            FROM shapes 
            WHERE data_format IS NOT NULL
            GROUP BY data_format
            ORDER BY table_name, data_format;
        `;
        
        const formatResults = await pool.query(dataFormatQuery);
        console.log('Data Format Distribution:');
        console.table(formatResults.rows);

        // Check actual data structure vs data_format field
        console.log('\n2. ACTUAL DATA STRUCTURE VS DATA_FORMAT FIELD');
        console.log('----------------------------------------------');
        
        const structureCheckQuery = `
            WITH signature_samples AS (
                SELECT 
                    id,
                    data_format,
                    CASE 
                        WHEN signature_data IS NOT NULL AND jsonb_typeof(signature_data) = 'array' THEN 'JSONB array'
                        WHEN signature_data IS NOT NULL THEN 'JSONB other'
                        ELSE 'NULL'
                    END as actual_structure,
                    CASE 
                        WHEN signature_data IS NOT NULL THEN LEFT(signature_data::text, 100)
                        ELSE 'NULL'
                    END as data_preview
                FROM signatures
                LIMIT 5
            ),
            shape_samples AS (
                SELECT 
                    id,
                    data_format,
                    CASE 
                        WHEN shape_data IS NOT NULL AND jsonb_typeof(shape_data) = 'object' THEN 'JSONB object'
                        WHEN shape_data IS NOT NULL THEN 'JSONB other'
                        ELSE 'NULL'
                    END as actual_structure,
                    CASE 
                        WHEN shape_data IS NOT NULL THEN LEFT(shape_data::text, 100)
                        ELSE 'NULL'
                    END as data_preview
                FROM shapes
                LIMIT 5
            )
            SELECT 'signature' as type, * FROM signature_samples
            UNION ALL
            SELECT 'shape' as type, * FROM shape_samples;
        `;
        
        const structureResults = await pool.query(structureCheckQuery);
        console.log('Sample Data Structures:');
        structureResults.rows.forEach(row => {
            console.log(`\n${row.type} (ID: ${row.id})`);
            console.log(`  data_format: ${row.data_format}`);
            console.log(`  actual_structure: ${row.actual_structure}`);
            console.log(`  data_preview: ${row.data_preview}...`);
        });

        // 3. Pressure Data Analysis
        console.log('\n3. PRESSURE DATA ANALYSIS');
        console.log('-------------------------');
        
        const pressureQuery = `
            WITH signature_pressure AS (
                SELECT 
                    COUNT(*) as total_signatures,
                    COUNT(CASE WHEN metrics->>'pressure_variation' IS NOT NULL THEN 1 END) as with_pressure_data,
                    AVG((metrics->>'pressure_variation')::float) as avg_pressure_variation,
                    MIN((metrics->>'pressure_variation')::float) as min_pressure_variation,
                    MAX((metrics->>'pressure_variation')::float) as max_pressure_variation
                FROM signatures
            ),
            shape_pressure AS (
                SELECT 
                    COUNT(*) as total_shapes,
                    COUNT(CASE WHEN metrics->>'pressure_variation' IS NOT NULL THEN 1 END) as with_pressure_data,
                    AVG((metrics->>'pressure_variation')::float) as avg_pressure_variation,
                    MIN((metrics->>'pressure_variation')::float) as min_pressure_variation,
                    MAX((metrics->>'pressure_variation')::float) as max_pressure_variation
                FROM shapes
            )
            SELECT 'signatures' as source, * FROM signature_pressure
            UNION ALL
            SELECT 'shapes' as source, * FROM shape_pressure;
        `;
        
        const pressureResults = await pool.query(pressureQuery);
        console.log('Pressure Data Statistics:');
        console.table(pressureResults.rows);

        // Check raw pressure values in stroke data
        console.log('\n4. RAW PRESSURE VALUES IN STROKE DATA');
        console.log('-------------------------------------');
        
        const rawPressureQuery = `
            WITH signature_strokes AS (
                SELECT 
                    id,
                    data_format,
                    CASE 
                        WHEN data_format = 'stroke_data' AND jsonb_typeof(signature_data->'raw') = 'array' 
                        THEN signature_data->'raw'->0->'points'->0->>'pressure'
                        ELSE NULL
                    END as first_point_pressure,
                    CASE 
                        WHEN data_format = 'stroke_data' AND jsonb_typeof(signature_data->'raw') = 'array' 
                        THEN jsonb_array_length(signature_data->'raw')
                        ELSE NULL
                    END as stroke_count
                FROM signatures
                WHERE signature_data IS NOT NULL
                LIMIT 10
            ),
            shape_strokes AS (
                SELECT 
                    id,
                    data_format,
                    CASE 
                        WHEN jsonb_typeof(shape_data->'raw') = 'array' 
                        THEN shape_data->'raw'->0->'points'->0->>'pressure'
                        ELSE NULL
                    END as first_point_pressure,
                    CASE 
                        WHEN jsonb_typeof(shape_data->'raw') = 'array' 
                        THEN jsonb_array_length(shape_data->'raw')
                        ELSE NULL
                    END as stroke_count
                FROM shapes
                WHERE shape_data IS NOT NULL
                LIMIT 10
            )
            SELECT 'signature' as type, * FROM signature_strokes
            UNION ALL
            SELECT 'shape' as type, * FROM shape_strokes;
        `;
        
        const rawPressureResults = await pool.query(rawPressureQuery);
        console.log('Sample Raw Pressure Values:');
        console.table(rawPressureResults.rows);

        // 5. Coordinate Precision Analysis
        console.log('\n5. COORDINATE PRECISION ANALYSIS');
        console.log('--------------------------------');
        
        const coordinateQuery = `
            WITH signature_coords AS (
                SELECT 
                    id,
                    data_format,
                    CASE 
                        WHEN data_format = 'stroke_data' AND jsonb_typeof(signature_data->'raw') = 'array' 
                        THEN signature_data->'raw'->0->'points'->0->>'x'
                        ELSE NULL
                    END as first_x,
                    CASE 
                        WHEN data_format = 'stroke_data' AND jsonb_typeof(signature_data->'raw') = 'array' 
                        THEN signature_data->'raw'->0->'points'->0->>'y'
                        ELSE NULL
                    END as first_y,
                    CASE 
                        WHEN data_format = 'stroke_data' AND signature_data->'raw'->0->'points'->0->>'x' LIKE '%.%' THEN 'decimal'
                        WHEN data_format = 'stroke_data' THEN 'integer'
                        ELSE 'N/A'
                    END as x_precision,
                    CASE 
                        WHEN data_format = 'stroke_data' AND signature_data->'raw'->0->'points'->0->>'y' LIKE '%.%' THEN 'decimal'
                        WHEN data_format = 'stroke_data' THEN 'integer'
                        ELSE 'N/A'
                    END as y_precision
                FROM signatures
                WHERE signature_data IS NOT NULL
                LIMIT 10
            ),
            shape_coords AS (
                SELECT 
                    id,
                    data_format,
                    CASE 
                        WHEN jsonb_typeof(shape_data->'raw') = 'array' 
                        THEN shape_data->'raw'->0->'points'->0->>'x'
                        ELSE NULL
                    END as first_x,
                    CASE 
                        WHEN jsonb_typeof(shape_data->'raw') = 'array' 
                        THEN shape_data->'raw'->0->'points'->0->>'y'
                        ELSE NULL
                    END as first_y,
                    CASE 
                        WHEN shape_data->'raw'->0->'points'->0->>'x' LIKE '%.%' THEN 'decimal'
                        WHEN shape_data->'raw'->0->'points'->0->>'x' IS NOT NULL THEN 'integer'
                        ELSE 'N/A'
                    END as x_precision,
                    CASE 
                        WHEN shape_data->'raw'->0->'points'->0->>'y' LIKE '%.%' THEN 'decimal'
                        WHEN shape_data->'raw'->0->'points'->0->>'y' IS NOT NULL THEN 'integer'
                        ELSE 'N/A'
                    END as y_precision
                FROM shapes
                WHERE shape_data IS NOT NULL
                LIMIT 10
            )
            SELECT 'signature' as type, * FROM signature_coords
            UNION ALL
            SELECT 'shape' as type, * FROM shape_coords;
        `;
        
        const coordinateResults = await pool.query(coordinateQuery);
        console.log('Sample Coordinate Precision:');
        console.table(coordinateResults.rows);

        // 6. Center Point Calculation Analysis
        console.log('\n6. CENTER POINT CALCULATION ANALYSIS');
        console.log('------------------------------------');
        
        const centerPointQuery = `
            WITH shape_metrics AS (
                SELECT 
                    id,
                    metrics->>'width' as width,
                    metrics->>'height' as height,
                    metrics->>'center_x' as center_x,
                    metrics->>'center_y' as center_y,
                    metrics->>'min_x' as min_x,
                    metrics->>'max_x' as max_x,
                    metrics->>'min_y' as min_y,
                    metrics->>'max_y' as max_y,
                    -- Calculate what center should be
                    CASE 
                        WHEN metrics->>'min_x' IS NOT NULL AND metrics->>'max_x' IS NOT NULL 
                        THEN ((metrics->>'min_x')::float + (metrics->>'max_x')::float) / 2
                        ELSE NULL
                    END as calculated_center_x,
                    CASE 
                        WHEN metrics->>'min_y' IS NOT NULL AND metrics->>'max_y' IS NOT NULL 
                        THEN ((metrics->>'min_y')::float + (metrics->>'max_y')::float) / 2
                        ELSE NULL
                    END as calculated_center_y
                FROM shapes
                WHERE metrics IS NOT NULL
                AND metrics->>'center_x' IS NOT NULL
                LIMIT 10
            )
            SELECT 
                id,
                center_x,
                calculated_center_x,
                ABS((center_x)::float - calculated_center_x) as x_difference,
                center_y,
                calculated_center_y,
                ABS((center_y)::float - calculated_center_y) as y_difference,
                min_x,
                max_x,
                min_y,
                max_y
            FROM shape_metrics
            WHERE calculated_center_x IS NOT NULL;
        `;
        
        const centerResults = await pool.query(centerPointQuery);
        console.log('Center Point Calculation Check:');
        console.table(centerResults.rows);

        // 7. Storage Timestamps and Evolution
        console.log('\n7. STORAGE EVOLUTION TIMELINE');
        console.log('-----------------------------');
        
        const timelineQuery = `
            WITH monthly_stats AS (
                SELECT 
                    'signatures' as table_name,
                    DATE_TRUNC('month', created_at) as month,
                    COUNT(*) as count,
                    COUNT(DISTINCT data_format) as distinct_formats,
                    array_agg(DISTINCT data_format) as formats_used
                FROM signatures
                GROUP BY DATE_TRUNC('month', created_at)
                UNION ALL
                SELECT 
                    'shapes' as table_name,
                    DATE_TRUNC('month', created_at) as month,
                    COUNT(*) as count,
                    COUNT(DISTINCT data_format) as distinct_formats,
                    array_agg(DISTINCT data_format) as formats_used
                FROM shapes
                GROUP BY DATE_TRUNC('month', created_at)
            )
            SELECT * FROM monthly_stats
            ORDER BY month DESC, table_name;
        `;
        
        const timelineResults = await pool.query(timelineQuery);
        console.log('Data Evolution Timeline:');
        console.table(timelineResults.rows);

        // 8. Drawing Parameters Comparison
        console.log('\n8. DRAWING PARAMETERS IN METRICS');
        console.log('--------------------------------');
        
        const drawingParamsQuery = `
            WITH signature_params AS (
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN metrics->>'dotSize' IS NOT NULL THEN 1 END) as has_dotSize,
                    COUNT(CASE WHEN metrics->>'minWidth' IS NOT NULL THEN 1 END) as has_minWidth,
                    COUNT(CASE WHEN metrics->>'maxWidth' IS NOT NULL THEN 1 END) as has_maxWidth,
                    COUNT(CASE WHEN metrics->>'velocityFilterWeight' IS NOT NULL THEN 1 END) as has_velocityFilterWeight,
                    AVG((metrics->>'dotSize')::float) as avg_dotSize,
                    AVG((metrics->>'minWidth')::float) as avg_minWidth,
                    AVG((metrics->>'maxWidth')::float) as avg_maxWidth
                FROM signatures
                WHERE metrics IS NOT NULL
            ),
            shape_params AS (
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN metrics->>'dotSize' IS NOT NULL THEN 1 END) as has_dotSize,
                    COUNT(CASE WHEN metrics->>'minWidth' IS NOT NULL THEN 1 END) as has_minWidth,
                    COUNT(CASE WHEN metrics->>'maxWidth' IS NOT NULL THEN 1 END) as has_maxWidth,
                    COUNT(CASE WHEN metrics->>'velocityFilterWeight' IS NOT NULL THEN 1 END) as has_velocityFilterWeight,
                    AVG((metrics->>'dotSize')::float) as avg_dotSize,
                    AVG((metrics->>'minWidth')::float) as avg_minWidth,
                    AVG((metrics->>'maxWidth')::float) as avg_maxWidth
                FROM shapes
                WHERE metrics IS NOT NULL
            )
            SELECT 'signatures' as source, * FROM signature_params
            UNION ALL
            SELECT 'shapes' as source, * FROM shape_params;
        `;
        
        const paramsResults = await pool.query(drawingParamsQuery);
        console.log('Drawing Parameters Comparison:');
        console.table(paramsResults.rows);

    } catch (error) {
        console.error('Error during investigation:', error);
    } finally {
        await pool.end();
    }
}

investigateDataInconsistencies();