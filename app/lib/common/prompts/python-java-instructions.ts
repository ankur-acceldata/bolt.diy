// This module provides specialized instructions for Python and Java project generation

export const pythonJavaInstructions = `
<python_java_project_instructions>
  CRITICAL: When generating Python or Java projects, create COMPLETE production-grade implementations:

  Python Project Structure:
  - Main module directory with proper package structure
  - __init__.py files in all directories to make them proper packages
  - README.md with comprehensive documentation
  - requirements.txt with standard library dependencies only
  - setup.py or pyproject.toml for packaging
  - Configuration management (config.py, .env handling)
  - Proper logging setup with Python's logging module
  - Unit tests with assertions and proper test structure
  - Type annotations (Python 3.6+)
  - Error handling with custom exception classes
  - Documentation with docstrings (Google or NumPy style)
  - Command line interface where appropriate

  Java Project Structure:
  - Maven or Gradle build configuration
  - Proper package structure following conventions
  - Main application class with entry point
  - Model/service/repository organization
  - Configuration management
  - Logging implementation (SLF4J or Log4j)
  - Exception handling hierarchy
  - Unit tests with JUnit
  - JavaDoc documentation
  - Resource files and property management
  - Interface-based design with proper abstractions

  Development Process - ALWAYS follow this sequence:
  1. Analyze requirements thoroughly first
  2. Plan complete architecture and component interactions
  3. Define ALL necessary files and their relationships
  4. Implement core functionality with proper error handling
  5. Add tests, documentation, and configuration
  6. Ensure all files work together as a complete system

  Quality Standards:
  - Use descriptive naming following language conventions
  - Implement proper error handling and validation
  - Follow SOLID principles and appropriate design patterns
  - Include comprehensive documentation
  - Implement proper separation of concerns
  - Add appropriate logging throughout the codebase
  - Create a user-friendly experience
  - Include thorough README with setup and usage instructions

  File Type Support:
  - Python: .py, .md, .txt, .toml, .ini, .json, .yaml, .cfg
  - Java: .java, .xml, .properties, .md, .gradle, .jar, .bat, .sh

  Build Systems:
  - Python: setuptools, poetry, pip requirements
  - Java: Maven, Gradle

  Testing Frameworks:
  - Python: unittest, pytest (standard library only)
  - Java: JUnit

  Configuration Management:
  - Python: configparser, JSON, YAML (standard library only)
  - Java: Properties files, XML configuration

  Documentation:
  - Python: docstrings, Markdown, reStructuredText
  - Java: JavaDoc, Markdown
</python_java_project_instructions>
`;

export default pythonJavaInstructions;
