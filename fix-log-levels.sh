#!/bin/bash

echo "🔧 Fixing log levels across the project..."
echo ""

# Fix 1: DEBUG/debug/🔧/🔍 with logger.info should be logger.debug
echo "📝 Converting debug-related logger.info to logger.debug..."

sed -i '' "s/logger\.info('🔍/logger.debug('🔍/g" app/components/chat/Chat.client.tsx
sed -i '' "s/logger\.info('🔍/logger.debug('🔍/g" app/components/chat/MCPTools.tsx
sed -i '' "s/logger\.info('DEBUG:/logger.debug('DEBUG:/g" app/lib/utils/shellCommands.ts
sed -i '' "s/logger\.info('DEBUG:/logger.debug('DEBUG:/g" app/lib/webcontainer/index.ts
sed -i '' 's/logger\.info(`🔍/logger.debug(`🔍/g' app/lib/persistence/useChatHistory.ts
sed -i '' "s/logger\.info('🔍/logger.debug('🔍/g" app/lib/persistence/useChatHistory.ts
sed -i '' "s/logger\.info('🔧/logger.debug('🔧/g" app/routes/api.pipeline-adhoc-run.ts
sed -i '' 's/logger\.info(`🔧/logger.debug(`🔧/g' app/routes/api.pipeline-log-stream.ts

# Fix 2: Verbose tracking logs should be debug
echo "📝 Converting verbose tracking logs to logger.debug..."

sed -i '' "s/logger\.info('🔄 ChatID/logger.debug('🔄 ChatID/g" app/components/chat/Chat.client.tsx
sed -i '' "s/logger\.info('🌐 useChat/logger.debug('🌐 useChat/g" app/components/chat/Chat.client.tsx
sed -i '' "s/logger\.info('🔥 ensureChatIdAndSend called/logger.debug('🔥 ensureChatIdAndSend called/g" app/components/chat/Chat.client.tsx
sed -i '' "s/logger\.info('🔥 Creating new/logger.debug('🔥 Creating new/g" app/components/chat/Chat.client.tsx
sed -i '' "s/logger\.info('🎯 Final chatId/logger.debug('🎯 Final chatId/g" app/components/chat/Chat.client.tsx
sed -i '' "s/logger\.info('🚀 sendMessage called/logger.debug('🚀 sendMessage called/g" app/components/chat/Chat.client.tsx
sed -i '' "s/logger\.info('❌ sendMessage: Empty/logger.debug('❌ sendMessage: Empty/g" app/components/chat/Chat.client.tsx

# Fix 3: Important operational logs should stay as info (keep these)
# - Connection logs (🔗)
# - Success logs (✅, Successfully)
# - Created/Repository logs from important operations

# Fix 4: Important backend project/chat operations should stay info
# These are already mostly correct

echo ""
echo "✅ Log level fixes complete!"
echo ""
echo "Summary of changes:"
echo "  - Debug/trace indicators (🔧,🔍,DEBUG) → logger.debug"
echo "  - Verbose internal tracking → logger.debug"  
echo "  - Success/important operations (✅,Repository,Created) → kept as logger.info"
echo "  - Errors and warnings → unchanged"

