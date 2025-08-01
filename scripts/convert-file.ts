#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { MigrationTracker } from './MigrationTracker';
import { config } from '../src/config';

interface ConversionOptions {
  targetDir?: string;
  preserveOriginal?: boolean;
  addTypes?: boolean;
  strictMode?: boolean;
  skipTests?: boolean;
}

interface ConversionResult {
  success: boolean;
  originalFile: string;
  convertedFile?: string;
  errors: string[];
  warnings: string[];
  typeErrors: number;
  conversionTime: number;
}

export class FileConverter {
  private tracker: MigrationTracker;
  private options: ConversionOptions;

  constructor(options: ConversionOptions = {}) {
    this.tracker = new MigrationTracker();
    this.options = {
      targetDir: options.targetDir || 'converted',
      preserveOriginal: options.preserveOriginal !== false,
      addTypes: options.addTypes !== false,
      strictMode: options.strictMode || false,
      skipTests: options.skipTests || false,
    };
  }

  async convertFile(filePath: string): Promise<ConversionResult> {
    const startTime = Date.now();
    const result: ConversionResult = {
      success: false,
      originalFile: filePath,
      errors: [],
      warnings: [],
      typeErrors: 0,
      conversionTime: 0,
    };

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        const error = `File not found: ${filePath}`;
        this.tracker.addError(filePath, 'file_not_found', error);
        result.errors.push(error);
        return result;
      }

      // Skip test files if requested
      if (this.options.skipTests && this.isTestFile(filePath)) {
        result.warnings.push('Skipping test file');
        return result;
      }

      // Read the original file
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Convert the file
      const convertedContent = await this.convertContent(content, filePath);
      
      // Generate the output path
      const outputPath = this.generateOutputPath(filePath);
      
      // Ensure target directory exists
      const targetDir = path.dirname(outputPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Write the converted file
      fs.writeFileSync(outputPath, convertedContent);
      
      // Update metrics
      this.tracker.updateMetrics({
        convertedFiles: 1,
        typeErrors: result.typeErrors,
      });
      
      result.success = true;
      result.convertedFile = outputPath;
      
      // Log successful conversion
      console.log(`✅ Converted: ${filePath} -> ${outputPath}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorId = this.tracker.addError(filePath, 'conversion_error', errorMessage);
      result.errors.push(errorMessage);
      console.error(`❌ Failed to convert ${filePath}: ${errorMessage}`);
    }

    result.conversionTime = Date.now() - startTime;
    return result;
  }

  async convertDirectory(dirPath: string): Promise<ConversionResult[]> {
    const results: ConversionResult[] = [];
    
    if (!fs.existsSync(dirPath)) {
      console.error(`Directory not found: ${dirPath}`);
      return results;
    }

    const files = this.getJavaScriptFiles(dirPath);
    console.log(`Found ${files.length} JavaScript files to convert`);

    for (const file of files) {
      const result = await this.convertFile(file);
      results.push(result);
      
      // Update progress
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      console.log(`Progress: ${successCount} converted, ${errorCount} failed`);
    }

    return results;
  }

  private async convertContent(content: string, filePath: string): Promise<string> {
    let convertedContent = content;

    // 1. Add TypeScript file extension comment
    if (this.options.addTypes) {
      convertedContent = this.addTypeAnnotations(convertedContent, filePath);
    }

    // 2. Convert require statements to imports
    convertedContent = this.convertRequireStatements(convertedContent);

    // 3. Convert module.exports to export statements
    convertedContent = this.convertModuleExports(convertedContent);

    // 4. Add type imports if needed
    if (this.options.addTypes) {
      convertedContent = this.addTypeImports(convertedContent, filePath);
    }

    // 5. Convert function declarations to typed functions
    if (this.options.addTypes) {
      convertedContent = this.addFunctionTypes(convertedContent);
    }

    // 6. Convert variable declarations to typed variables
    if (this.options.addTypes) {
      convertedContent = this.addVariableTypes(convertedContent);
    }

    // 7. Add strict mode if requested
    if (this.options.strictMode) {
      convertedContent = this.addStrictMode(convertedContent);
    }

    return convertedContent;
  }

  private addTypeAnnotations(content: string, filePath: string): string {
    // Add basic type annotations based on file content
    let converted = content;

    // Convert function parameters to typed parameters
    converted = converted.replace(
      /function\s+(\w+)\s*\(([^)]*)\)/g,
      (match, funcName, params) => {
        const typedParams = params.split(',').map((param: string) => {
          const trimmed = param.trim();
          if (trimmed.includes('=')) {
            const [name, defaultValue] = trimmed.split('=');
            return `${name.trim()}: any = ${defaultValue.trim()}`;
          }
          return `${trimmed}: any`;
        }).join(', ');
        return `function ${funcName}(${typedParams})`;
      }
    );

    // Convert arrow functions
    converted = converted.replace(
      /(\w+)\s*=>\s*{/g,
      (match, param) => `${param}: any => {`
    );

    // Add return types for functions
    converted = converted.replace(
      /function\s+(\w+)\s*\([^)]*\)\s*{/g,
      (match, funcName) => `${match}: any {`
    );

    return converted;
  }

  private convertRequireStatements(content: string): string {
    // Convert require statements to import statements
    return content.replace(
      /const\s+(\w+)\s*=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      (match, varName, modulePath) => {
        // Handle different types of imports
        if (modulePath.startsWith('.')) {
          // Relative import
          return `import { ${varName} } from '${modulePath}';`;
        } else {
          // External module import
          return `import { ${varName} } from '${modulePath}';`;
        }
      }
    );
  }

  private convertModuleExports(content: string): string {
    // Convert module.exports to export statements
    return content.replace(
      /module\.exports\s*=\s*(\w+)/g,
      (match, exportName) => `export default ${exportName};`
    );
  }

  private addTypeImports(content: string, filePath: string): string {
    // Add type imports based on file content
    const typeImports: string[] = [];
    
    if (content.includes('SignatureData') || content.includes('AuthAttempt')) {
      typeImports.push("import { SignatureData, AuthAttempt } from '../types';");
    }
    
    if (content.includes('DatabaseConfig') || content.includes('DatabaseConnection')) {
      typeImports.push("import { DatabaseConfig, DatabaseConnection } from '../types';");
    }
    
    if (content.includes('ApiResponse') || content.includes('ValidationResult')) {
      typeImports.push("import { ApiResponse, ValidationResult } from '../types';");
    }

    if (typeImports.length > 0) {
      return typeImports.join('\n') + '\n\n' + content;
    }

    return content;
  }

  private addFunctionTypes(content: string): string {
    // Add return types to functions
    return content.replace(
      /function\s+(\w+)\s*\([^)]*\)\s*{/g,
      (match, funcName) => `${match}: any {`
    );
  }

  private addVariableTypes(content: string): string {
    // Add types to variable declarations
    return content.replace(
      /const\s+(\w+)\s*=\s*(\w+)/g,
      (match, varName, value) => {
        // Only add types for certain patterns
        if (value === 'require' || value === 'import') {
          return match; // Skip require/import statements
        }
        return `const ${varName}: any = ${value}`;
      }
    );
  }

  private addStrictMode(content: string): string {
    // Add 'use strict' if not already present
    if (!content.includes('use strict')) {
      return "'use strict';\n\n" + content;
    }
    return content;
  }

  private generateOutputPath(filePath: string): string {
    const relativePath = path.relative(process.cwd(), filePath);
    const dirName = path.dirname(relativePath);
    const baseName = path.basename(filePath, '.js');
    const targetDir = this.options.targetDir || 'converted';
    
    return path.join(targetDir, dirName, `${baseName}.ts`);
  }

  private getJavaScriptFiles(dirPath: string): string[] {
    const files: string[] = [];
    
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and other common directories
        if (!['node_modules', 'dist', 'build', '.git', 'coverage'].includes(item)) {
          files.push(...this.getJavaScriptFiles(fullPath));
        }
      } else if (item.endsWith('.js') && !item.endsWith('.test.js') && !item.endsWith('.spec.js')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private isTestFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    return fileName.includes('.test.') || fileName.includes('.spec.') || fileName.includes('test-');
  }

  // Public method to get conversion statistics
  getConversionStats(): any {
    const status = this.tracker.getStatus();
    const unresolvedErrors = this.tracker.getUnresolvedErrors();
    
    return {
      totalFiles: status.metrics.totalFiles,
      convertedFiles: status.metrics.convertedFiles,
      typeErrors: status.metrics.typeErrors,
      unresolvedErrors: unresolvedErrors.length,
      coverage: status.metrics.coverage,
      currentPhase: status.currentPhase,
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: ts-node convert-file.ts <file-or-directory> [options]');
    console.log('Options:');
    console.log('  --target-dir <dir>     Output directory (default: converted)');
    console.log('  --preserve-original    Keep original files (default: true)');
    console.log('  --add-types           Add type annotations (default: true)');
    console.log('  --strict-mode         Add strict mode (default: false)');
    console.log('  --skip-tests          Skip test files (default: false)');
    process.exit(1);
  }

  const target = args[0];
  const options: ConversionOptions = {};
  
  // Parse options
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--target-dir':
        options.targetDir = args[++i];
        break;
      case '--preserve-original':
        options.preserveOriginal = true;
        break;
      case '--add-types':
        options.addTypes = true;
        break;
      case '--strict-mode':
        options.strictMode = true;
        break;
      case '--skip-tests':
        options.skipTests = true;
        break;
    }
  }

  const converter = new FileConverter(options);
  
  try {
    const stat = fs.statSync(target);
    
    if (stat.isDirectory()) {
      console.log(`Converting directory: ${target}`);
      const results = await converter.convertDirectory(target);
      
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      console.log(`\nConversion complete:`);
      console.log(`✅ Successfully converted: ${successCount} files`);
      console.log(`❌ Failed to convert: ${errorCount} files`);
      
      if (errorCount > 0) {
        console.log('\nFailed files:');
        results.filter(r => !r.success).forEach(r => {
          console.log(`  - ${r.originalFile}: ${r.errors.join(', ')}`);
        });
      }
      
    } else {
      console.log(`Converting file: ${target}`);
      const result = await converter.convertFile(target);
      
      if (result.success) {
        console.log(`✅ Successfully converted: ${target} -> ${result.convertedFile}`);
      } else {
        console.error(`❌ Failed to convert: ${target}`);
        console.error(`Errors: ${result.errors.join(', ')}`);
      }
    }
    
    // Show conversion statistics
    const stats = converter.getConversionStats();
    console.log('\nConversion Statistics:');
    console.log(`  Total files: ${stats.totalFiles}`);
    console.log(`  Converted: ${stats.convertedFiles}`);
    console.log(`  Type errors: ${stats.typeErrors}`);
    console.log(`  Coverage: ${stats.coverage}%`);
    
  } catch (error) {
    console.error('Conversion failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export default FileConverter; 