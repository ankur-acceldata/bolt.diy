# Bolt.diy Communication Bus Fixes Applied

## Summary

Fixed two critical issues in the communication bus responder hooks that were causing:
- Duplicate message handler registrations
- Repeated/flooding log messages
- Performance issues and potential memory leaks

---

## Fix 1: usePipelineConfigResponder.ts ✅

### Problem
The `bus` dependency in the useEffect caused the handler to re-register every time the bus reference changed, leading to duplicate handlers and potential issues.

### Changes Applied

#### Before:
```typescript
export function usePipelineConfigResponder({ currentProjectId }) {
  const bus = useCommunicationBusChild();
  const projectIdRef = useRef(currentProjectId);

  projectIdRef.current = currentProjectId; // Direct assignment

  useEffect(() => {
    const unsubscribe = bus.on(MessageType.GET_PIPELINE_CONFIG, async () => {
      const jobConfig = await getJobConfigFromXdp(bus, stages);
      // ...
      bus.sendMessage({ ... });
    });

    return () => unsubscribe();
  }, [bus]); // ❌ Re-registers on every bus change
}
```

#### After:
```typescript
export function usePipelineConfigResponder({ currentProjectId }) {
  const bus = useCommunicationBusChild();
  const projectIdRef = useRef(currentProjectId);
  const busRef = useRef(bus); // ← Added ref for bus

  // Update refs without triggering re-renders
  useEffect(() => {
    busRef.current = bus;
    projectIdRef.current = currentProjectId;
  }, [bus, currentProjectId]);

  useEffect(() => {
    const unsubscribe = busRef.current.on(MessageType.GET_PIPELINE_CONFIG, async () => {
      const jobConfig = await getJobConfigFromXdp(busRef.current, stages); // ← Use ref
      // ...
      busRef.current.sendMessage({ ... }); // ← Use ref
    });

    return () => {
      logger.info('Cleaning up GET_PIPELINE_CONFIG listener');
      unsubscribe();
    };
  }, []); // ✅ Empty dependencies - registers once
}
```

### Benefits:
- ✅ Handler registers only once when component mounts
- ✅ No duplicate handlers
- ✅ Better cleanup logging
- ✅ Uses latest values via refs without re-registration
- ✅ Reduced memory usage

---

## Fix 2: useProjectIdResponder.ts ✅

### Problem
The hook had multiple response paths and complex logic:
1. Communication bus handler
2. Direct window message listener (backup)
3. Proactive message sending on mount
4. Immediate setup before useEffect
5. Multiple useEffects with different dependencies

This caused:
- Duplicate responses to the same request
- Flooding of unsolicited messages
- Performance issues
- Confusing behavior

### Changes Applied

#### Before (190 lines):
```typescript
export function useProjectIdResponder({ currentProjectId }) {
  const bus = useCommunicationBusChild();
  const projectIdRef = useRef(currentProjectId);
  const isInitializedRef = useRef(false);

  projectIdRef.current = currentProjectId; // Direct assignment

  // Immediate setup - don't wait for useEffect
  const setupResponder = () => { ... };

  // Set up immediately if bus is ready
  if (bus.isReady || bus.isConnected) {
    setupResponder();
  }

  // Proactively send messages
  if (currentProjectId && window.parent) {
    window.parent.postMessage({ ... }, '*'); // Unsolicited messages
  }

  useEffect(() => {
    // Direct window message listener as backup
    const handleDirectMessage = (event: MessageEvent) => { ... };
    window.addEventListener('message', handleDirectMessage);

    // Set up responder
    if (!unsubscribeRef.current && (bus.isReady || bus.isConnected)) {
      setupResponder();
    }

    return () => {
      window.removeEventListener('message', handleDirectMessage);
      // cleanup
    };
  }, [bus, bus.isReady, bus.isConnected]); // ❌ Re-registers often

  // Additional debug effect
  useEffect(() => { ... }, [currentProjectId, bus.isReady, bus.isConnected]);
}
```

#### After (62 lines):
```typescript
export function useProjectIdResponder({ currentProjectId }) {
  const bus = useCommunicationBusChild();
  const projectIdRef = useRef(currentProjectId);
  const busRef = useRef(bus); // ← Added ref for bus

  // Update refs without triggering re-renders
  useEffect(() => {
    busRef.current = bus;
    projectIdRef.current = currentProjectId;
  }, [bus, currentProjectId]);

  useEffect(() => {
    logger.info('Setting up GET_PROJECT_ID listener');

    const unsubscribe = busRef.current.on(MessageType.GET_PROJECT_ID, (_payload, message) => {
      const projectId = projectIdRef.current || getProjectId();

      logger.info('Received GET_PROJECT_ID request, responding with projectId:', projectId);

      busRef.current.sendMessage({
        type: MessageType.GET_PROJECT_ID_RESPONSE,
        payload: { projectId },
        responseId: message.messageId,
      });
    });

    return () => {
      logger.info('Cleaning up GET_PROJECT_ID listener');
      unsubscribe();
    };
  }, []); // ✅ Empty dependencies - registers once
}
```

### Removed:
- ❌ Direct window message listener (caused duplicates)
- ❌ Proactive unsolicited message sending (caused flooding)
- ❌ Immediate setup code before useEffect (complex initialization)
- ❌ Multiple useEffects (simplified to one)
- ❌ `isInitializedRef` tracking (no longer needed)
- ❌ `setupResponder` function (inline in useEffect)

### Benefits:
- ✅ **68% code reduction** (190 lines → 62 lines)
- ✅ Single response path (only communication bus)
- ✅ No duplicate responses
- ✅ No unsolicited messages
- ✅ Handler registers only once
- ✅ Cleaner, more maintainable code
- ✅ Better logging
- ✅ Predictable behavior

---

## Expected Behavior After Fixes

### Console Logs

#### Before (Broken):
```
[useProjectIdResponder] Setting up GET_PROJECT_ID responder immediately
[useProjectIdResponder] Project ID responder set up immediately - bus ready
[useProjectIdResponder] Communication bus status: {...}
[useProjectIdResponder] Proactively announcing project ID to parent...
[useProjectIdResponder] Direct window message listener set up as backup
[useProjectIdResponder] Project ID responder initialized via useEffect
[useProjectIdResponder] BACKUP: Received direct GET_PROJECT_ID request via window listener
[useProjectIdResponder] Received GET_PROJECT_ID request...
GET_PROJECT_ID_RESPONSE sent (duplicate from bus handler)
GET_PROJECT_ID_RESPONSE sent (duplicate from backup handler)
... repeats continuously ...
```

#### After (Fixed):
```
[useProjectIdResponder] Setting up GET_PROJECT_ID listener
[useProjectIdResponder] Received GET_PROJECT_ID request, responding with projectId: 718
[useProjectIdResponder] Successfully sent GET_PROJECT_ID_RESPONSE

[usePipelineConfigResponder] Setting up GET_PIPELINE_CONFIG listener
[usePipelineConfigResponder] Received GET_PIPELINE_CONFIG request
[usePipelineConfigResponder] Sending GET_PIPELINE_CONFIG_RESPONSE
```

Clean, predictable, one message per request!

---

## Testing Checklist

### Test 1: Handler Registration
- [ ] Open Bolt.diy in XDP iframe
- [ ] Check console: Should see "Setting up GET_PROJECT_ID listener" **once**
- [ ] Check console: Should see "Setting up GET_PIPELINE_CONFIG listener" **once**
- [ ] Should NOT see repeated setup messages

### Test 2: GET_PROJECT_ID Flow
- [ ] Open Create Pipeline modal in XDP
- [ ] Should see "Received GET_PROJECT_ID request" **once**
- [ ] Should see "Successfully sent GET_PROJECT_ID_RESPONSE" **once**
- [ ] No BACKUP messages
- [ ] No duplicate responses

### Test 3: GET_PIPELINE_CONFIG Flow
- [ ] Open Create Pipeline modal in XDP
- [ ] Should see "Received GET_PIPELINE_CONFIG request" **once**
- [ ] Should see "Sending GET_PIPELINE_CONFIG_RESPONSE" **once**
- [ ] XDP should receive the config with sourceUrl and stages
- [ ] Create Pipeline button should become enabled (if all fields valid)

### Test 4: Multiple Opens
- [ ] Open Create Pipeline modal
- [ ] Close modal
- [ ] Open modal again
- [ ] Should see same clean logs
- [ ] No performance degradation
- [ ] No flooding of messages

### Test 5: Performance
- [ ] Open modal multiple times
- [ ] Check CPU usage (should be normal)
- [ ] No memory leaks
- [ ] Smooth UI performance

---

## Files Modified

### 1. `/app/lib/hooks/communicationBus/usePipelineConfigResponder.ts`

**Changes:**
- Added `busRef` for stable bus reference
- Moved ref updates to separate useEffect
- Changed main useEffect to use `busRef.current` instead of `bus`
- Changed dependency array from `[bus]` to `[]`
- Added cleanup logging
- All bus operations now use `busRef.current`

**Line count:** ~94 lines (no change)

---

### 2. `/app/lib/hooks/communicationBus/useProjectIdResponder.ts`

**Changes:**
- **Removed ~128 lines of code**
- Added `busRef` for stable bus reference
- Removed direct window message listener
- Removed proactive message sending
- Removed immediate setup logic
- Removed `isInitializedRef` and `setupResponder` function
- Simplified to single useEffect with empty dependencies
- All bus operations now use `busRef.current`

**Line count:** 191 → 62 lines (68% reduction!)

---

## Integration with XDP

These fixes complement the XDP side fixes already applied:

### XDP Side (Already Fixed):
- ✅ Removed fallback communication bus in CreatePipelineModal
- ✅ Fixed handler re-registration in usePipelineConfig hook
- ✅ Fixed validation logging performance issue
- ✅ Improved reload detection

### Bolt Side (Just Fixed):
- ✅ Fixed handler re-registration in usePipelineConfigResponder
- ✅ Simplified useProjectIdResponder
- ✅ Removed duplicate response paths

### Result:
- ✅ Clean request/response flow
- ✅ No duplicate handlers
- ✅ No flooding messages
- ✅ Better performance
- ✅ Predictable behavior

---

## Notes

- ✅ Fix 1 and Fix 2 implemented
- ⏸️ Fix 3 (Extract real stages) **intentionally NOT implemented** as per user request
  - Hardcoded stages `["echo 'Hello World'"]` remain for now
  - Will be implemented later
- ✅ All changes are backward compatible
- ✅ No breaking changes to API
- ✅ Better logging for debugging
- ✅ Cleaner, more maintainable code

---

## Next Steps

1. **Test the fixes:**
   - Open XDP → AI Studio
   - Click "Create Pipeline"
   - Verify clean console logs
   - Verify button enables after receiving config
   - Test opening modal multiple times

2. **When ready, implement Fix 3:**
   - Replace hardcoded stages with real command extraction
   - Extract from editor/files
   - Consider shell scripts, Dockerfiles, package.json scripts, etc.

3. **Monitor for issues:**
   - Watch console for any unexpected messages
   - Check performance with multiple modal opens
   - Verify no memory leaks

---

## Rollback Instructions

If issues occur, revert these files:
```bash
cd /Users/ankuragarwal/src/bolt.diy
git diff app/lib/hooks/communicationBus/usePipelineConfigResponder.ts
git diff app/lib/hooks/communicationBus/useProjectIdResponder.ts
git checkout app/lib/hooks/communicationBus/usePipelineConfigResponder.ts
git checkout app/lib/hooks/communicationBus/useProjectIdResponder.ts
```
