# MCP Tool Policy Guide

## Overview

The MCP (Model Context Protocol) Tool Policy is a comprehensive set of guidelines that ensures AI assistants properly discover, use, and handle MCP tools when working with external systems. This policy has been centralized for better maintainability and consistency across all prompts.

## Key Changes Made

### 1. Centralized Tool Policy (`app/lib/common/prompts/tool-policy.ts`)

Created a dedicated file containing the complete MCP tool usage policy with the following sections:

- **Critical Instructions**: Mandatory rules for tool usage
- **Tool Discovery Workflow**: Step-by-step process for discovering resources
- **XDP Specific Tools**: Documentation for XDP platform tools
- **Error Handling**: Recovery strategies for tool failures
- **Value Resolution**: Guidelines to prevent placeholder usage
- **Continuous Exploration**: Patterns for exhaustive discovery
- **Code Generation Integration**: How to use discovered values
- **Execution Policy**: Preference for bolt actions over deprecated MCP execution tools
- **Common Pitfalls**: Mistakes to avoid

### 2. Removed Deprecated Execution Tools

The following tools are being removed from MCP and should no longer be used:
- `execute_and_monitor`
- `register_manual_execution`

Instead, always use: `<boltAction type="workbench-action" action="run" />`

### 3. Integration Points

The tool policy is now integrated into:
- `app/lib/common/prompts/prompts.ts` - Main system prompt
- `app/lib/common/prompts/new-prompt.ts` - Fine-tuned prompt
- `app/lib/common/prompts/python-prompt.ts` - Python-specific prompt

### 4. Removed Inline Policy

Removed the hardcoded tool policy from `app/routes/api.chat.ts` since it's now included via the system prompt.

## How the Tool Policy Works

### 1. Tool Discovery Flow

```
Start → List Resources → Explore Details → Validate → Generate Code
```

Example for database work:
1. `xdp_list_datastores` - Find available datastores
2. `trino_list_catalogs` - Discover catalogs in selected dataplane
3. `trino_list_tables` - Explore tables in catalog
4. `trino_describe_table` - Get column information
5. Generate code with discovered values

### 2. Key Principles

1. **Tool-First Approach**: Always use tools before generating code
2. **No Fabrication**: Never use placeholders when values can be discovered
3. **Continuous Exploration**: Don't stop at first result
4. **Graceful Failure**: Handle errors and try alternatives
5. **Complete Discovery**: Gather all information before proceeding

### 3. Common Workflows

#### Database Operations
```
list_catalogs → list_tables → describe_table → execute_query
```

#### Platform Discovery
```
list_dataplanes → list_datastores → get_specific_details
```

## Benefits of Centralized Policy

1. **Consistency**: Same tool behavior across all prompt types
2. **Maintainability**: Single source of truth for tool policies
3. **Flexibility**: Easy to update tool behavior globally
4. **Clarity**: Clear documentation of expected tool usage

## Example Usage

When a user asks: "Create a PySpark app to write to Snowflake for dataplane 17"

The AI will:
1. Call `xdp_list_datastores` to find dataplane 17 details
2. Extract the actual dataplane name (e.g., "manoj-xdp-trino-dp3")
3. Use `trino_list_catalogs` to discover available catalogs
4. Generate code with real values instead of placeholders

## Troubleshooting

### Issue: AI not calling enough tools
**Solution**: The policy now emphasizes continuous exploration and provides clear examples of multi-step workflows.

### Issue: AI using placeholders
**Solution**: The policy explicitly forbids placeholders and shows correct vs wrong examples.

### Issue: AI giving up after one failure
**Solution**: The error handling section provides clear retry strategies.

### Issue: Tool calling with null/undefined parameters
**Example Errors**:
- `mismatched input 'null'. Expecting: <identifier>`
- `Schema 'default' does not exist`

**Solution**: 
- Added mandatory parameter validation checklist
- Clear examples of correct vs incorrect tool calls
- Specific error recovery patterns
- Never assume default values exist

### Issue: Schema not found errors
**Root Cause**: Assuming 'default' schema exists in all catalogs

**Solution**:
- Call `trino_list_tables` without schema parameter first
- Discover actual available schemas
- Use real schema names from tool responses

### Issue: Syntax errors in tool calls
**Root Cause**: Passing null/undefined for required parameters

**Solution**:
- Pre-call validation checklist
- Always verify required parameters have real values
- Get parameter values from previous successful tool calls

## Future Improvements

1. Add more tool-specific workflows as new MCP tools are added
2. Create tool-specific sub-policies for complex tools
3. Add performance guidelines for efficient tool usage
4. Implement tool usage analytics for optimization

## Conclusion

The centralized MCP Tool Policy ensures consistent, reliable tool usage across all AI interactions. By following these guidelines, the AI will effectively discover and use real system values instead of generating placeholder code.
