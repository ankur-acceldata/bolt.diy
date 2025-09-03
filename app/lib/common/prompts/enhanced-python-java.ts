// This module provides comprehensive instructions for generating high-quality Python and Java projects

export const enhancedPythonJavaInstructions = `
<python_java_project_instructions>
  CRITICAL: When creating Python or Java projects, generate COMPLETE production-grade implementations:

  Python Projects:
  - Use sequential thinking to plan project structure before generating files
  - Standard directory structure:
    \`\`\`
    my_project/
    ├── README.md
    ├── requirements.txt    (list ALL dependencies)
    ├── setup.py           (for packages/libraries)
    ├── pyproject.toml     (modern project configuration)
    ├── .gitignore
    ├── Dockerfile         (containerization support)
    ├── docker-compose.yml (for multi-service applications)
    ├── .github/           (CI/CD workflows)
    │   └── workflows/
    │       └── ci.yml     (testing and deployment automation)
    ├── tests/
    │   ├── __init__.py
    │   └── test_*.py      (unit tests with assertions)
    ├── my_project/        (main package folder)
    │   ├── __init__.py    (expose key functions)
    │   ├── __main__.py    (entry point for runnable modules)
    │   ├── config.py      (settings, constants)
    │   ├── models/        (data models)
    │   ├── utils/         (helper functions)
    │   └── cli.py         (for CLI tools)
    └── docs/              (documentation)
    \`\`\`
  - Include type hints (Python 3.6+)
  - Use appropriate dependency management (requirements.txt, pyproject.toml)
  - Include docstrings following Google or NumPy style
  - Implement error handling with custom exceptions
  - Add logging with proper levels (not print statements)
  - Include unit tests with pytest structure
  - Implement configuration management
  - Use appropriate design patterns (factories, singletons, etc.)
  - Follow PEP 8 style guidelines
  - Validate imported packages are standard library ONLY

  Java Projects:
  - Use sequential thinking to plan project structure before generating files
  - CRITICAL: Do NOT create frontend components (HTML, CSS, JS) for standard Java applications unless specifically requested
  - Standard directory structure:
    \`\`\`
    my_project/
    ├── README.md
    ├── pom.xml            (Maven) or build.gradle (Gradle)
    ├── .gitignore
    ├── Dockerfile         (ALWAYS include for containerization)
    ├── docker-compose.yml (for multi-service applications)
    ├── .github/           (CI/CD workflows)
    │   └── workflows/
    │       └── ci.yml     (testing and deployment automation)
    ├── src/
    │   ├── main/
    │   │   ├── java/
    │   │   │   └── com/example/project/
    │   │   │       ├── Main.java         (entry point)
    │   │   │       ├── config/           (configuration)
    │   │   │       ├── model/            (data objects)
    │   │   │       ├── service/          (business logic)
    │   │   │       ├── repository/       (data access)
    │   │   │       └── util/             (helpers)
    │   │   └── resources/                (configs, properties)
    │   └── test/
    │       └── java/
    │           └── com/example/project/  (unit tests)
    └── target/ or build/                 (build outputs)
    \`\`\`
  - Include proper build system (Maven/Gradle)
  - Implement dependency injection where appropriate
  - Use interfaces for abstraction
  - Add comprehensive exception handling
  - Include logging with SLF4J or Log4j
  - Add unit tests with JUnit
  - Use design patterns appropriately
  - Follow Java code conventions
  - Include proper JavaDoc
  - Include appropriate build plugins (compile, test, package)

  CRITICAL Rules for Both Languages:
  - Always generate ALL necessary files including configuration files
  - Include detailed README with setup, usage, and examples
  - Add appropriate file headers with copyright/license
  - Use proper error handling with descriptive messages
  - Implement logging instead of print statements
  - Follow separation of concerns principle
  - Include unit tests for core functionality
  - Generate complete implementations, not stubs
  - Use sequential thinking to plan architecture
  - Validate dependency compatibility
  - Use consistent naming conventions
  - Implement proper exception handling
  - Organize code logically by feature/module

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

  AUTOMATICALLY include containerization and deployment files:
  - Containerization:
    - ALWAYS create appropriate Dockerfiles without requiring explicit requests
    - For Java applications, ALWAYS include a Dockerfile optimized for JVM applications
    - For Python applications, ALWAYS include a Dockerfile optimized for Python applications
    - Use multi-stage builds to optimize container size
    - Include .dockerignore files to exclude unnecessary files
    - Create docker-compose.yml for multi-container applications
    - Add appropriate health checks and container configurations
    - Document environment variables in README and .env.example files
    - Add clear container build and run instructions in README.md

  - CI/CD and Deployment:
    - Add GitHub Actions workflows for building, testing, and deployment
    - Include appropriate workflow triggers (push, pull request)
    - Configure proper caching for faster builds
    - Set up appropriate test automation
    - Include deployment instructions for common platforms

  - Development Environment Support:
    - Add .vscode/settings.json or .idea configurations when appropriate
    - Include .editorconfig for consistent coding style
    - Create devcontainer.json for VS Code remote containers
    - Document development setup steps in README.md

  - Common Output Directories:
    - Python: /dist, /build, /site, /__pycache__
    - Java: /target, /build, /out, /bin
    - Web: /dist, /build, /out, /.next, /public
</python_java_project_instructions>
`;
