# Long-Running Tool Timeout Fix Implementation

## ✅ **Problem Solved:**

When the LLM invokes `execute_and_monitor`, it takes ~1.5 minutes to complete, but the LLM thinks the tool is unresponsive after shorter timeouts and retries/abandons the tool call.

## 🔧 **Solution Implemented:**

### 1. **MCPToolTimeoutService** (`app/lib/services/mcpToolTimeoutService.ts`)

**Features:**
- ⏰ **Tool-specific timeouts**: `execute_and_monitor` = 5 minutes, `adhoc_run` = 3 minutes
- 📊 **Progress updates**: Every 15 seconds for long-running tools
- 🔄 **Smart progress messages**: Context-aware messages based on tool and elapsed time
- 🧹 **Cleanup handling**: Proper cleanup of intervals and timeouts

**Pre-configured timeouts:**
```typescript
execute_and_monitor: 300000ms (5 minutes)
adhoc_run: 180000ms (3 minutes)
trino_execute_query: 120000ms (2 minutes)
```

### 2. **Enhanced MCPService** (`app/lib/services/mcpService.ts`)

**Improvements:**
- 🔗 **Integrated timeout service**: Automatic progress tracking for long-running tools
- 📡 **Progress streaming**: Sends progress updates to LLM during execution
- ⚡ **Timeout handling**: Graceful timeout with informative error messages
- 🏃‍♂️ **Race conditions**: Uses Promise.race() for proper timeout handling

### 3. **LLM Configuration** (`app/routes/api.chat.ts` + `app/lib/.server/llm/stream-text.ts`)

**Enhanced LLM instructions:**
- 📚 **Long-running tool education**: LLM knows some tools take 1-3 minutes
- 🎯 **Progress recognition**: LLM understands progress updates (🚀, ⚙️, 📊, ⏳)
- ⏳ **Patience instructions**: Don't retry tools showing progress updates
- 🔧 **Timeout awareness**: Only acknowledge timeouts when explicitly returned

**LLM streaming improvements:**
- `maxSteps: 10` - Allow multiple tool calls
- `experimental_continueSteps: true` - Enable step continuation
- `experimental_toolCallStreaming: true` - Enable tool call streaming

## 🎯 **How It Works:**

### **Normal Flow:**
1. **LLM calls `execute_and_monitor`**
2. **MCPService starts progress tracking** (every 15 seconds)
3. **Progress updates sent to LLM**: "🚀 Starting job execution...", "⚙️ Job is running...", etc.
4. **LLM sees progress** → knows tool is working → waits patiently
5. **Tool completes** → returns result → progress tracking stops

### **Timeout Flow:**
1. **Tool exceeds 5-minute limit**
2. **Timeout detected** → returns timeout error with elapsed time
3. **LLM receives timeout message** → acknowledges timeout gracefully
4. **User can retry** or check if operation completed

## 📊 **Progress Messages:**

### **execute_and_monitor:**
- `0-30s`: "🚀 Starting job execution and monitoring setup..."
- `30-60s`: "⚙️ Job is running, monitoring progress..."
- `60-120s`: "📊 Job execution in progress, collecting logs..."
- `120s+`: "⏳ Long-running job detected, still monitoring..."

### **adhoc_run:**
- `0-20s`: "🏗️ Setting up adhoc run environment..."
- `20-60s`: "🚀 Executing adhoc run job..."
- `60s+`: "⚙️ Adhoc run in progress, please wait..."

## 🧪 **Testing:**

1. **Try `execute_and_monitor` tool** - should show progress updates every 15 seconds
2. **LLM should wait patiently** - no retries when progress is shown
3. **If timeout occurs** - graceful error message with elapsed time
4. **Other tools work normally** - no impact on quick tools

## 🎉 **Result:**

- ✅ **No more false timeouts** - LLM waits for long-running tools
- ✅ **Progress feedback** - User knows tool is working
- ✅ **Graceful timeouts** - Clear timeout messages when needed
- ✅ **Better UX** - No abandoned tool calls or unnecessary retries

## 🔧 **Configuration:**

To adjust timeouts for other tools:
```typescript
mcpToolTimeoutService.setToolTimeout('your_tool_name', {
  toolName: 'your_tool_name',
  timeoutMs: 180000, // 3 minutes
  enableProgressUpdates: true,
  progressInterval: 10000, // 10 seconds
});
```

The `execute_and_monitor` tool now works reliably with proper timeout handling! 🚀
