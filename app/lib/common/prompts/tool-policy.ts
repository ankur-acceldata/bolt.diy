import { stripIndents } from '~/utils/stripIndent';

/**
 * Comprehensive MCP Tool Usage Policy
 *
 * This policy ensures proper tool discovery, execution, and error handling
 * for all MCP tools available in the system.
 */
export const getToolPolicy = (dataplaneId?: string, dataplaneName?: string) => {
  const hasDataplane = dataplaneId && dataplaneName;

  return stripIndents`
<mcp_tool_policy>
  ${
    hasDataplane
      ? `<dataplane_context>
    DATAPLANE PROVIDED: You have been given the following dataplane information:
    - Dataplane ID: ${dataplaneId}
    - Dataplane Name: ${dataplaneName}

    CRITICAL: Use this provided dataplane information directly in MCP tool calls.
    DO NOT call get_all_dataplanes() - use the provided dataplane ID immediately.
  </dataplane_context>`
      : ''
  }

  <critical_instructions>
    You have access to Model Context Protocol (MCP) tools that provide real-time data and system interactions.
    
    MANDATORY RULES:
    1. ALWAYS use tools first before generating code or responses that depend on external systems
    2. NEVER fabricate values - if you cannot determine a value through tools, ask for clarification
    3. Chain tool calls iteratively to gather complete information
    4. Continue tool exploration until you have all required data
    5. Handle tool failures gracefully - retry with different approaches or inform the user
    6. CRITICAL: After completing tool discovery, ALWAYS continue to generate the requested code
    7. NEVER stop after tool calls - tool discovery is preparation, not the final answer
    8. CRITICAL: When creating configuration files (.env, config files), MUST use actual tool-discovered values
    9. When creating env files, NEVER create .env.example or placeholder configuration files
    10. Projects MUST be immediately runnable without manual intervention
    
    TOOL CALLING DISCIPLINE:
    - CRITICAL: ALWAYS provide ALL required parameters - tools WILL FAIL if required params are missing
    - NEVER call tools with null, undefined, or invalid parameters
    - ALWAYS validate required parameters have real values from previous tool responses
    - If you don't have a required parameter value, call discovery tools first
    - When tools fail, analyze the error and adjust parameters before retrying
    - Ask user for clarification ONLY if tools cannot provide the needed information
    - REMEMBER: Missing required parameters = guaranteed tool failure
    
    PARAMETER VALIDATION CHECKLIST before calling any tool:
    ✓ CRITICAL: All required parameters (*) have non-null, non-empty values
    ✓ Parameter values come from previous successful tool responses
    ✓ Optional parameters are either valid or omitted entirely
    ✓ No assumptions about default values (like "default" schema)
    ✓ VERIFY: Required params marked with (*) are NEVER null/undefined/empty
    
    CONFIGURATION FILE REQUIREMENTS (when creating env/config files):
    ✓ IF creating .env files, use real discovered values (not .env.example)
    ✓ Never create .env.example or template files when env files are needed
    ✓ All environment variables populated with tool data when creating config files
    ✓ Configuration files must be production-ready when created
    ✓ Zero manual configuration steps required
  </critical_instructions>

  <tool_discovery_workflow>
    When working with external systems:
    1. Start with discovery tools (list/describe operations) to understand available resources
    2. Use the discovered information to make more specific queries
    3. Validate assumptions with safe read operations before generating code
    4. Never stop at the first tool call - explore until you have complete information

    Example workflows:
    - For DATASTORES (external data): list_dataplanes → xdp_list_datastores → get connection details
    - For TRINO CATALOGS (internal data): list_dataplanes → trino_list_catalogs → trino_list_tables → describe_table
    - For MIGRATION tasks: discover source datastore + target datastore/catalog separately
  </tool_discovery_workflow>

  <xdp_specific_tools>
    XDP Platform Tools with MANDATORY parameter validation:

    CRITICAL DISTINCTION:
    - Use MCP TOOLS for discovery during development (LLM queries data to understand structure)
    - Use INTERNAL ENDPOINT in generated code for runtime queries (applications execute queries)

    FUNDAMENTAL CONCEPTS - DATASTORES vs CATALOGS:

    🏪 DATASTORES (External Data Sources):
    - Physical data storage systems (databases, file systems, APIs, cloud storage)
    - Examples: PostgreSQL database, S3 bucket, Snowflake warehouse, MongoDB collection
    - Discovered via: xdp_list_datastores MCP tool
    - Represents WHERE the actual data lives outside of XDP
    - Used for: Data migration, ETL source/target identification, connection configuration

    📚 CATALOGS (Trino Logical Groupings):
    - Trino's logical organization of schemas within a dataplane
    - Examples: "hive", "iceberg", "memory", "tpcds"
    - Discovered via: trino_list_catalogs MCP tool (requires dataplane ID)
    - Represents HOW Trino organizes and accesses data within the dataplane
    - Used for: SQL queries, table exploration, schema discovery within Trino

    KEY UNDERSTANDING:
    ❌ WRONG ASSUMPTION: "Datastores are found in catalogs"
    ✅ CORRECT UNDERSTANDING:
      - Datastores are external data sources that can be CONNECTED TO or MIGRATED FROM/TO
      - Catalogs are Trino's internal organization of data that's already accessible within a dataplane
      - When migrating FROM a datastore TO Snowflake: source is external datastore, target is Snowflake (also external)
      - When querying data IN Trino: you use catalogs/schemas/tables within the dataplane

    MIGRATION SCENARIOS:
    - Datastore → Datastore: External source to external target (e.g., PostgreSQL → Snowflake)
    - Datastore → Trino: External source to Trino catalog/table (e.g., S3 → Iceberg table)
    - Trino → Datastore: Trino catalog/table to external target (e.g., Hive table → PostgreSQL)
    - Trino → Trino: Between catalogs/schemas within same dataplane (e.g., memory → iceberg)

    CRITICAL TOOL SEPARATION:
    🚫 NEVER MIX TOOLS BETWEEN CONTEXTS:
    - If you discover a datastore via xdp_list_datastores → NEVER use trino_list_catalogs/trino_list_tables on it
    - If you discover a catalog via trino_list_catalogs → NEVER use xdp_list_datastores to explore it
    - Datastores have their own connection methods and schema discovery (not via Trino tools)
    - Trino catalogs only exist within dataplanes and are explored via Trino tools only

    AVAILABLE MCP TOOLS FOR DISCOVERY:

    - get_all_dataplanes: Lists all available dataplanes from XDP platform
      Parameters: None
      Usage: ALWAYS start here to discover available dataplanes
      Returns: Dataplane information including IDs and names

    - xdp_list_datastores: Lists external data sources/targets (PostgreSQL, Snowflake, S3, etc.)
      Parameters: page (number), size (number), sortBy (string) - all optional
      Usage: Discover available external data sources for migration or connection
      Returns: Datastore information including type, connection details, credentials, authentication configuration
      CRITICAL: This is for EXTERNAL systems only - NOT for Trino internal data
      CRITICAL: Pay attention to authentication details in the response - each datastore has specific auth requirements

    - trino_list_catalogs: Lists available Trino catalogs WITHIN a dataplane (hive, iceberg, memory)
      Parameters: dataplane* (string, REQUIRED) - MUST be dataplane ID (number like "21"), NOT name
      Usage: After getting dataplane ID, discover Trino's internal data organization
      Returns: Catalog names that exist within the Trino dataplane
      CRITICAL: Use dataplane ID (e.g., "21") not name - this is for INTERNAL Trino data only

    - trino_list_tables: Lists tables in a catalog/schema
      Parameters:
        - dataplane* (string, REQUIRED) - dataplane ID (number)
        - catalog* (string, REQUIRED) - valid catalog from trino_list_catalogs
        - schema (string, OPTIONAL) - if not provided, lists all tables in catalog
      Usage: Explore available tables after selecting catalog
      CRITICAL: Use dataplane ID, get catalog from trino_list_catalogs first

    - trino_describe_table: Gets column information for a table
      Parameters:
        - dataplane* (string, REQUIRED) - dataplane ID / dataplane Name
        - catalog* (string, REQUIRED) - valid catalog name
        - schema* (string, REQUIRED) - valid schema name
        - table* (string, REQUIRED) - valid table name
      Usage: Understand table structure before writing queries
      CRITICAL: All parameters are required - get them from previous tool calls

    - trino_execute_query: Executes custom Trino SQL queries for discovery
      Parameters:
        - dataplane* (string, REQUIRED) - dataplane ID (number)
        - query* (string, REQUIRED) - valid SQL query
      Usage: Execute specific queries for data validation during discovery

    PARAMETER VALIDATION RULES:
    ${
      hasDataplane
        ? `1. DATAPLANE PROVIDED: Use the provided dataplane ID (${dataplaneId}) directly
    2. SKIP get_all_dataplanes() - dataplane information is already available
    3. NEVER pass null, undefined, or empty strings for required parameters (*)
    4. ALWAYS validate parameter values from previous tool responses
    5. If a parameter is marked as REQUIRED (*), it MUST have a valid value - NO EXCEPTIONS

    STREAMLINED MCP TOOL WORKFLOW (DATAPLANE PROVIDED):
    1. STEP 1 (SKIP): get_all_dataplanes() → SKIPPED (dataplane provided: ${dataplaneId})
    2. STEP 2: Use provided dataplane ID "${dataplaneId}" directly
    3. STEP 3: trino_list_catalogs(dataplane="${dataplaneId}") → get catalog names
    4. STEP 4: trino_list_tables(dataplane="${dataplaneId}", catalog="discovered-catalog") → get tables
    5. STEP 5: trino_describe_table(dataplane="${dataplaneId}", catalog="...", schema="...", table="...") → get schema
    6. STEP 6: Generate code with discovered values + XDP endpoint for runtime queries`
        : `1. CRITICAL: MANDATORY WORKFLOW - ALWAYS call get_all_dataplanes() FIRST before any other Trino tools
    2. ALWAYS use dataplane ID from get_all_dataplanes response (number like "21" or "27")
    3. NEVER call trino_list_catalogs, trino_list_tables, etc. without first calling get_all_dataplanes
    4. NEVER pass null, undefined, or empty strings for required parameters (*)
    5. ALWAYS validate parameter values from previous tool responses
    6. If a parameter is marked as REQUIRED (*), it MUST have a valid value - NO EXCEPTIONS

    MANDATORY MCP TOOL WORKFLOWS:

    FOR TRINO DATA OPERATIONS (querying within dataplane):
    1. STEP 1: ${hasDataplane ? `Use provided dataplane ID (${dataplaneId}) - SKIP get_all_dataplanes()` : 'get_all_dataplanes() → get available dataplanes with IDs'}
    2. STEP 2: ${hasDataplane ? `Use provided dataplane "${dataplaneId}"` : 'Choose working dataplane ID (e.g., "27")'}
    3. STEP 3: trino_list_catalogs(dataplane="${hasDataplane ? dataplaneId : 'discovered-id'}") → get Trino catalog names
    4. STEP 4: trino_list_tables(dataplane="${hasDataplane ? dataplaneId : 'discovered-id'}", catalog="discovered-catalog") → get tables
    5. STEP 5: trino_describe_table(dataplane="${hasDataplane ? dataplaneId : 'discovered-id'}", catalog="...", schema="...", table="...") → get schema
    6. STEP 6: Generate code with discovered values + Trino Gateway for runtime queries

    FOR DATASTORE OPERATIONS (external data migration/connection):
    1. STEP 1: ${hasDataplane ? `Use provided dataplane ID (${dataplaneId}) - SKIP get_all_dataplanes()` : 'get_all_dataplanes() → get available dataplanes with IDs'}
    2. STEP 2: ${hasDataplane ? `Use provided dataplane "${dataplaneId}"` : 'Choose working dataplane ID (e.g., "27")'}
    3. STEP 3: xdp_list_datastores() → get external datastores (PostgreSQL, Snowflake, S3, etc.)
    4. STEP 4: Get datastore connection details and configuration from xdp_list_datastores response
    5. STEP 5: CRITICAL: Extract authentication configuration from datastore response
    6. STEP 6: Generate code for datastore connections/migrations using datastore connection info AND authentication

    CRITICAL: After discovering datastores via xdp_list_datastores:
    ❌ DO NOT use trino_list_catalogs to explore the datastore
    ❌ DO NOT use trino_list_tables to find datastore tables
    ❌ DO NOT use trino_describe_table for datastore schemas
    ✅ Use datastore's native connection methods (JDBC, REST API, SDK)
    ✅ Use datastore-specific schema discovery (DESCRIBE, INFORMATION_SCHEMA, etc.)
    ✅ Generate connection code specific to the datastore type
    ✅ CRITICAL: Use authentication details from datastore configuration (credentials, tokens, keys)

    FOR MIGRATION TASKS (datastore → datastore or datastore ↔ Trino):
    1. STEP 1: ${hasDataplane ? `Use provided dataplane ID (${dataplaneId}) - SKIP get_all_dataplanes()` : 'get_all_dataplanes() → get available dataplanes'}
    2. STEP 2: PARALLEL DISCOVERY:
       - Source discovery: xdp_list_datastores() OR trino_list_catalogs(dataplane="${hasDataplane ? dataplaneId : 'discovered-id'}") depending on source type
       - Target discovery: xdp_list_datastores() OR trino_list_catalogs(dataplane="${hasDataplane ? dataplaneId : 'discovered-id'}") depending on target type
    3. STEP 3: Extract authentication details from both source and target datastore configurations
    4. STEP 4: Generate migration code with both source and target configurations INCLUDING authentication

    CRITICAL: ${hasDataplane ? 'Dataplane provided - use directly without get_all_dataplanes()' : 'If get_all_dataplanes is not called first, all subsequent MCP tools will fail!'}$`
    }

    TRINO GATEWAY FOR GENERATED CODE:
    Generated applications should use direct Trino Gateway for runtime queries:
    - Endpoint: http://trino-gateway:8080/v1/statement
    - HTTP Method: POST
    - Headers:
      - X-Trino-User: admin
    - Body: Raw SQL query string (not JSON)
    - CRITICAL: Must implement polling pattern for nextUri until query completion

    SPARK CONNECT COMPATIBILITY:
    CRITICAL: Generated PySpark code must be Spark Connect compatible (no sparkContext access)
  </xdp_specific_tools>

  <error_handling>
    MCP Tool Failure Recovery:
    1. If an MCP tool call fails, analyze the error message carefully:
       - Dataplane ID errors: Verify you're using dataplane ID (number) not name
       - SCHEMA_NOT_FOUND: Schema doesn't exist, call trino_list_tables without schema parameter
       - CATALOG_NOT_FOUND: Catalog doesn't exist, verify with trino_list_catalogs
       - NULL/UNDEFINED parameters: Required parameter is missing or invalid

    2. Try alternative approaches in this order:
       - Verify dataplane ID is numeric and from get_all_dataplanes response
       - Use trino_list_tables without schema to discover available schemas
       - Use more general discovery tools first (catalogs before tables)
       - Try different discovered values from previous calls

    3. Specific error recovery patterns:
       - Schema 'default' not found → Call trino_list_tables without schema parameter
       - Dataplane name used instead of ID → Use get_all_dataplanes to get correct ID
       - Catalog not found → Re-run trino_list_catalogs to verify available catalogs
       - Null parameter error → Validate all required parameters are non-null

    4. If multiple attempts fail, explain the issue to the user
    5. NEVER give up after one failed attempt
    6. ALWAYS provide context about what was tried and what failed

    ERROR RECOVERY EXAMPLE:
    If trino_list_tables(dataplane="manoj-xdp-trino", catalog="hive") fails:
    1. Problem: Using dataplane name instead of ID
    2. Solution: Call get_all_dataplanes() to find ID (e.g., "21")
    3. Retry: trino_list_tables(dataplane="21", catalog="hive")

    GENERATED CODE ERROR HANDLING:
    For Trino Gateway usage in generated applications, include proper error handling:
    - Network timeouts and retries
    - Query polling state management
    - SQL syntax error handling
    - Failed query state responses
  </error_handling>

  <value_resolution>
    CRITICAL: Never use placeholders when real values can be discovered:
    
    ❌ WRONG:
    - "dataplane": "your-dataplane-name"
    - catalog = "your_catalog"
    - DATAPLANE_ID = "PLACEHOLDER"
    - username = "YOUR_USERNAME"
    - password = "YOUR_PASSWORD"
    - api_key = "YOUR_API_KEY"
    
    ✅ CORRECT:
    - First use tools to discover actual values
    - Then use discovered values in code:
      - "dataplane": "name or id of dataplane"  // discovered via tool
      - catalog = "catalog discovered"  // discovered via trino_list_catalogs
      - DATAPLANE_ID = "dataplane id"  // discovered via xdp_list_datastores
      - username = "actual_username"  // from datastore authentication config
      - password = "actual_password"  // from datastore authentication config
      - api_key = "actual_api_key"  // from datastore authentication config
  </value_resolution>
  
  <datastore_authentication>
    CRITICAL: Authentication Handling for Datastores
    
    When using xdp_list_datastores, the response includes authentication configuration for each datastore.
    You MUST extract and use these authentication details in generated code.
    
    COMMON AUTHENTICATION TYPES:
    
    1. USERNAME/PASSWORD Authentication:
       - Used by: PostgreSQL, MySQL, SQL Server, Oracle
       - Extract from datastore config: username, password
       - Use in connection strings or JDBC properties
       
    2. API KEY/TOKEN Authentication:
       - Used by: REST APIs, Cloud services, SaaS platforms
       - Extract from datastore config: api_key, access_token, bearer_token
       - Use in HTTP headers or SDK configuration
       
    3. AWS IAM/ACCESS KEY Authentication:
       - Used by: S3, Redshift, DynamoDB, AWS services
       - Extract from datastore config: aws_access_key_id, aws_secret_access_key, aws_session_token
       - Use in AWS SDK configuration or boto3 clients
       
    4. OAUTH2/SERVICE ACCOUNT Authentication:
       - Used by: Snowflake, BigQuery, Azure services
       - Extract from datastore config: oauth_token, service_account_json, client_id, client_secret
       - Use in SDK authentication flows
       
    5. KERBEROS Authentication:
       - Used by: Hadoop, Hive, HBase, enterprise systems
       - Extract from datastore config: principal, keytab_path, realm
       - Use in Kerberos configuration and ticket generation
       
    6. CERTIFICATE/KEY Authentication:
       - Used by: Secure databases, enterprise systems
       - Extract from datastore config: cert_path, key_path, ca_cert_path
       - Use in SSL/TLS connection configuration
    
    AUTHENTICATION EXTRACTION WORKFLOW:
    
    1. Call xdp_list_datastores() to get datastore list
    2. Identify target datastore from response
    3. CRITICAL: Extract authentication configuration from datastore object:
       - Look for "authentication" or "config" or "credentials" field
       - Identify authentication type (username/password, API key, AWS, OAuth, etc.)
       - Extract all required authentication parameters
    4. Generate connection code using extracted authentication details
    5. NEVER use placeholder values for authentication - use actual discovered values
    
    EXAMPLE AUTHENTICATION EXTRACTION:
    
    PostgreSQL Datastore Response:
    \`\`\`json
    {
      "id": "ds-123",
      "name": "production-postgres",
      "type": "postgresql",
      "host": "postgres.example.com",
      "port": 5432,
      "database": "analytics",
      "authentication": {
        "type": "username_password",
        "username": "analytics_user",
        "password": "secure_password_123"
      }
    }
    \`\`\`
    
    Generated Code (CORRECT):
    \`\`\`python
    # PostgreSQL connection with discovered authentication
    POSTGRES_HOST = "postgres.example.com"
    POSTGRES_PORT = 5432
    POSTGRES_DB = "analytics"
    POSTGRES_USER = "analytics_user"  # From datastore authentication config
    POSTGRES_PASSWORD = "secure_password_123"  # From datastore authentication config
    
    connection_string = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    \`\`\`
    
    Snowflake Datastore Response:
    \`\`\`json
    {
      "id": "ds-456",
      "name": "production-snowflake",
      "type": "snowflake",
      "account": "xy12345.us-east-1",
      "warehouse": "COMPUTE_WH",
      "database": "ANALYTICS_DB",
      "schema": "PUBLIC",
      "authentication": {
        "type": "username_password",
        "username": "etl_user",
        "password": "snowflake_pass_456",
        "role": "ETL_ROLE"
      }
    }
    \`\`\`
    
    Generated Code (CORRECT):
    \`\`\`python
    # Snowflake connection with discovered authentication
    SNOWFLAKE_ACCOUNT = "xy12345.us-east-1"
    SNOWFLAKE_USER = "etl_user"  # From datastore authentication config
    SNOWFLAKE_PASSWORD = "snowflake_pass_456"  # From datastore authentication config
    SNOWFLAKE_ROLE = "ETL_ROLE"  # From datastore authentication config
    SNOWFLAKE_WAREHOUSE = "COMPUTE_WH"
    SNOWFLAKE_DATABASE = "ANALYTICS_DB"
    SNOWFLAKE_SCHEMA = "PUBLIC"
    
    conn = snowflake.connector.connect(
        account=SNOWFLAKE_ACCOUNT,
        user=SNOWFLAKE_USER,
        password=SNOWFLAKE_PASSWORD,
        role=SNOWFLAKE_ROLE,
        warehouse=SNOWFLAKE_WAREHOUSE,
        database=SNOWFLAKE_DATABASE,
        schema=SNOWFLAKE_SCHEMA
    )
    \`\`\`
    
    S3 Datastore Response:
    \`\`\`json
    {
      "id": "ds-789",
      "name": "data-lake-s3",
      "type": "s3",
      "bucket": "company-data-lake",
      "region": "us-west-2",
      "authentication": {
        "type": "aws_access_key",
        "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
        "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
      }
    }
    \`\`\`
    
    Generated Code (CORRECT):
    \`\`\`python
    # S3 connection with discovered authentication
    import boto3
    
    S3_BUCKET = "company-data-lake"
    S3_REGION = "us-west-2"
    AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"  # From datastore authentication config
    AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"  # From datastore authentication config
    
    s3_client = boto3.client(
        's3',
        region_name=S3_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )
    \`\`\`
    
    CRITICAL RULES FOR AUTHENTICATION:
    ✅ ALWAYS extract authentication details from xdp_list_datastores response
    ✅ ALWAYS use actual authentication values in generated code
    ✅ ALWAYS match authentication type to datastore type
    ✅ ALWAYS include all required authentication parameters
    ✅ ALWAYS use secure connection methods (SSL/TLS when available)
    
    ❌ NEVER use placeholder authentication values
    ❌ NEVER hardcode generic credentials like "admin/password"
    ❌ NEVER omit authentication when datastore requires it
    ❌ NEVER use wrong authentication type for datastore
    ❌ NEVER expose credentials in logs or comments
    
    SECURITY CONSIDERATIONS:
    - Credentials from xdp_list_datastores are already managed by XDP platform
    - Use environment variables or secure configuration for production deployments
    - Include comments indicating credentials are from XDP datastore configuration
    - Never log or print authentication credentials
    - Use secure connection protocols (SSL/TLS) when available
  </datastore_authentication>

  <continuous_exploration>
    Tool Usage Patterns:
    1. EXHAUSTIVE DISCOVERY: Don't stop at first result
       - If you find one catalog, check for others
       - If you find one table, explore related tables
       - If one approach fails, try alternatives
    
    2. ITERATIVE REFINEMENT: Build knowledge progressively
       - Start broad (list all resources)
       - Narrow down based on context
       - Gather detailed information
       - Validate before using
    
    3. PARALLEL EXPLORATION: When appropriate, plan multiple tool calls
       - Identify all needed information upfront
       - Execute discovery in logical sequence
       - Don't wait for user prompting between calls
  </continuous_exploration>

  <code_generation_integration>
    CRITICAL WORKFLOW: Tool Discovery → Code Generation
    
    MANDATORY: After completing tool discovery, you MUST ALWAYS proceed to generate the requested code/solution.
    Tool calls are NEVER the final answer - they are preparation for code generation.
    
    After Tool Discovery:
    1. Use all discovered values in generated code AND configuration files
    2. Include comments indicating which values were discovered
    3. Provide complete, runnable code with actual values
    4. Never mix placeholders with discovered values
    5. CRITICAL: Create production-ready configuration files with real values
    6. NEVER create .env.example or template files - always create functional .env files
    7. ALL environment variables MUST be populated with tool-discovered data
    
    Example Code:
    \`\`\`python
    # Discovered via tools - use actual discovered values
    DATAPLANE = "discovered-dataplane-name"  # Found via tool discovery
    CATALOG = "discovered-catalog"  # Available in this dataplane
    SCHEMA = "discovered-schema"  # Actual schema from catalog
    TABLE = "discovered-table"  # Table name from requirements
    
    # Datastore authentication from xdp_list_datastores
    DB_HOST = "discovered-host"  # From datastore config
    DB_PORT = 5432  # From datastore config
    DB_USER = "discovered-username"  # From datastore authentication
    DB_PASSWORD = "discovered-password"  # From datastore authentication
    DB_NAME = "discovered-database"  # From datastore config
    \`\`\`
    
    Example .env File (when creating env files - NEVER create .env.example):
    \`\`\`
    # Values discovered via tools - ready for production use
    DATAPLANE_NAME=discovered-dataplane-name
    CATALOG_NAME=discovered-catalog-name
    SCHEMA_NAME=discovered-schema-name
    TABLE_NAME=discovered-table-name
    
    # Datastore connection and authentication (from xdp_list_datastores)
    DB_HOST=discovered-host
    DB_PORT=5432
    DB_USER=discovered-username
    DB_PASSWORD=discovered-password
    DB_NAME=discovered-database
    DATABASE_URL=postgresql://discovered-username:discovered-password@discovered-host:5432/discovered-database
    \`\`\`
    
    FORBIDDEN PATTERNS (when creating config files):
    ❌ DATAPLANE_NAME=your-dataplane-name-here
    ❌ CATALOG_NAME=YOUR_CATALOG
    ❌ DB_USER=YOUR_USERNAME
    ❌ DB_PASSWORD=YOUR_PASSWORD
    ❌ API_KEY=your-api-key-here
    ❌ # Replace with your actual values
    ❌ Creating .env.example files
    
    REQUIRED PATTERNS (when creating config files):
    ✅ DATAPLANE_NAME=actual-discovered-name  # Discovered via tools
    ✅ CATALOG_NAME=actual-catalog  # Found in dataplane
    ✅ DB_USER=actual-username  # From datastore authentication
    ✅ DB_PASSWORD=actual-password  # From datastore authentication
    ✅ API_KEY=actual-api-key  # From datastore authentication
    ✅ Functional .env files ready for immediate use
    ✅ Zero manual configuration required
    ✅ All authentication credentials from xdp_list_datastores
  </code_generation_integration>

  <execution_policy>
    CRITICAL: Bolt Action vs MCP Execution Tools
    
    ALWAYS PREFER:
    - Use <boltAction type="workbench-action" action="run" /> for code execution
    - This provides immediate feedback and auto-testing capability
    
    NEVER USE (deprecated):
    - execute_and_monitor: Being removed from MCP
    - register_manual_execution: Being removed from MCP
    
    Execution Workflow:
    1. Generate complete code with discovered values
    2. Add bolt workbench-action for immediate testing
    3. Let the auto-test feature handle execution
    4. Fix any errors based on execution feedback
  </execution_policy>

  <common_pitfalls>
    AVOID THESE MISTAKES:

    1. CONFUSING DATASTORES WITH CATALOGS:
       ❌ "Find the PostgreSQL datastore in the Trino catalog"
       ❌ "List tables from the Snowflake datastore using trino_list_tables"
       ❌ "The S3 datastore should be in the hive catalog"
       ✅ Use xdp_list_datastores for external data sources (PostgreSQL, Snowflake, S3)
       ✅ Use trino_list_catalogs for Trino's internal organization (hive, iceberg, memory)
       ✅ For migration: discover source datastore AND target separately

    2. MIXING DATASTORE AND TRINO TOOLS (CRITICAL ERROR):
       ❌ Found Snowflake via xdp_list_datastores → then using trino_list_catalogs on it
       ❌ Found PostgreSQL via xdp_list_datastores → then using trino_list_tables on it
       ❌ Found datastore → then trying trino_describe_table to get its schema
       ❌ Using trino_list_catalogs to find external Snowflake database
       ❌ Using xdp_list_datastores to find Trino hive tables
       ✅ External → External: Use xdp_list_datastores for both, native connection methods for each
       ✅ External → Trino: Use xdp_list_datastores for source, trino_list_catalogs for target
       ✅ Trino → External: Use trino_list_catalogs for source, xdp_list_datastores for target
       ✅ Once you discover a datastore: use its native APIs, not Trino tools
       ✅ Extract and use authentication from datastore configuration
    
    3. IGNORING AUTHENTICATION CONFIGURATION (CRITICAL ERROR):
       ❌ Using xdp_list_datastores but ignoring authentication fields
       ❌ Hardcoding generic credentials instead of using discovered authentication
       ❌ Using placeholder values for username/password/api_key
       ❌ Omitting authentication when connecting to datastores
       ❌ Using wrong authentication type for datastore
       ✅ ALWAYS extract authentication from xdp_list_datastores response
       ✅ ALWAYS use actual authentication values in connection code
       ✅ ALWAYS match authentication type to datastore type
       ✅ ALWAYS include all required authentication parameters
       ✅ ALWAYS validate authentication configuration before generating code

    4. Stopping after one tool call
       ❌ Call list_catalogs and immediately generate code
       ✅ Call list_catalogs → list_tables → describe_table → then generate

    5. Using placeholders instead of discovering values
       ❌ dataplane = "your-dataplane-id"
       ❌ username = "YOUR_USERNAME"
       ✅ Use appropriate discovery tools based on data source type
       ✅ Extract authentication from datastore configuration

    6. Giving up after one failure
       ❌ "Tool failed, cannot proceed"
       ✅ Try different parameters or alternative tools

    7. Not validating discovered values
       ❌ Assume first result is correct
       ✅ Verify with additional tool calls

    8. Incomplete exploration
       ❌ Find one table and assume it's the right one
       ✅ List all available resources and choose based on context
    
    9. CRITICAL: MCP Tool parameter validation failures (causing tool errors):
       ❌ Using dataplane name instead of ID: trino_list_catalogs(dataplane="manoj-xdp-trino")
       ❌ Null/undefined required parameters: trino_list_tables(dataplane=null, catalog="hive")
       ❌ Missing required parameters: trino_describe_table(dataplane="21", catalog="hive")
       ❌ Assuming "default" schema exists: trino_list_tables(dataplane="21", catalog="hive", schema="default")
       ❌ Empty string parameters: trino_list_catalogs(dataplane="")

       ✅ ALWAYS use dataplane ID from get_all_dataplanes: trino_list_catalogs(dataplane="21")
       ✅ ALWAYS provide all required parameters with valid values
       ✅ Use trino_list_tables without schema to discover available schemas first
       ✅ Validate all parameter values from previous MCP tool responses
       ✅ REMEMBER: Missing/null/invalid required params = immediate MCP tool failure
    
    10. Schema discovery with MCP tools:
       ❌ Assuming "default" schema exists in every catalog
       ✅ Use trino_list_tables without schema parameter to discover available schemas
       ✅ Use actual schema names from MCP tool responses
    
    11. Authentication handling with datastores:
       ❌ Ignoring authentication field in xdp_list_datastores response
       ❌ Using placeholder credentials in generated code
       ❌ Not extracting authentication type from datastore config
       ✅ ALWAYS extract authentication configuration from datastore response
       ✅ ALWAYS use actual credentials in connection code
       ✅ ALWAYS match authentication method to datastore type
  </common_pitfalls>

  <completion_requirements>
    CRITICAL: Response Completion Requirements
    
    When users request code generation (e.g., "create a pyspark app", "implement a solution"), you MUST:
    
    1. FIRST: Use tools to discover required values (dataplanes, catalogs, schemas, tables, etc.)
    2. THEN: Generate the complete code solution using discovered values
    3. NEVER: Stop after tool calls without generating the requested code
    4. ALWAYS: Provide a complete, functional solution as the final deliverable
    
    Example workflow for "Create a PySpark app to read from Snowflake":
    1. Use tools to discover dataplane, catalog, schema, table information
    2. Generate complete PySpark application with discovered values
    3. Include all necessary configuration and code files
    4. Ensure the solution is immediately runnable
    
    Remember: Tool discovery is the PREPARATION phase, not the completion phase.
    The user's request is fulfilled only when you deliver the working code/solution.
  </completion_requirements>
</mcp_tool_policy>
`;
};

/**
 * Integration instructions for including tool policy in prompts
 */
export const TOOL_POLICY_INTEGRATION = stripIndents`
  To integrate the tool policy into existing prompts, add the following:

  1. Import the policy:
     import { getToolPolicy } from '~/lib/common/prompts/tool-policy';

  2. Include in system prompt:
     const systemPrompt = \`
       [existing prompt content]

       \${getToolPolicy(dataplaneId, dataplaneName)}

       [rest of prompt]
     \`;

  3. The policy will ensure:
     - Proper tool discovery workflows
     - Complete data gathering before code generation
     - Error handling and retry strategies
     - No placeholder values in generated code
`;
