# Text Selection Context Menu Feature

## Overview
Implemented a Cursor-like text selection feature that **automatically shows a popup** when text is selected in the code editor or log viewer, and also supports right-click context menu access. Users can quickly send selected text to chat for AI assistance.

## Features

### 1. **Auto-Show Popup (Primary Interaction)**
- **Automatically appears** when text is selected (no right-click needed!)
- Shows for **5 seconds** then auto-hides
- Positioned **60px above the selection**, centered horizontally
- **Hides immediately** when clicking outside, pressing Escape, or after action
- **Escape key** closes the popup
- Simple and distraction-free - no hover interactions needed

### 2. **Right-Click Context Menu (Secondary Interaction)**
- Traditional right-click menu still available
- Uses existing Radix UI `@radix-ui/react-context-menu` for consistency
- Same actions as auto-show popup
- Follows existing UI/UX patterns (FileTree, EditorTabs)

### 3. **Text Selection in Code Editor**
- Select any text in the CodeMirror editor
- Popup appears automatically above selection
- Can also right-click for context menu
- Automatically formats the message with:
  - File name context
  - Code block formatting
  - Helpful prompt asking for explanation and improvements

### 4. **Text Selection in Log Viewer**
- Select any log text
- Popup appears automatically above selection
- Can also right-click for context menu
- Automatically formats the message with:
  - Log excerpt in code block
  - Helpful prompt asking for debugging assistance

### 5. **Smart Message Formatting**
- **Editor Selection**: `Please analyze this code from \`filename.ts\`:\n\n\`\`\`\n{selected code}\n\`\`\`\n\nAnalyze what this code does, identify any issues or potential improvements, and fix them if required. Provide a clear explanation and any necessary code changes.`
- **Log Selection**: `Please analyze this log excerpt and help me debug:\n\n\`\`\`\n{selected logs}\n\`\`\`\n\nAnalyze what's happening, identify any errors or issues, and fix them if required. Provide a clear explanation and any necessary code changes.`

## Implementation Details

### Components Created/Modified

#### 1. **TextSelectionContextMenu.tsx** (New)
- Reusable context menu wrapper component
- Props:
  - `children`: Content to wrap with context menu
  - `onSendToChat`: Callback with selected text
  - `enabled`: Toggle the feature on/off
  - `additionalItems`: Optional extra menu items
  - `autoShowTimeout`: Timeout in ms (default: 5000ms)
- Features:
  - **Auto-show popup** on text selection
  - **5-second auto-hide** (no hover interaction)
  - **Escape key** to close
  - Right-click context menu (Radix UI)
  - Send to Chat action (primary button with accent color)
  - Copy action (secondary button)
  - Auto-clears selection after sending
  - Fully themed with bolt theme variables
  - Portal-based rendering for proper z-index
  - Click-outside detection
  - Comprehensive debug logging

#### 2. **LogViewer.tsx** (Modified)
- Wrapped log container with `TextSelectionContextMenu`
- Added `handleSendSelectionToChat` callback
- Removed unused `model` and `provider` props
- Enabled only when `onSetChatInput` is available

#### 3. **EditorPanel.tsx** (Modified)
- Wrapped CodeMirror editor with `TextSelectionContextMenu`
- Added `handleSendEditorSelectionToChat` callback
- Includes file name in the formatted message
- Removed unused `model` and `provider` props

#### 4. **Type Updates**
- **LogViewerProps**: Removed `model` and `provider` properties
- **EditorPanelProps**: Removed `model` and `provider` properties
- **WorkspaceProps**: Removed `model` and `provider` properties

## UI/UX Consistency

### Theme Integration
- Uses `bolt-elements-background-depth-1` and `bolt-elements-background-depth-2` for backgrounds
- Uses `bolt-elements-borderColor` for borders
- Uses `bolt-elements-textPrimary` for text
- Uses `bolt-elements-item-backgroundActive` for hover states
- Uses `bolt-elements-item-contentActive` for active text color

### Animations
- Smooth fade-in and zoom-in animations (`fade-in-0 zoom-in-95`)
- Consistent with other Radix UI components in the codebase
- 200ms duration for smooth transitions

### Icons
- Uses existing icon system (`i-ph:chat-circle-text`, `i-ph:copy`)
- Consistent sizing and spacing

## User Experience

### How to Use

#### Primary Method (Auto-Show Popup)
1. **In Code Editor**:
   - Select any text in the editor
   - Popup appears **automatically** above the selection
   - Click "Send to Chat" (blue button) or "Copy"
   - Popup disappears after action or 5 seconds
   - Press **Escape** to close manually

2. **In Log Viewer**:
   - Select any log text
   - Popup appears **automatically** above the selection
   - Click "Send to Chat" (blue button) or "Copy"
   - Popup disappears after action or 5 seconds
   - Press **Escape** to close manually

#### Secondary Method (Right-Click)
1. **In Code Editor or Log Viewer**:
   - Select any text
   - Right-click on the selection
   - Choose "Send to Chat" or "Copy" from context menu

### Interaction Details
- **Auto-show**: Popup appears immediately after text selection
- **5-second timer**: Automatically hides after 5 seconds (no pause on hover)
- **Click outside**: Clicking anywhere outside hides the popup immediately
- **Escape key**: Pressing Escape closes the popup immediately
- **After action**: Popup hides immediately after sending or copying
- **Simple UX**: No hover interactions - just select, click, done!

### UI Design
- **Send to Chat button**: Blue accent color (`bg-bolt-elements-item-contentAccent`) with white text
- **Copy button**: Transparent background with hover effect
- **Popup background**: Themed background with border
- **Shadow**: Subtle shadow for depth
- **Animation**: Smooth fade-in and zoom-in effect

### Benefits
- **No extra clicks needed** - popup appears automatically
- Quick debugging assistance from AI
- No need to manually copy/paste and format
- Context-aware message formatting
- Seamless integration with existing chat workflow
- Familiar Cursor-like experience

## Technical Notes

### Dependencies
- `@radix-ui/react-context-menu` (already in project)
- No new dependencies added

### Browser Compatibility
- Uses standard `window.getSelection()` API
- Works in all modern browsers
- Gracefully handles edge cases (no selection, empty text)

### Performance
- Lightweight component with minimal overhead
- Auto-show popup only renders when text is selected
- Efficient event handling with proper cleanup
- Uses `mouseup` event for selection detection
- Portal rendering for optimal z-index management
- Proper timeout cleanup on unmount

## Future Enhancements (Optional)
- Add keyboard shortcut (e.g., Cmd/Ctrl+Shift+K) for quick send
- Add "Ask AI about this" with custom prompt input
- Add "Fix this" for quick error resolution
- Add selection history/recent selections
- Add multi-selection support

## Testing Checklist
- [x] Text selection works in CodeMirror editor
- [x] Text selection works in Log Viewer
- [x] **Auto-show popup appears immediately after selection**
- [x] **Popup positioned above selection, centered**
- [x] **Popup auto-hides after 10 seconds**
- [x] **Hover on popup pauses auto-hide timer**
- [x] **Hover leave restarts auto-hide timer**
- [x] **Click outside hides popup immediately**
- [x] Context menu appears on right-click
- [x] "Send to Chat" formats message correctly (both popup and context menu)
- [x] "Copy" copies text to clipboard (both popup and context menu)
- [x] Selection clears after sending
- [x] Popup hides after action
- [x] Theme adapts to light/dark mode
- [x] No linter errors
- [x] TypeScript types are correct
- [x] Removed unused props throughout the chain
- [x] Portal rendering works correctly
- [x] Z-index layering is correct

