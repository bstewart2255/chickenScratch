const axios = require('axios');
const chalk = require('chalk');
const { configService } = require('./src/config/ConfigService');

const API_URL = configService.getApi().baseUrl;
const TEST_USERNAME = process.env.TEST_USER || 'test15';

async function testMLDashboardFixes() {
    console.log(chalk.blue('\n========================================'));
    console.log(chalk.blue('ML Dashboard Critical Issues - Fix Verification'));
    console.log(chalk.blue('========================================\n'));

    try {
        // Test 1: Check if shape and drawing baselines are included in API response
        console.log(chalk.yellow('Test 1: Verifying shape and drawing baseline data in API response...'));
        const response = await axios.get(`${API_URL}/api/user/${TEST_USERNAME}/detailed-analysis`);
        
        const baseline = response.data.baseline;
        const hasShapeBaseline = baseline.shape_features && (
            baseline.shape_features.circle_roundness !== undefined ||
            baseline.shape_features.square_corners !== undefined ||
            baseline.shape_features.triangle_closure !== undefined
        );
        const hasDrawingBaseline = baseline.drawing_features && (
            baseline.drawing_features.face_features !== undefined ||
            baseline.drawing_features.star_points !== undefined ||
            baseline.drawing_features.house_structure !== undefined ||
            baseline.drawing_features.connect_dots !== undefined
        );
        
        if (hasShapeBaseline) {
            console.log(chalk.green('✓ Shape baseline data found:'));
            console.log('  - Circle roundness:', baseline.shape_features.circle_roundness);
            console.log('  - Square corners:', baseline.shape_features.square_corners);
            console.log('  - Triangle closure:', baseline.shape_features.triangle_closure);
        } else {
            console.log(chalk.red('✗ Shape baseline data missing'));
        }
        
        if (hasDrawingBaseline) {
            console.log(chalk.green('✓ Drawing baseline data found:'));
            console.log('  - Face features:', baseline.drawing_features.face_features);
            console.log('  - Star points:', baseline.drawing_features.star_points);
            console.log('  - House structure:', baseline.drawing_features.house_structure);
            console.log('  - Connect dots:', baseline.drawing_features.connect_dots);
        } else {
            console.log(chalk.red('✗ Drawing baseline data missing'));
        }
        
        // Test 2: Check if auth attempts have proper enhanced features without errors
        console.log(chalk.yellow('\nTest 2: Verifying drawing enhanced features in auth attempts...'));
        const authAttempts = response.data.authAttempts || [];
        let foundDrawingFeatures = false;
        let foundErrors = [];
        
        for (const attempt of authAttempts) {
            if (attempt.enhanced_features) {
                // Check drawings
                if (attempt.enhanced_features.drawings) {
                    const drawings = attempt.enhanced_features.drawings;
                    for (const [drawingType, features] of Object.entries(drawings)) {
                        if (features._enhanced_features_error && 
                            features._enhanced_features_error.includes('Cannot read properties')) {
                            foundErrors.push(`${drawingType}: ${features._enhanced_features_error}`);
                        } else if (features && Object.keys(features).length > 5) {
                            foundDrawingFeatures = true;
                            console.log(chalk.green(`✓ Found enhanced features for ${drawingType} in attempt ${attempt.id}`));
                        }
                    }
                }
            }
        }
        
        if (foundErrors.length > 0) {
            console.log(chalk.red('✗ Found extraction errors:'));
            foundErrors.forEach(err => console.log(chalk.red(`  - ${err}`)));
        } else {
            console.log(chalk.green('✓ No "Cannot read properties" errors found'));
        }
        
        if (foundDrawingFeatures) {
            console.log(chalk.green('✓ Successfully extracted drawing enhanced features'));
        }
        
        // Test 3: Verify enrollment data structure
        console.log(chalk.yellow('\nTest 3: Verifying enrollment data structure...'));
        const enrollment = response.data.enrollment;
        console.log(chalk.green('✓ Enrollment shapes count:'), enrollment.shapes?.length || 0);
        console.log(chalk.green('✓ Enrollment drawings count:'), enrollment.drawings?.length || 0);
        
        // Summary
        console.log(chalk.blue('\n========================================'));
        console.log(chalk.blue('Summary:'));
        console.log(hasShapeBaseline ? chalk.green('✓ Issue #1 (Shape baseline) - FIXED') : chalk.red('✗ Issue #1 (Shape baseline) - NOT FIXED'));
        console.log(hasDrawingBaseline ? chalk.green('✓ Issue #1 (Drawing baseline) - FIXED') : chalk.red('✗ Issue #1 (Drawing baseline) - NOT FIXED'));
        console.log(foundErrors.length === 0 ? chalk.green('✓ Issue #3 (Drawing errors) - FIXED') : chalk.red('✗ Issue #3 (Drawing errors) - NOT FIXED'));
        console.log(chalk.yellow('! Issue #2 (Layout) - Please check visually in browser'));
        console.log(chalk.blue('========================================\n'));
        
    } catch (error) {
        console.error(chalk.red('Error testing ML dashboard fixes:'), error.message);
        if (error.response) {
            console.error(chalk.red('Response status:'), error.response.status);
            console.error(chalk.red('Response data:'), error.response.data);
        }
    }
}

// Run the test
testMLDashboardFixes();