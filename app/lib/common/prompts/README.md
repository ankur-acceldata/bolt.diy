# Enhanced Prompt System for Python and Java Projects

This directory contains an enhanced prompt system for Bolt AI that significantly improves Python and Java project generation capabilities, including automated build systems and containerization.

## Key Files

- **python-java-instructions.ts**: Contains specialized instructions for generating production-grade Python and Java projects
- **enhanced-python-java.ts**: Enhanced version with build systems and containerization support
- **integration.ts**: Utility functions to integrate Python/Java instructions into existing prompts
- **enhanced-prompts.ts**: Exports enhanced prompt generators with Python/Java capabilities

## Features Added

1. **Complete Project Structure Generation**:

   - Full directory structure for Python and Java projects
   - All necessary configuration files
   - Test directories and sample tests
   - Comprehensive documentation

2. **Sequential Thinking Approach**:

   - Methodical planning before implementation
   - Architecture design before coding
   - Dependency management planning
   - Complete project validation

3. **Language-Specific Best Practices**:

   - Python: PEP standards, type hints, proper package structure
   - Java: Maven/Gradle configuration, proper package structure, JavaDoc

4. **Production-Grade Quality**:

   - Error handling with custom exceptions
   - Logging system implementation
   - Configuration management
   - Comprehensive documentation

5. **Automatic Build System Generation**:
   - Java: Maven/Gradle build files with appropriate plugins
   - Python: setup.py, pyproject.toml, requirements.txt
   - Node.js: package.json with proper dependencies and scripts
6. **Containerization & Deployment Support**:
   - Automatic Dockerfile generation
   - Multi-stage builds for optimized containers
   - docker-compose.yml for multi-service applications
   - CI/CD workflows for GitHub Actions
   - Development container configurations

## How to Use

Import the enhanced prompt generator:

```typescript
import { getEnhancedPrompt } from '~/lib/common/prompts/enhanced-prompts';

// Use instead of the original getFineTunedPrompt
const prompt = getEnhancedPrompt(cwd, supabase, designScheme);
```

Or integrate just the Python/Java instructions with build system support into an existing prompt:

```typescript
import { enhanceWithPythonJavaInstructions } from '~/lib/common/prompts/integration';

// Apply the enhanced Python/Java instructions with build system support
const enhancedPrompt = enhanceWithPythonJavaInstructions(originalPrompt);
```

The enhanced instructions will automatically generate:

1. All necessary build configuration files (Maven/Gradle for Java, requirements.txt/setup.py for Python)
2. Dockerfiles with multi-stage builds and proper optimization
3. docker-compose.yml files for multi-service applications
4. CI/CD configurations for GitHub Actions
5. Development environment setup (.devcontainer, .vscode)

Users won't need to explicitly request these files - they'll be included automatically when generating projects.

```typescript
import { enhanceWithPythonJavaInstructions } from '~/lib/common/prompts/integration';

const enhancedPrompt = enhanceWithPythonJavaInstructions(existingPrompt);
```

## Implementation Notes

The implementation addresses the following requirements:

- Intelligent generation of complete, production-grade Python and Java projects
- Automatic determination of required files, folder structures, configurations
- Build setup relevant to each language and project type
- File type support for all required project files
- Validation of generated projects for completeness
