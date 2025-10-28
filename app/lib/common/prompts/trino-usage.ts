import { stripIndents } from '~/utils/stripIndent';

/**
 * Comprehensive Trino SQL Engine Usage Guidelines
 *
 * This guide provides best practices and patterns for using Trino SQL engine
 * with the internal XDP platform endpoint for PySpark applications.
 */
export const getTrinoUsageGuidelines = () => stripIndents`
<trino_usage_guidelines>
  <trino_gateway_configuration>
    MANDATORY: All Trino queries MUST use the direct Trino Gateway endpoint:
    URL: http://trino-gateway:8080/v1/statement

    Required Headers:
    - X-Trino-User: admin
    - Content-Type: application/json (optional)

    Request Format:
    - Method: POST
    - Body: Raw SQL query string (not JSON)
    - Example: POST http://trino-gateway:8080/v1/statement -H "X-Trino-User: admin" -d 'SELECT * FROM catalog.schema.table LIMIT 10'

    IMPORTANT: This is the direct Trino Gateway endpoint for query execution
  </trino_gateway_configuration>

  <trino_polling_pattern>
    CRITICAL: Trino Gateway uses asynchronous query execution with streaming pagination

    PAGINATION PATTERN - MUST UNDERSTAND:
    - Results are streamed via nextUri field
    - Data can appear in ANY response during polling (not just the last one)
    - MUST accumulate data throughout the ENTIRE polling loop
    - Polling ends when nextUri is ABSENT, not when state is FINISHED
    - This is a distributed query engine pattern where results are produced incrementally

    IMPORTANT: Both FINISHED and FINISHING are valid success states:
    - FINISHING: Query completed successfully, finalizing results
    - FINISHED: Query completed successfully, results available

    1. CURL EXAMPLE:
       \`\`\`bash
       # Initial request
       curl -X POST http://trino-gateway:8080/v1/statement \\
         -H "X-Trino-User: admin" \\
         -d 'SELECT * FROM catalog.schema.table LIMIT 10'

       # Poll the nextUri from response until nextUri is absent
       # IMPORTANT: Collect data from EVERY response, not just the last one
       curl -X GET "http://trino-gateway:8080/v1/statement/queued/QUERY_ID/TOKEN/1" \\
         -H "X-Trino-User: admin"
       \`\`\`

    2. INITIAL RESPONSE STRUCTURE:
       {
         "id": "20250925_151440_00030_fdtir",
         "infoUri": "http://trino-gateway:8080/ui/query.html?20250925_151440_00030_fdtir",
         "nextUri": "http://trino-gateway:8080/v1/statement/queued/20250925_151440_00030_fdtir/y062d61393b87ba31ca271b22c65a7f29cad49c88/1",
         "stats": {
           "state": "QUEUED",
           "queued": true,
           "scheduled": false,
           ...
         },
         "warnings": []
       }

    3. POLLING STATES:
       - QUEUED: Query is waiting to be executed
       - RUNNING: Query is currently executing
       - FINISHING: Query completed successfully, finalizing results (success state)
       - FINISHED: Query completed successfully, results available (success state)
       - FAILED: Query failed, check error field
       - CANCELED: Query was canceled

    4. MANDATORY POLLING LOGIC WITH DATA ACCUMULATION:
       \`\`\`python
       import requests
       import time
       import json

       def execute_trino_query_with_polling(query):
           # Initial request
           response = requests.post(
               'http://trino-gateway:8080/v1/statement',
               headers={'X-Trino-User': 'admin'},
               data=query
           )

           if response.status_code != 200:
               raise Exception(f"Failed to submit query: {response.status_code} {response.text}")

           result = response.json()
           query_id = result.get('id')
           print(f"Query submitted with ID: {query_id}")

           # CRITICAL: Accumulate data from ALL responses
           all_data = []
           columns = None

           # CRITICAL: Poll while nextUri exists (not based on state)
           while 'nextUri' in result:
               state = result['stats']['state']

               # CRITICAL: Collect data from EVERY response
               if 'data' in result and result['data']:
                   all_data.extend(result['data'])
                   print(f"Accumulated {len(result['data'])} rows (total: {len(all_data)})")

               # Capture column metadata (usually in first response with data)
               if 'columns' in result and not columns:
                   columns = result['columns']

               print(f"Query {query_id} state: {state}, polling...")
               time.sleep(1)  # Wait 1 second between polls

               # CRITICAL: Use the nextUri from previous response
               response = requests.get(
                   result['nextUri'],
                   headers={'X-Trino-User': 'admin'}
               )

               if response.status_code != 200:
                   raise Exception(f"Failed to poll query: {response.status_code} {response.text}")

               result = response.json()

           # CRITICAL: Collect data from final response (when nextUri is absent)
           if 'data' in result and result['data']:
               all_data.extend(result['data'])
               print(f"Accumulated {len(result['data'])} rows from final response (total: {len(all_data)})")

           if 'columns' in result and not columns:
               columns = result['columns']

           # Check final state
           final_state = result['stats']['state']
           print(f"Query {query_id} final state: {final_state}")

           if final_state in ['FINISHED', 'FINISHING']:
               print(f"Query completed successfully, total rows: {len(all_data)}")
               return {'data': all_data, 'columns': columns or [], 'stats': result['stats']}
           elif final_state == 'FAILED':
               error_info = result.get('error', {})
               error_msg = error_info.get('message', 'Unknown error')
               error_type = error_info.get('errorType', 'UNKNOWN')
               raise Exception(f"Trino query failed [{error_type}]: {error_msg}")
           else:
               raise Exception(f"Query ended in unexpected state: {final_state}")
       \`\`\`
  </trino_polling_pattern>

  <trino_sql_best_practices>
    CRITICAL RULES for Trino SQL Queries:

    1. CATALOG AND SCHEMA QUALIFICATION:
       - Always fully qualify table names: catalog.schema.table_name
       - Example: "SELECT * FROM hive.default.users LIMIT 10"
       - Never assume default catalog or schema

    2. PERFORMANCE OPTIMIZATION:
       - Use LIMIT clauses for exploratory queries
       - Apply WHERE filters early in the query
       - Use partition pruning when possible
       - Example: "WHERE date_partition >= '2024-01-01'"

    3. DATA TYPE HANDLING:
       - Use proper casting: CAST(column AS VARCHAR)
       - Handle NULLs explicitly: COALESCE(column, 'default_value')
       - Be aware of Trino's strict type system

    4. JOIN OPTIMIZATION:
       - Join smaller tables first, then larger ones
       - Use appropriate join types (INNER, LEFT, RIGHT, FULL)
       - Example: "SELECT a.*, b.name FROM small_table a JOIN large_table b ON a.id = b.id"

    5. AGGREGATION PATTERNS:
       - Use window functions for analytics
       - Example: "SELECT user_id, COUNT(*) OVER (PARTITION BY region) as regional_count FROM users"
       - Leverage GROUPING SETS, CUBE, ROLLUP for complex aggregations
  </trino_sql_best_practices>

  <common_trino_patterns>
    STANDARD QUERY PATTERNS:

    1. DATA EXPLORATION:
       "DESCRIBE catalog.schema.table_name"
       "SHOW TABLES IN catalog.schema"
       "SELECT * FROM catalog.schema.table_name LIMIT 100"

    2. METADATA QUERIES:
       "SHOW CATALOGS"
       "SHOW SCHEMAS IN catalog_name"
       "SHOW COLUMNS FROM catalog.schema.table_name"

    3. ANALYTICAL QUERIES:
       "SELECT
          region,
          COUNT(*) as total_records,
          AVG(revenue) as avg_revenue,
          MAX(created_date) as latest_date
        FROM catalog.schema.sales_data
        WHERE created_date >= CURRENT_DATE - INTERVAL '30' DAY
        GROUP BY region
        ORDER BY avg_revenue DESC"

    4. WINDOW FUNCTIONS:
       "SELECT
          customer_id,
          order_date,
          amount,
          ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) as order_sequence,
          SUM(amount) OVER (PARTITION BY customer_id ORDER BY order_date) as running_total
        FROM catalog.schema.orders"

    5. FILTERING AND PARTITIONING:
       "SELECT * FROM catalog.schema.events
        WHERE event_date = '2024-01-15'
        AND event_type IN ('click', 'purchase')
        ORDER BY timestamp DESC"
  </common_trino_patterns>

  <error_handling_patterns>
    TRINO ERROR HANDLING:

    1. COMMON ERRORS AND SOLUTIONS:
       - "Catalog not found" → Verify catalog exists with "SHOW CATALOGS"
       - "Schema not found" → Check available schemas with "SHOW SCHEMAS IN catalog"
       - "Table not found" → Verify table exists with "SHOW TABLES IN catalog.schema"
       - "Column not found" → Check column names with "DESCRIBE table"

    2. QUERY VALIDATION APPROACH:
       - Start with metadata queries (SHOW, DESCRIBE)
       - Test with LIMIT 1 before running full queries
       - Use EXPLAIN to understand query execution plans
       - Check data types before joining or filtering

    3. RETRY STRATEGIES:
       - Retry transient failures with exponential backoff
       - Break large queries into smaller chunks if memory errors occur
       - Use streaming results for large result sets
  </error_handling_patterns>

  <pyspark_trino_integration>
    INTEGRATING TRINO WITH PYSPARK:

    1. TRINO AS DATA SOURCE:
       - Use Trino to validate data before PySpark processing
       - Query metadata to understand schema before DataFrame operations
       - Use Trino for complex SQL that's difficult in PySpark

    2. WORKFLOW PATTERNS:
       a) Discover → Query → Process:
          - Use Trino to discover available data
          - Query sample data for validation
          - Process with PySpark DataFrames

       b) Validation → Transform → Load:
          - Validate data quality with Trino queries
          - Transform with PySpark
          - Load results back to storage

    IMPORTANT: Use Spark Connect compatible patterns (see python-prompt for details)

    3. EXAMPLE INTEGRATION CODE WITH DATA ACCUMULATION:
       \`\`\`python
       import requests
       import time
       import json
       from pyspark.sql import SparkSession

       def execute_trino_query(query):
           # Execute query via Trino Gateway
           response = requests.post(
               'http://trino-gateway:8080/v1/statement',
               headers={'X-Trino-User': 'admin'},
               data=query
           )

           if response.status_code != 200:
               raise Exception(f"Failed to submit query: {response.status_code} {response.text}")

           result = response.json()
           query_id = result.get('id')

           # CRITICAL: Accumulate data from ALL responses
           all_data = []
           columns = None

           # CRITICAL: Poll while nextUri exists (not based on state)
           while 'nextUri' in result:
               # CRITICAL: Collect data from EVERY response
               if 'data' in result and result['data']:
                   all_data.extend(result['data'])

               if 'columns' in result and not columns:
                   columns = result['columns']

               print(f"Query state: {result['stats']['state']}, polling...")
               time.sleep(1)

               response = requests.get(
                   result['nextUri'],
                   headers={'X-Trino-User': 'admin'}
               )

               if response.status_code != 200:
                   raise Exception(f"Failed to poll query: {response.status_code} {response.text}")

               result = response.json()

           # CRITICAL: Collect data from final response
           if 'data' in result and result['data']:
               all_data.extend(result['data'])

           if 'columns' in result and not columns:
               columns = result['columns']

           # Return results or raise error
           if result['stats']['state'] in ['FINISHED', 'FINISHING']:
               return all_data
           elif result['stats']['state'] == 'FAILED':
               error_msg = result.get('error', {}).get('message', 'Unknown error')
               raise Exception(f"Trino query failed: {error_msg}")
           else:
               raise Exception(f"Query ended in unexpected state: {result['stats']['state']}")
       \`\`\`
  </pyspark_trino_integration>

  <data_discovery_workflow>
    MANDATORY WORKFLOW for PySpark Applications:

    CRITICAL: Use MCP TOOLS for discovery during development, not XDP endpoint!

    1. DATAPLANE DISCOVERY (MCP TOOL):
       - MANDATORY FIRST STEP: Call get_all_dataplanes() MCP tool
       - Get available dataplanes with IDs and names
       - Select working dataplane ID for subsequent operations

    2. CATALOG DISCOVERY (MCP TOOL):
       - Use trino_list_catalogs(dataplane="working-dataplane-id") MCP tool
       - Use dataplane ID from step 1 (e.g., "27")
       - Identify relevant catalogs (hive, iceberg, delta, etc.)

    3. SCHEMA EXPLORATION (MCP TOOL):
       - Use trino_list_tables(dataplane="27", catalog="catalog-name") MCP tool
       - Don't assume 'default' schema exists
       - Discover actual available schemas

    4. TABLE DISCOVERY (MCP TOOL):
       - Use trino_list_tables(dataplane="27", catalog="catalog", schema="schema") MCP tool
       - List all available tables in specific schema
       - Use trino_describe_table() for detailed column information

    5. DATA VALIDATION (MCP TOOL):
       - Use trino_execute_query(dataplane="27", query="SELECT * FROM catalog.schema.table LIMIT 10")
       - Check data quality and structure during discovery
       - Validate expected columns and data types

    GENERATED CODE RUNTIME:
    In generated applications, use direct Trino Gateway with polling and data accumulation:
    \`\`\`python
    # Runtime query execution in generated applications
    def execute_trino_query(query):
        import requests
        import time

        # Initial request to Trino Gateway
        response = requests.post(
            'http://trino-gateway:8080/v1/statement',
            headers={'X-Trino-User': 'admin'},
            data=query
        )

        if response.status_code != 200:
            raise Exception(f"Failed to submit query: {response.status_code} {response.text}")

        result = response.json()
        query_id = result.get('id')
        print(f"Query submitted with ID: {query_id}")

        # CRITICAL: Accumulate data from ALL responses
        all_data = []
        columns = None

        # CRITICAL: Poll while nextUri exists (not based on state)
        while 'nextUri' in result:
            state = result['stats']['state']

            # CRITICAL: Collect data from EVERY response
            if 'data' in result and result['data']:
                all_data.extend(result['data'])
                print(f"Accumulated {len(result['data'])} rows (total: {len(all_data)})")

            # Capture column metadata (usually in first response with data)
            if 'columns' in result and not columns:
                columns = result['columns']

            print(f"Query {query_id} state: {state}, polling...")
            time.sleep(1)

            response = requests.get(
                result['nextUri'],
                headers={'X-Trino-User': 'admin'}
            )

            if response.status_code != 200:
                raise Exception(f"Failed to poll query: {response.status_code} {response.text}")

            result = response.json()

        # CRITICAL: Collect data from final response (when nextUri is absent)
        if 'data' in result and result['data']:
            all_data.extend(result['data'])
            print(f"Accumulated {len(result['data'])} rows from final response (total: {len(all_data)})")

        if 'columns' in result and not columns:
            columns = result['columns']

        # Check final state and return results
        final_state = result['stats']['state']
        print(f"Query {query_id} final state: {final_state}")

        if final_state in ['FINISHED', 'FINISHING']:
            print(f"Query completed successfully, total rows: {len(all_data)}")
            return {'data': all_data, 'columns': columns or [], 'stats': result['stats']}
        elif final_state == 'FAILED':
            error_info = result.get('error', {})
            error_msg = error_info.get('message', 'Unknown error')
            error_type = error_info.get('errorType', 'UNKNOWN')
            raise Exception(f"Trino query failed [{error_type}]: {error_msg}")
        else:
            raise Exception(f"Query ended in unexpected state: {final_state}")
    \`\`\`
  </data_discovery_workflow>

  <query_optimization_guidelines>
    PERFORMANCE BEST PRACTICES:

    1. PARTITION AWARENESS:
       - Always include partition columns in WHERE clauses
       - Use date/time partitioning effectively
       - Example: "WHERE year = '2024' AND month = '01'"

    2. COLUMN SELECTION:
       - Select only required columns, avoid SELECT *
       - Use column pruning for better I/O performance
       - Example: "SELECT customer_id, amount, date FROM sales" instead of "SELECT * FROM sales"

    3. PREDICATE PUSHDOWN:
       - Apply filters as early as possible
       - Use indexed columns for filtering when available
       - Combine multiple conditions efficiently

    4. JOIN OPTIMIZATION:
       - Order joins from smallest to largest table
       - Use broadcast joins for small dimension tables
       - Ensure join keys are properly typed and indexed

    5. MEMORY MANAGEMENT:
       - Use LIMIT for exploratory queries
       - Break large result sets into batches
       - Monitor query resource usage
  </query_optimization_guidelines>

  <monitoring_and_debugging>
    TRINO QUERY MONITORING:

    1. QUERY ANALYSIS:
       - Use EXPLAIN to understand execution plans
       - Monitor query performance metrics
       - Check for data skew issues

    2. RESOURCE MONITORING:
       - Track CPU and memory usage
       - Monitor I/O patterns
       - Watch for bottlenecks in distributed execution

    3. DEBUGGING TECHNIQUES:
       - Start with simple queries and add complexity
       - Use LIMIT to test query logic quickly
       - Validate intermediate results
       - Check data distribution and partitioning

    4. COMMON PERFORMANCE ISSUES:
       - Large result sets without LIMIT
       - Missing partition pruning
       - Inefficient join orders
       - Data skew in GROUP BY operations
       - Cross-partition operations
  </monitoring_and_debugging>

  <security_and_best_practices>
    SECURITY GUIDELINES:

    1. CREDENTIAL MANAGEMENT:
       - Access keys are hardcoded as specified (ABCD)
       - Secret keys are hardcoded as specified (ABCDEF)
       - Never log sensitive query results
       - Use HTTPS for all API calls

    2. DATA ACCESS PATTERNS:
       - Follow principle of least privilege
       - Access only required tables and columns
       - Implement proper error handling for access denied

    3. QUERY SAFETY:
       - Validate and sanitize dynamic query parameters
       - Avoid SQL injection through parameterized queries
       - Use proper escaping for string literals
       - Implement query timeouts
  </security_and_best_practices>
</trino_usage_guidelines>
`;

/**
 * Integration instructions for including Trino usage guidelines in prompts
 */
export const TRINO_INTEGRATION = stripIndents`
  To integrate Trino usage guidelines into existing prompts, add the following:

  1. Import the guidelines:
     import { getTrinoUsageGuidelines } from '~/lib/common/prompts/trino-usage';

  2. Include in system prompt:
     const systemPrompt = \`
       [existing prompt content]

       \${getTrinoUsageGuidelines()}

       [rest of prompt]
     \`;

  3. The guidelines will ensure:
     - Proper Trino endpoint usage
     - Correct SQL query patterns
     - Effective data discovery workflows
     - Performance optimization
     - Error handling strategies
`;
