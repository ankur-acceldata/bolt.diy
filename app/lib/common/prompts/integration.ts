import { enhancedPythonJavaInstructions } from './enhanced-python-java';

/**
 * This file provides integration functions to update the system prompts
 * with enhanced Python and Java project generation capabilities.
 */

/**
 * Integrates the Python and Java instructions into an existing prompt
 * @param existingPrompt The original prompt string
 * @returns Updated prompt with Python and Java project generation instructions
 */
export function enhanceWithPythonJavaInstructions(existingPrompt: string): string {
  /*
   * Find an appropriate place to insert the instructions.
   * Using enhancedPythonJavaInstructions for better build system and containerization support
   */
  if (existingPrompt.includes('<technology_preferences>')) {
    // Insert after technology preferences if it exists
    return existingPrompt.replace(
      '</technology_preferences>',
      '</technology_preferences>\n\n' + enhancedPythonJavaInstructions,
    );
  } else if (existingPrompt.includes('<system_constraints>')) {
    // Insert after system constraints if technology preferences doesn't exist
    return existingPrompt.replace(
      '</system_constraints>',
      enhancedPythonJavaInstructions + '\n\n</system_constraints>',
    );
  } else {
    // Just append at the end if neither section exists
    return existingPrompt + '\n\n' + enhancedPythonJavaInstructions;
  }
}

/**
 * Adds sequential thinking approach for project generation to artifact instructions
 * @param existingPrompt The original prompt string
 * @returns Updated prompt with sequential thinking instructions
 */
export function enhanceWithSequentialThinking(existingPrompt: string): string {
  const sequentialThinkingInstructions = `
  CRITICAL - Sequential Thinking for Project Generation:
    1. ALWAYS use sequential thinking for complex projects (especially Python and Java)
    2. First step: Analyze requirements thoroughly and outline project goals
    3. Second step: Design architecture including patterns, layers, and components
    4. Third step: Plan folder structure and determine ALL required files
    5. Fourth step: Define dependencies, configurations, and build requirements
    6. Fifth step: Only after thorough planning, generate ALL files and commands
    7. Final step: Validate the completeness of the project

    This sequential thinking ensures full projects rather than partial implementations
`;

  if (existingPrompt.includes('<artifact_instructions>')) {
    // Find the end of the dependencies section in artifact instructions
    const dependenciesSection = 'Avoid individual package installations';

    if (existingPrompt.includes(dependenciesSection)) {
      return existingPrompt.replace(dependenciesSection, dependenciesSection + '\n' + sequentialThinkingInstructions);
    } else {
      // Insert at the end of artifact instructions if dependencies section not found
      return existingPrompt.replace(
        '</artifact_instructions>',
        sequentialThinkingInstructions + '\n</artifact_instructions>',
      );
    }
  } else {
    // Just append if artifact instructions don't exist
    return existingPrompt + '\n\n' + sequentialThinkingInstructions;
  }
}
