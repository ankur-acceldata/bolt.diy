import { stripIndents } from '~/utils/stripIndent';

/**
 * Comprehensive MCP Tool Usage Policy
 *
 * This policy ensures proper tool discovery, execution, and error handling
 * for all MCP tools available in the system.
 */
export const getToolPolicy = () => stripIndents`
<mcp_tool_policy>
  <critical_instructions>
    You have access to Model Context Protocol (MCP) tools that provide real-time data and system interactions.
    
    MANDATORY RULES:
    1. ALWAYS use tools first before generating code or responses that depend on external systems
    2. NEVER fabricate values - if you cannot determine a value through tools, ask for clarification
    3. Chain tool calls iteratively to gather complete information
    4. Continue tool exploration until you have all required data
    5. Handle tool failures gracefully - retry with different approaches or inform the user
    
    TOOL CALLING DISCIPLINE:
    - NEVER call tools with null, undefined, or invalid parameters
    - ALWAYS validate required parameters have real values from previous tool responses
    - If you don't have a required parameter value, call discovery tools first
    - When tools fail, analyze the error and adjust parameters before retrying
    - Ask user for clarification ONLY if tools cannot provide the needed information
    
    PARAMETER VALIDATION CHECKLIST before calling any tool:
    ✓ All required parameters have non-null, non-empty values
    ✓ Parameter values come from previous successful tool responses
    ✓ Optional parameters are either valid or omitted entirely
    ✓ No assumptions about default values (like "default" schema)
  </critical_instructions>

  <tool_discovery_workflow>
    When working with external systems:
    1. Start with discovery tools (list/describe operations) to understand available resources
    2. Use the discovered information to make more specific queries
    3. Validate assumptions with safe read operations before generating code
    4. Never stop at the first tool call - explore until you have complete information
    
    Example workflows:
    - For databases: list_catalogs → list_tables → describe_table → execute_query
    - For platforms: list_dataplanes → list_datastores → get_specific_details
  </tool_discovery_workflow>

  <xdp_specific_tools>
    XDP Platform Tools with MANDATORY parameter validation:
    
    - xdp_list_datastores: Lists all data stores with pagination support
      Parameters: page (number), size (number), sortBy (string) - all optional
      Usage: Start here to discover available data stores
      
    - trino_list_catalogs: Lists available Trino catalogs for a dataplane
      Parameters: dataplane* (string, REQUIRED) - must be valid dataplane name
      Usage: After getting dataplane info, discover available catalogs
      CRITICAL: Only call with valid dataplane name from xdp_list_datastores
      
    - trino_list_tables: Lists tables in a catalog/schema
      Parameters: 
        - dataplane* (string, REQUIRED) - valid dataplane name
        - catalog* (string, REQUIRED) - valid catalog from trino_list_catalogs
        - schema (string, OPTIONAL) - if not provided, lists all schemas
      Usage: Explore available tables after selecting catalog
      CRITICAL: 
        - NEVER pass null or undefined for required parameters
        - ALWAYS get catalog from trino_list_catalogs first
        - If schema doesn't exist, call without schema parameter to list all
      
    - trino_describe_table: Gets column information for a table
      Parameters:
        - dataplane* (string, REQUIRED) - valid dataplane name
        - catalog* (string, REQUIRED) - valid catalog name
        - schema* (string, REQUIRED) - valid schema name
        - table* (string, REQUIRED) - valid table name
      Usage: Understand table structure before writing queries
      CRITICAL: All parameters are required - get them from previous tool calls
      
    - trino_execute_query: Executes custom Trino SQL queries
      Parameters:
        - dataplane* (string, REQUIRED) - valid dataplane name
        - query* (string, REQUIRED) - valid SQL query
      Usage: Validate data or perform operations after understanding structure

    PARAMETER VALIDATION RULES:
    1. NEVER pass null, undefined, or empty strings for required parameters
    2. ALWAYS validate parameter values from previous tool responses
    3. If a parameter is marked as REQUIRED (*), it MUST have a valid value
    4. For optional parameters, either provide valid value or omit entirely
    5. Schema names like 'default' may not exist - validate before using

    CORRECT WORKFLOW EXAMPLE:
    1. xdp_list_datastores() → get dataplane names
    2. trino_list_catalogs(dataplane="actual-dataplane-name") → get catalog names
    3. trino_list_tables(dataplane="actual-dataplane-name", catalog="actual-catalog") → get tables
    4. trino_describe_table(dataplane="...", catalog="...", schema="...", table="...") → get schema
    5. Generate code with all discovered real values

    COMMON ERRORS TO AVOID:
    ❌ trino_list_tables(dataplane="dp1", catalog="hive", schema="default") // 'default' may not exist
    ❌ trino_list_tables(dataplane="dp1", catalog=null) // null not allowed
    ❌ trino_describe_table(dataplane="dp1", catalog="hive", schema=null, table="users") // required param is null
    
    ✅ trino_list_catalogs(dataplane="discovered-dataplane-name") // use real name
    ✅ trino_list_tables(dataplane="discovered-dataplane-name", catalog="discovered-catalog") // use real values
    ✅ trino_list_tables(dataplane="discovered-dataplane-name", catalog="discovered-catalog") // omit schema to see all
  </xdp_specific_tools>

  <error_handling>
    Tool Failure Recovery:
    1. If a tool call fails, analyze the error message carefully:
       - SCHEMA_NOT_FOUND: Schema doesn't exist, call without schema parameter
       - SYNTAX_ERROR with 'null': Required parameter is null/undefined
       - EXECUTION errors: Check parameter validity
    
    2. Try alternative approaches in this order:
       - Fix parameter validation (remove nulls, use real values)
       - Call without optional parameters (especially schema)
       - Use more general query first (list all, then filter)
       - Try different discovered values from previous calls
    
    3. Specific error recovery patterns:
       - Schema 'default' not found → Call trino_list_tables without schema
       - Null parameter error → Validate all required parameters are non-null
       - Catalog not found → Re-run trino_list_catalogs to verify available catalogs
    
    4. If multiple attempts fail, explain the issue to the user
    5. NEVER give up after one failed attempt
    6. ALWAYS provide context about what was tried and what failed
    
    ERROR RECOVERY EXAMPLE:
    If trino_list_tables(dataplane="dp1", catalog="hive", schema="default") fails with "Schema 'default' does not exist":
    1. Retry: trino_list_tables(dataplane="dp1", catalog="hive") // without schema
    2. This will list all available schemas in the catalog
    3. Use the actual schema names from the response for subsequent calls
  </error_handling>

  <value_resolution>
    CRITICAL: Never use placeholders when real values can be discovered:
    
    ❌ WRONG:
    - "dataplane": "your-dataplane-name"
    - catalog = "your_catalog"
    - DATAPLANE_ID = "PLACEHOLDER"
    
    ✅ CORRECT:
    - First use tools to discover actual values
    - Then use discovered values in code:
      - "dataplane": "manoj-xdp-trino-dp3"  // discovered via tool
      - catalog = "hive"  // discovered via trino_list_catalogs
      - DATAPLANE_ID = "17"  // discovered via xdp_list_datastores
  </value_resolution>

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
    After Tool Discovery:
    1. Use all discovered values in generated code
    2. Include comments indicating which values were discovered
    3. Provide complete, runnable code with actual values
    4. Never mix placeholders with discovered values
    
    Example:
    \`\`\`python
    # Discovered via xdp_list_datastores and trino tools
    DATAPLANE = "manoj-xdp-trino-dp3"  # Found in datastore ID 17
    CATALOG = "hive"  # Available in this dataplane
    SCHEMA = "default"  # Default schema in hive catalog
    TABLE = "bhuvan"  # Table to be created
    \`\`\`
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
    
    1. Stopping after one tool call
       ❌ Call list_catalogs and immediately generate code
       ✅ Call list_catalogs → list_tables → describe_table → then generate
    
    2. Using placeholders instead of discovering values
       ❌ dataplane = "your-dataplane-id"
       ✅ Use xdp_list_datastores to find actual dataplane
    
    3. Giving up after one failure
       ❌ "Tool failed, cannot proceed"
       ✅ Try different parameters or alternative tools
    
    4. Not validating discovered values
       ❌ Assume first result is correct
       ✅ Verify with additional tool calls
    
    5. Incomplete exploration
       ❌ Find one table and assume it's the right one
       ✅ List all tables and choose based on context
    
    6. CRITICAL: Parameter validation failures (causing your errors):
       ❌ trino_list_tables(dataplane="dp1", catalog="hive", schema="default")
           // Assumes "default" schema exists - causes SCHEMA_NOT_FOUND
       ❌ trino_list_tables(dataplane="dp1", catalog=null)
           // Null required parameter - causes SYNTAX_ERROR
       ❌ trino_describe_table(dataplane="dp1", catalog="hive", schema=undefined, table="users")
           // Undefined required parameter - causes mismatched input 'null'
       
       ✅ First call trino_list_catalogs(dataplane="dp1") to get available catalogs
       ✅ Then call trino_list_tables(dataplane="dp1", catalog="discovered-catalog")
       ✅ Use response to find actual schemas, don't assume "default" exists
       ✅ Always validate parameters are non-null before calling tools
    
    7. Schema assumption errors:
       ❌ Assuming "default" schema exists in every catalog
       ✅ Call trino_list_tables without schema to discover available schemas
       ✅ Use actual schema names from the tool responses
  </common_pitfalls>
</mcp_tool_policy>
`;

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
       
       \${getToolPolicy()}
       
       [rest of prompt]
     \`;
  
  3. The policy will ensure:
     - Proper tool discovery workflows
     - Complete data gathering before code generation
     - Error handling and retry strategies
     - No placeholder values in generated code
`;
