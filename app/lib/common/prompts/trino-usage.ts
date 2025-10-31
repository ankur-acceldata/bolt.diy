import { stripIndents } from '~/utils/stripIndent';

/**
 * Comprehensive Trino SQL Engine Usage Guidelines
 *
 * This guide provides best practices and patterns for using Trino SQL engine
 * with the internal XDP platform endpoint for PySpark applications.
 */
export const getTrinoUsageGuidelines = () => stripIndents`
<trino_usage_guidelines>
  <trino_access_pattern>
    CRITICAL: Trino access is handled differently in discovery vs runtime:

    DISCOVERY PHASE (Development):
    - MCP tools handle Trino REST API internally for metadata operations
    - You don't need to worry about Trino Gateway endpoints or headers
    - MCP tools handle: SHOW CATALOGS, SHOW SCHEMAS, SHOW TABLES, DESCRIBE, etc.

    RUNTIME PHASE (Generated PySpark Code):
    - ALWAYS use Spark JDBC connector with Trino JDBC driver
    - NEVER use direct Trino REST API calls
    - NEVER use requests library to fetch data from Trino
    - See pyspark_trino_integration section for details

    🚫 CRITICAL: NO FALLBACK TO REST API
    - If JDBC connection fails, FIX the JDBC configuration
    - NEVER fallback to using requests library or REST API
    - JDBC is the ONLY supported method for runtime Trino access
    - Troubleshoot JDBC issues (missing JAR, wrong URL, auth problems)
    - DO NOT implement REST API as a backup solution

    Trino Gateway URL: http://trino-gateway:8080
    Authentication: admin/admin (handled by JDBC driver or MCP tools)
  </trino_access_pattern>

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

    4. JDBC CONNECTION ERROR HANDLING:
       🚫 CRITICAL: NEVER FALLBACK TO REST API ON JDBC FAILURES

       Common JDBC errors and proper fixes:
       - "ClassNotFoundException: io.trino.jdbc.TrinoDriver"
         → FIX: Add Trino JDBC JAR to classpath or Spark jars directory
         → WRONG: Switch to requests library

       - "No suitable driver found for jdbc:trino://"
         → FIX: Verify JDBC URL format and driver registration
         → WRONG: Use REST API instead

       - "Connection refused" or "Timeout"
         → FIX: Check network connectivity, verify Trino Gateway is accessible
         → WRONG: Implement REST API fallback

       - "Authentication failed"
         → FIX: Verify username/password in JDBC properties
         → WRONG: Try REST API with different auth

       PROPER ERROR HANDLING PATTERN:
       \`\`\`python
       try:
           df = spark.read.jdbc(url=jdbc_url, table=table, properties=connection_properties)
       except Exception as e:
           logger.error(f"JDBC connection failed: {e}")
           # FIX THE JDBC ISSUE - DO NOT FALLBACK TO REST API
           # Check: JAR availability, URL format, network, authentication
           raise Exception(f"Trino JDBC connection failed. Please verify JDBC configuration: {e}")
       \`\`\`

       FORBIDDEN PATTERN:
       \`\`\`python
       try:
           df = spark.read.jdbc(...)
       except Exception as jdbc_error:
           # ❌ WRONG: Fallback to REST API
           logger.warning("JDBC failed, trying REST API...")
           response = requests.post("http://trino-gateway:8080/v1/statement", ...)
       \`\`\`
  </error_handling_patterns>

  <pyspark_trino_integration>
    CRITICAL: INTEGRATING TRINO WITH PYSPARK USING SPARK JDBC CONNECTOR + TRINO JDBC DRIVER

    MANDATORY APPROACH: Use Spark's JDBC connector with Trino JDBC driver to create DataFrames DIRECTLY from Trino
    - Spark provides: spark.read.jdbc() method (Spark's JDBC connector)
    - Trino provides: io.trino.jdbc.TrinoDriver (Trino JDBC driver)
    - Together: Spark JDBC connector uses Trino JDBC driver to connect to Trino

    DO NOT:
    - Download data via Trino REST API and then create DataFrames
    - Fetch data first, parse it, and then send to Spark
    - Use requests library to get data and then spark.createDataFrame()

    ALWAYS:
    - Use spark.read.jdbc() with Trino JDBC driver
    - Let Spark executors connect directly to Trino
    - Create DataFrames directly from Trino queries

    WHY SPARK JDBC + TRINO JDBC APPROACH:
    - Avoids downloading all data to the client
    - Leverages Spark's distributed processing
    - More efficient for large datasets
    - Supports predicate pushdown and query optimization
    - Data streams directly from Trino to Spark executors
    - No intermediate data parsing or conversion needed

    1. JDBC CONNECTION SETUP:
       \`\`\`python
       # Trino JDBC URL format
       TRINO_GATEWAY_URL = "http://trino-gateway:8080"
       TRINO_USER = "admin"
       TRINO_PASSWORD = "admin"

       # Build JDBC URL (remove /v1/statement if present)
       base_url = TRINO_GATEWAY_URL.replace("/v1/statement", "")
       jdbc_url = f"jdbc:trino://{base_url.replace('http://', '').replace('https://', '')}/{catalog}/{schema}"

       # Example: jdbc:trino://trino-gateway:8080/tpcds/sf1
       \`\`\`

    2. READING TABLES VIA JDBC (RECOMMENDED):
       \`\`\`python
       from pyspark.sql import SparkSession

       def read_trino_table_jdbc(spark: SparkSession, catalog: str, schema: str, table: str):
           """Read data from Trino table using Spark JDBC connector with Trino JDBC driver."""
           # Build JDBC URL for Trino
           base_url = TRINO_GATEWAY_URL.replace("/v1/statement", "")
           jdbc_url = f"jdbc:trino://{base_url.replace('http://', '').replace('https://', '')}/{catalog}/{schema}"

           logger.info(f"Connecting to Trino via Spark JDBC connector: {jdbc_url}")

           # JDBC connection properties for Trino JDBC driver
           connection_properties = {
               "user": TRINO_USER,
               "driver": "io.trino.jdbc.TrinoDriver"  # Trino JDBC driver class
           }

           # Spark's JDBC connector uses Trino JDBC driver to create DataFrame directly
           # Data flows: Trino -> Trino JDBC Driver -> Spark JDBC Connector -> DataFrame
           df = spark.read.jdbc(
               url=jdbc_url,
               table=table,
               properties=connection_properties
           )

           return df
       \`\`\`

    3. READING WITH CUSTOM QUERIES VIA JDBC:
       \`\`\`python
       def read_trino_query_jdbc(spark: SparkSession, catalog: str, schema: str, query: str):
           """Execute custom SQL query via Spark JDBC connector with Trino JDBC driver."""
           base_url = TRINO_GATEWAY_URL.replace("/v1/statement", "")
           jdbc_url = f"jdbc:trino://{base_url.replace('http://', '').replace('https://', '')}/{catalog}/{schema}"

           # JDBC connection properties for Trino JDBC driver
           connection_properties = {
               "user": TRINO_USER,
               "driver": "io.trino.jdbc.TrinoDriver"  # Trino JDBC driver class
           }

           if TRINO_PASSWORD:
               connection_properties["password"] = TRINO_PASSWORD

           # Use subquery syntax for custom queries
           # Wrap your query in parentheses as a subquery
           query_table = f"({query}) AS trino_query"

           # Spark JDBC connector executes query via Trino JDBC driver
           df = spark.read.jdbc(
               url=jdbc_url,
               table=query_table,
               properties=connection_properties
           )

           return df
       \`\`\`

    4. COMPLETE EXAMPLE - CORRECT PATTERN:
       \`\`\`python
       import os
       from pyspark.sql import SparkSession

       # Configuration
       TRINO_GATEWAY_URL = os.getenv("TRINO_GATEWAY_URL", "http://trino-gateway:8080")
       TRINO_USER = os.getenv("TRINO_USER", "admin")
       TRINO_PASSWORD = os.getenv("TRINO_PASSWORD", "admin")

       CATALOG = "tpcds"
       SCHEMA = "sf1"
       TABLE = "call_center"

       def create_spark_session(app_name: str) -> SparkSession:
           """Create Spark session."""
           is_bolt = os.getenv("IS_BOLT", "false").lower() == "true"

           if is_bolt:
               return SparkSession.builder \\
                   .appName(app_name) \\
                   .remote("sc://localhost:15002") \\
                   .getOrCreate()
           else:
               # Minimal SparkSession (add configs only when needed)
               return SparkSession.builder \\
                   .appName(app_name) \\
                   .getOrCreate()

       def read_trino_table_jdbc(spark: SparkSession, catalog: str, schema: str, table: str):
           """Read data from Trino using Spark JDBC connector with Trino JDBC driver."""
           base_url = TRINO_GATEWAY_URL.replace("/v1/statement", "")
           jdbc_url = f"jdbc:trino://{base_url.replace('http://', '').replace('https://', '')}/{catalog}/{schema}"

           # Trino JDBC driver configuration
           connection_properties = {
               "user": TRINO_USER,
               "driver": "io.trino.jdbc.TrinoDriver"  # Trino JDBC driver
           }

           if TRINO_PASSWORD:
               connection_properties["password"] = TRINO_PASSWORD

           # Spark JDBC connector + Trino JDBC driver = Direct DataFrame creation
           # No data download to client, data flows directly to Spark executors
           df = spark.read.jdbc(
               url=jdbc_url,
               table=table,
               properties=connection_properties
           )

           return df

       def main():
           spark = create_spark_session("TrinoJDBCExample")

           # Read data directly from Trino using JDBC
           df = read_trino_table_jdbc(spark, CATALOG, SCHEMA, TABLE)

           # Now you can use the DataFrame for Spark operations
           df.cache()
           print(f"Row count: {df.count()}")
           df.show(10)

           # Perform aggregations, joins, etc.
           from pyspark.sql.functions import col, count as spark_count

           result_df = df.groupBy("cc_call_center_id") \\
               .agg(spark_count("*").alias("count")) \\
               .filter(col("count") > 1)

           result_df.show()

           df.unpersist()
           spark.stop()

       if __name__ == "__main__":
           main()
       \`\`\`

    5. WHEN TO USE JDBC VS REST API:

       ✅ USE JDBC (MANDATORY FOR ALL RUNTIME CODE):
       - When creating PySpark DataFrames from Trino data
       - For large datasets that need distributed processing
       - When performing Spark transformations and aggregations
       - For production PySpark jobs
       - For ALL data operations in generated applications

       ✅ REST API (ONLY FOR MCP TOOLS - NOT IN GENERATED CODE):
       - MCP tools use REST API internally during discovery phase
       - For discovery operations (SHOW CATALOGS, SHOW TABLES, DESCRIBE)
       - NEVER use REST API in generated PySpark applications
       - NEVER use requests library for Trino queries in runtime code

    🚫 CRITICAL POLICY: JDBC ONLY - NO FALLBACK
    - Generated PySpark applications MUST use JDBC exclusively
    - If JDBC fails, troubleshoot and fix JDBC configuration
    - NEVER implement REST API fallback in generated code
    - NEVER use requests library for Trino data access
    - REST API is for MCP tools only, not for application runtime

    IMPORTANT: The JDBC approach creates DataFrames directly without downloading data to the client first!
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
    In generated PySpark applications, ALWAYS use Spark JDBC connector with Trino JDBC driver.

    🚫 CRITICAL: NO REST API IN GENERATED CODE
    - NEVER use requests library for Trino queries
    - NEVER implement REST API fallback if JDBC fails
    - ALWAYS troubleshoot and fix JDBC issues
    - REST API is for MCP tools only, not application runtime

    CORRECT PATTERN - Use JDBC for all data operations:
    \`\`\`python
    # Read data from Trino using Spark JDBC connector
    def read_trino_table_jdbc(spark: SparkSession, catalog: str, schema: str, table: str):
        """Read data from Trino using Spark JDBC connector with Trino JDBC driver."""
        TRINO_GATEWAY_URL = os.getenv("TRINO_GATEWAY_URL", "http://trino-gateway:8080")
        TRINO_USER = os.getenv("TRINO_USER", "admin")
        TRINO_PASSWORD = os.getenv("TRINO_PASSWORD", "admin")

        base_url = TRINO_GATEWAY_URL.replace("/v1/statement", "")
        jdbc_url = f"jdbc:trino://{base_url.replace('http://', '').replace('https://', '')}/{catalog}/{schema}"

        connection_properties = {
            "user": TRINO_USER,
            "driver": "io.trino.jdbc.TrinoDriver"
        }

        if TRINO_PASSWORD:
            connection_properties["password"] = TRINO_PASSWORD

        try:
            # Spark JDBC connector + Trino JDBC driver
            df = spark.read.jdbc(
                url=jdbc_url,
                table=table,
                properties=connection_properties
            )
            return df
        except Exception as e:
            logger.error(f"JDBC connection failed: {e}")
            # DO NOT FALLBACK TO REST API - FIX JDBC CONFIGURATION
            raise Exception(f"Trino JDBC connection failed. Verify JAR, URL, and auth: {e}")
    \`\`\`

    FORBIDDEN PATTERNS:
    ❌ Using requests library to fetch data from Trino
    ❌ Implementing REST API fallback on JDBC failures
    ❌ Mixing JDBC and REST API approaches
    ❌ Using REST API for data operations in generated code
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
