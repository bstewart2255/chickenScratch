# Signature Authentication Prototype

A biometric authentication system using signature analysis, fully migrated to TypeScript.

## Technology Stack

- **Backend**: Node.js with Express (TypeScript)
- **Database**: PostgreSQL
- **Frontend**: Vanilla TypeScript with Canvas API
- **ML Integration**: Python-based ML service for signature comparison

## Project Structure

```
├── backend/          # Express server and services (TypeScript)
├── frontend/         # Web application (TypeScript)
├── src/             # Shared TypeScript code
│   ├── types/       # Type definitions
│   ├── config/      # Configuration service
│   └── utils/       # Shared utilities
├── scripts/         # Build and utility scripts
├── tests/           # Test suites
├── legacy/          # Archived JavaScript files
└── dist/            # Compiled JavaScript output
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Set up database:
   ```bash
   npm run db:setup
   ```

## Development

```bash
# Run type checking
npm run type-check

# Build TypeScript
npm run build

# Run development server
npm run dev

# Run tests
npm test
```

## TypeScript Migration

This project has been fully migrated from JavaScript to TypeScript with:

- Strict type checking enabled
- Comprehensive type definitions for all biometric data
- Type-safe configuration management
- Full test coverage (>90%)
- Performance monitoring and optimization

### Key Features

- **Biometric Analysis**: Advanced signature feature extraction
- **ML Integration**: Machine learning-based authentication
- **Device Compatibility**: Support for mouse, touch, and stylus input
- **Security**: Multiple authentication factors and anomaly detection

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- backend/
```

## Deployment

```bash
# Build for production
npm run build:prod

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

## Monitoring

The system includes comprehensive monitoring:

- Performance metrics tracking
- Error logging and alerting
- Authentication attempt analysis
- System health checks

## Contributing

1. Create a feature branch
2. Make changes with proper TypeScript types
3. Ensure all tests pass
4. Submit a pull request

## License

Proprietary - All rights reserved