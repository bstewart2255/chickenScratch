#!/usr/bin/env node

/**
 * Database User Fix Script
 * 
 * This script fixes database configuration issues by ensuring
 * the "postgres" user is used instead of "root" user.
 */

const fs = require('fs');
const path = require('path');

function fixDatabaseUser() {
  console.log('🔧 Fixing Database User Configuration...\n');

  // List of files to check and fix
  const filesToCheck = [
    '.env',
    '.env.test',
    'backend/.env',
    'tests/setup.ts',
    'tests/helpers/mocks.ts'
  ];

  // Patterns to search for and replace
  const replacements = [
    {
      pattern: /user:\s*['"]root['"]/g,
      replacement: "user: 'postgres'",
      description: 'Replace "root" user with "postgres"'
    },
    {
      pattern: /DB_USER\s*=\s*root/g,
      replacement: 'DB_USER=postgres',
      description: 'Replace DB_USER=root with DB_USER=postgres'
    },
    {
      pattern: /PGUSER\s*=\s*root/g,
      replacement: 'PGUSER=postgres',
      description: 'Replace PGUSER=root with PGUSER=postgres'
    },
    {
      pattern: /postgresql:\/\/root:/g,
      replacement: 'postgresql://postgres:',
      description: 'Replace root user in DATABASE_URL'
    },
    {
      pattern: /POSTGRES_USER\s*=\s*root/g,
      replacement: 'POSTGRES_USER=postgres',
      description: 'Replace POSTGRES_USER=root with POSTGRES_USER=postgres'
    }
  ];

  let totalFixes = 0;

  filesToCheck.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      console.log(`📁 Checking ${filePath}...`);
      
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        let fileFixes = 0;
        let originalContent = content;

        replacements.forEach(({ pattern, replacement, description }) => {
          const matches = content.match(pattern);
          if (matches) {
            console.log(`  🔧 ${description}: ${matches.length} occurrence(s)`);
            content = content.replace(pattern, replacement);
            fileFixes += matches.length;
          }
        });

        if (fileFixes > 0) {
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`  ✅ Fixed ${fileFixes} issue(s) in ${filePath}`);
          totalFixes += fileFixes;
        } else {
          console.log(`  ✅ No issues found in ${filePath}`);
        }
      } catch (error) {
        console.log(`  ❌ Error reading ${filePath}: ${error.message}`);
      }
    } else {
      console.log(`  ⚠️  File not found: ${filePath}`);
    }
  });

  // Check for any remaining "root" references
  console.log('\n🔍 Checking for remaining "root" references...');
  
  const searchPatterns = [
    /root/g,
    /ROOT/g
  ];

  let remainingIssues = 0;

  filesToCheck.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        searchPatterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            console.log(`  ⚠️  Found ${matches.length} "root" reference(s) in ${filePath}`);
            remainingIssues += matches.length;
          }
        });
      } catch (error) {
        console.log(`  ❌ Error checking ${filePath}: ${error.message}`);
      }
    }
  });

  // Create a test environment setup script
  console.log('\n📝 Creating test environment setup script...');
  
  const testSetupScript = `#!/bin/bash

# Test Environment Setup Script
# This script ensures the correct database configuration for tests

echo "🔧 Setting up test environment..."

# Set test environment variables
export NODE_ENV=test
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/signature_auth_test"
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=signature_auth_test
export DB_USER=postgres
export DB_PASSWORD=postgres
export PGUSER=postgres
export PGPASSWORD=postgres
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=signature_auth_test
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_DB=signature_auth_test

echo "✅ Test environment variables set"
echo "📋 Current configuration:"
echo "  DATABASE_URL: $DATABASE_URL"
echo "  DB_USER: $DB_USER"
echo "  PGUSER: $PGUSER"
echo "  POSTGRES_USER: $POSTGRES_USER"

# Validate no "root" user is being used
if echo "$DATABASE_URL" | grep -q "root"; then
  echo "❌ ERROR: DATABASE_URL still contains 'root' user!"
  exit 1
fi

if [ "$DB_USER" = "root" ] || [ "$PGUSER" = "root" ] || [ "$POSTGRES_USER" = "root" ]; then
  echo "❌ ERROR: Database user is still set to 'root'!"
  exit 1
fi

echo "✅ No 'root' user found in configuration"
echo "🎉 Test environment setup complete!"
`;

  fs.writeFileSync('scripts/setup-test-env.sh', testSetupScript);
  fs.chmodSync('scripts/setup-test-env.sh', '755');
  console.log('  ✅ Created scripts/setup-test-env.sh');

  // Summary
  console.log('\n📊 Summary:');
  console.log(`  Total fixes applied: ${totalFixes}`);
  console.log(`  Remaining "root" references: ${remainingIssues}`);
  
  if (totalFixes > 0) {
    console.log('\n✅ Database user configuration has been fixed!');
    console.log('\n💡 Next steps:');
    console.log('  1. Run: npm run db:validate');
    console.log('  2. Run: npm test');
    console.log('  3. If issues persist, check your CI/CD environment variables');
  } else if (remainingIssues > 0) {
    console.log('\n⚠️  Some "root" references remain. Please review manually.');
  } else {
    console.log('\n🎉 No database user issues found!');
  }

  console.log('\n📚 Additional resources:');
  console.log('  - scripts/validate-db-config.js - Validate database configuration');
  console.log('  - scripts/setup-test-env.sh - Set up test environment');
  console.log('  - .env.test - Test environment configuration');
}

// Run the fix
if (require.main === module) {
  fixDatabaseUser();
}

module.exports = { fixDatabaseUser }; 