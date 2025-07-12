/**
 * Prompt Library for Bolt AI
 *
 * This file exports enhanced prompt components with improved Python and Java project generation,
 * including comprehensive build systems and containerization support.
 */

export { enhancedPythonJavaInstructions } from './enhanced-python-java';
export { enhanceWithPythonJavaInstructions, enhanceWithSequentialThinking } from './integration';

// Re-export the original prompt functions with enhanced capabilities
import { getFineTunedPrompt as originalGetFineTunedPrompt } from './new-prompt';
import { enhanceWithPythonJavaInstructions, enhanceWithSequentialThinking } from './integration';

/**
 * Enhanced prompt generator with improved Python and Java project generation capabilities,
 * now including automatic containerization and build system integration.
 *
 * - Automatically generates Dockerfiles and docker-compose.yml
 * - Creates appropriate build configs (Maven/Gradle for Java, pyproject.toml/setup.py for Python)
 * - Sets up CI/CD configurations and deployment files
 * - Includes development environment configurations (.vscode, .devcontainer)
 */
export const getEnhancedPrompt = (
  cwd?: string,
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: { anonKey?: string; supabaseUrl?: string };
  },
  designScheme?: any,
) => {
  const basePrompt = originalGetFineTunedPrompt(cwd, supabase, designScheme);

  // Apply both enhancements for full functionality
  const withPythonJava = enhanceWithPythonJavaInstructions(basePrompt);
  const withSequentialThinking = enhanceWithSequentialThinking(withPythonJava);

  return withSequentialThinking;
};
