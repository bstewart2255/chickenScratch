# 2. Project Scope & Scale

## Current Codebase Size:
- **Backend**: ~50 JavaScript files (~500KB total)
- **Frontend**: 3 JavaScript files (~15KB total)
- **Main server**: 3,887 lines (162KB)
- **Complex modules**: Enhanced feature extraction (945 lines), component-specific features (1,235 lines)
- **Database migrations**: Multiple pending migrations identified in technical debt assessment

## Key Complexity Areas:
- Biometric data structures with 25+ feature types
- Complex API endpoints with JSONB database operations
- Device capability detection and validation
- ML feature extraction and comparison algorithms
- **Data format inconsistencies between signatures and shapes**
- **Multiple drawing format versions in production**