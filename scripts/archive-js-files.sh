#!/bin/bash

# Archive JavaScript files to legacy directory
# This script moves all .js files to the legacy/javascript directory while preserving structure

echo "=== Archiving JavaScript Files ==="
echo "Starting at: $(date)"

# Create archive documentation
cat > legacy/javascript/migration-archive.md << EOF
# JavaScript Archive

This directory contains the original JavaScript files archived during the TypeScript migration.
Migration completed on: $(date)

## Archive Structure
- backend/ - Backend server and service files
- frontend/ - Frontend application files  
- scripts/ - Build and utility scripts
- tests/ - Test files

## File Mapping
The following files were archived:

EOF

# Counter for archived files
count=0

# Archive backend files
echo "Archiving backend files..."
for file in $(find backend -name "*.js" -type f | grep -v node_modules); do
    dest="legacy/javascript/$file"
    mkdir -p "$(dirname "$dest")"
    cp "$file" "$dest"
    echo "- $file -> $dest" >> legacy/javascript/migration-archive.md
    ((count++))
done

# Archive frontend files  
echo "Archiving frontend files..."
for file in $(find frontend -name "*.js" -type f | grep -v node_modules); do
    dest="legacy/javascript/$file"
    mkdir -p "$(dirname "$dest")"
    cp "$file" "$dest"
    echo "- $file -> $dest" >> legacy/javascript/migration-archive.md
    ((count++))
done

# Archive scripts files
echo "Archiving scripts files..."
for file in $(find scripts -name "*.js" -type f | grep -v node_modules); do
    dest="legacy/javascript/$file"
    mkdir -p "$(dirname "$dest")"
    cp "$file" "$dest"
    echo "- $file -> $dest" >> legacy/javascript/migration-archive.md
    ((count++))
done

# Archive test files
echo "Archiving test files..."
for file in $(find tests -name "*.js" -type f | grep -v node_modules); do
    dest="legacy/javascript/$file"
    mkdir -p "$(dirname "$dest")"
    cp "$file" "$dest"
    echo "- $file -> $dest" >> legacy/javascript/migration-archive.md
    ((count++))
done

# Archive root level config files
echo "Archiving root config files..."
for file in *.js; do
    if [ -f "$file" ]; then
        dest="legacy/javascript/$file"
        cp "$file" "$dest"
        echo "- $file -> $dest" >> legacy/javascript/migration-archive.md
        ((count++))
    fi
done

echo "" >> legacy/javascript/migration-archive.md
echo "Total files archived: $count" >> legacy/javascript/migration-archive.md
echo "Archive completed: $(date)" >> legacy/javascript/migration-archive.md

echo "✅ Archived $count JavaScript files"
echo "📁 Archive location: legacy/javascript/"
echo "📄 Documentation: legacy/javascript/migration-archive.md"
echo ""
echo "To remove JS files after verification, run:"
echo "  find . -name '*.js' -type f | grep -E '^\\./?(backend|frontend|scripts|tests)/' | grep -v node_modules | xargs rm"