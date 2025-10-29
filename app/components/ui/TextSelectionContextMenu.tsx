import { type ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('TextSelectionContextMenu');

interface TextSelectionContextMenuProps {
  /** The content to wrap with context menu */
  children: ReactNode;

  /** Callback when "Send to Chat" is clicked with selected text */
  onSendToChat?: (selectedText: string) => void;

  /** Whether the context menu is enabled */
  enabled?: boolean;

  /** Additional menu items to show */
  additionalItems?: ReactNode;

  /** Auto-show timeout in milliseconds (default: 5000ms) */
  autoShowTimeout?: number;
}

interface ContextMenuItemProps {
  onSelect?: () => void;
  children: ReactNode;
  className?: string;
}

interface PopupPosition {
  top: number;
  left: number;
}

function ContextMenuItem({ onSelect, children, className }: ContextMenuItemProps) {
  return (
    <ContextMenu.Item
      onSelect={onSelect}
      className={classNames(
        'flex items-center gap-2 px-3 py-2 outline-0 text-sm cursor-pointer rounded-md transition-colors',
        'text-bolt-elements-textPrimary',
        'hover:text-bolt-elements-item-contentActive hover:bg-bolt-elements-item-backgroundActive',
        'focus:bg-bolt-elements-item-backgroundActive',
        className,
      )}
    >
      {children}
    </ContextMenu.Item>
  );
}

/**
 * A context menu wrapper that adds "Send to Chat" functionality for selected text
 * - Shows automatically after text selection for 10 seconds
 * - Also accessible via right-click context menu
 * - Uses Radix UI ContextMenu to match existing UI patterns
 */
export function TextSelectionContextMenu({
  children,
  onSendToChat,
  enabled = true,
  additionalItems,
  autoShowTimeout = 5000,
}: TextSelectionContextMenuProps) {
  const [showAutoPopup, setShowAutoPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const autoHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionRangeRef = useRef<Range | null>(null);

  const clearAutoHideTimeout = useCallback(() => {
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
      autoHideTimeoutRef.current = null;
    }
  }, []);

  const hideAutoPopup = useCallback(() => {
    logger.debug('Hiding popup');
    setShowAutoPopup(false);

    /*
     * Don't clear selectedText and selectionRangeRef - keep them for context menu
     * setSelectedText('');
     * selectionRangeRef.current = null;
     */
    clearAutoHideTimeout();
  }, [clearAutoHideTimeout]);

  const handleSendToChat = useCallback(
    (text?: string) => {
      const textToSend = text || selectedText;

      if (textToSend && onSendToChat) {
        onSendToChat(textToSend);

        // Clear selection after sending
        window.getSelection()?.removeAllRanges();
        setShowAutoPopup(false);
        setSelectedText('');
        selectionRangeRef.current = null;
        clearAutoHideTimeout();
      }
    },
    [selectedText, onSendToChat, clearAutoHideTimeout],
  );

  const handleCopySelection = useCallback(
    (text?: string) => {
      const textToCopy = text || selectedText;

      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy);
        setShowAutoPopup(false);
        setSelectedText('');
        selectionRangeRef.current = null;
        clearAutoHideTimeout();
      }
    },
    [selectedText, clearAutoHideTimeout],
  );

  const handleContextMenuSendToChat = useCallback(() => {
    logger.debug('=== Context menu Send to Chat clicked ===');

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    logger.debug('Context menu selection:', {
      hasSelection: !!selection,
      text: text?.substring(0, 50),
      textLength: text?.length,
      rangeCount: selection?.rangeCount,
      storedText: selectedText?.substring(0, 50),
      storedTextLength: selectedText?.length,
    });

    // Use current selection if available, otherwise fall back to stored selection
    const textToSend = text || selectedText;

    if (textToSend) {
      logger.info('Sending text from context menu:', textToSend.length, 'characters');
      handleSendToChat(textToSend);
    } else {
      logger.warn('No text to send from context menu');
    }
  }, [handleSendToChat, selectedText]);

  const handleContextMenuCopy = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    // Use current selection if available, otherwise fall back to stored selection
    const textToCopy = text || selectedText;

    if (textToCopy) {
      handleCopySelection(textToCopy);
    }
  }, [handleCopySelection, selectedText]);

  // Show popup immediately
  const showPopup = useCallback(
    (range: Range) => {
      const rect = range.getBoundingClientRect();
      const top = rect.top + window.scrollY - 60; // 60px above selection
      const left = rect.left + window.scrollX + rect.width / 2;

      setPopupPosition({ top, left });
      setShowAutoPopup(true);

      // Clear any existing timeout
      clearAutoHideTimeout();

      // Set new auto-hide timeout
      autoHideTimeoutRef.current = setTimeout(() => {
        logger.debug('Auto-hide timeout triggered');
        hideAutoPopup();
      }, autoShowTimeout);

      logger.info('Popup shown, will auto-hide in', autoShowTimeout, 'ms');
    },
    [clearAutoHideTimeout, autoShowTimeout, hideAutoPopup],
  );

  // Handle text selection
  const handleSelection = useCallback(() => {
    logger.debug('=== handleSelection called ===');
    logger.debug('Current state:', {
      enabled,
      hasCallback: !!onSendToChat,
      showAutoPopup,
      hasContainer: !!containerRef.current,
    });

    if (!enabled || !onSendToChat) {
      logger.debug('Selection handler: disabled or no callback');
      return;
    }

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    logger.debug('Selection details:', {
      text: text?.substring(0, 50),
      length: text?.length,
      rangeCount: selection?.rangeCount,
    });

    if (!text || text.length === 0) {
      logger.debug('No text selected, clearing stored selection');

      // Clear everything when no text is selected
      setShowAutoPopup(false);
      setSelectedText('');
      selectionRangeRef.current = null;
      clearAutoHideTimeout();

      return;
    }

    // Check if selection is within our container
    try {
      const range = selection?.getRangeAt(0);

      if (!range) {
        logger.warn('No range found in selection');
        return;
      }

      if (!containerRef.current) {
        logger.warn('No container ref available');
        return;
      }

      const isWithinContainer = containerRef.current.contains(range.commonAncestorContainer);

      logger.debug('Selection within container:', { isWithinContainer });

      if (!isWithinContainer) {
        logger.debug('Selection not within container, ignoring');
        return;
      }

      // Store the range and text
      selectionRangeRef.current = range.cloneRange();
      setSelectedText(text);

      // Get selection bounding rectangle
      const rect = range.getBoundingClientRect();

      logger.debug('Selection rect:', {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      });

      // Show popup immediately
      showPopup(range);

      logger.info('✅ Text selected, showing popup:', { length: text.length });
    } catch (error) {
      logger.error('❌ Error handling selection:', error);
    }
  }, [enabled, onSendToChat, showAutoPopup, hideAutoPopup, showPopup]);

  // Handle clicks outside popup
  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedOutsidePopup = popupRef.current && !popupRef.current.contains(target);

      if (clickedOutsidePopup) {
        logger.debug('Clicked outside popup, hiding');
        hideAutoPopup();
      }
    },
    [hideAutoPopup],
  );

  // Handle escape key
  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showAutoPopup) {
        logger.debug('Escape key pressed, hiding popup');
        hideAutoPopup();
      }
    },
    [showAutoPopup, hideAutoPopup],
  );

  // Setup event listeners
  useEffect(() => {
    if (!enabled || !onSendToChat) {
      logger.debug('TextSelectionContextMenu disabled or no callback');
      return undefined;
    }

    const container = containerRef.current;

    if (!container) {
      logger.warn('TextSelectionContextMenu: No container ref');
      return undefined;
    }

    logger.info('TextSelectionContextMenu: Setting up event listeners');

    // Listen for selection changes
    const handleMouseUp = (e: MouseEvent) => {
      logger.debug('🖱️ Mouse up detected', {
        target: (e.target as HTMLElement)?.tagName,
        className: (e.target as HTMLElement)?.className,
      });

      // Small delay to ensure selection is complete
      setTimeout(() => {
        logger.debug('⏱️ Delayed selection handler triggered');
        handleSelection();
      }, 10);
    };

    logger.debug('📝 Adding event listeners to container:', {
      containerTag: container.tagName,
      containerClass: container.className,
    });

    container.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      logger.info('🧹 TextSelectionContextMenu: Cleaning up event listeners');
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      clearAutoHideTimeout();
    };
  }, [enabled, onSendToChat, handleSelection, handleClickOutside, handleEscapeKey, clearAutoHideTimeout]);

  if (!enabled || !onSendToChat) {
    return <>{children}</>;
  }

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div ref={containerRef} className="h-full">
            {children}
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content
            className={classNames(
              'min-w-[200px] rounded-lg p-1',
              'bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-2',
              'border border-bolt-elements-borderColor',
              'shadow-xl shadow-black/20',
              'z-[999]',
              'data-[state=open]:animate-in animate-duration-100',
              'data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            )}
          >
            <ContextMenu.Group className="p-1">
              <ContextMenuItem onSelect={handleContextMenuSendToChat}>
                <div className="i-ph:chat-circle-text text-lg" />
                <span>Send to Chat</span>
              </ContextMenuItem>
              <ContextMenuItem onSelect={handleContextMenuCopy}>
                <div className="i-ph:copy text-lg" />
                <span>Copy</span>
              </ContextMenuItem>
            </ContextMenu.Group>
            {additionalItems && (
              <>
                <ContextMenu.Separator className="h-px bg-bolt-elements-borderColor my-1" />
                <ContextMenu.Group className="p-1">{additionalItems}</ContextMenu.Group>
              </>
            )}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {/* Auto-show popup */}
      {showAutoPopup &&
        createPortal(
          <div
            ref={popupRef}
            className={classNames(
              'fixed z-[9999] transform -translate-x-1/2',
              'min-w-[200px] rounded-lg p-1',
              'bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-2',
              'border border-bolt-elements-borderColor',
              'shadow-xl shadow-black/20',
              'animate-in fade-in-0 zoom-in-95 duration-200',
            )}
            style={{
              top: `${popupPosition.top}px`,
              left: `${popupPosition.left}px`,
            }}
          >
            <div className="p-1 space-y-1">
              <button
                onClick={() => handleSendToChat()}
                className={classNames(
                  'flex items-center gap-2 px-3 py-2 outline-0 text-sm cursor-pointer rounded-md transition-colors w-full text-left',
                  'bg-bolt-elements-item-contentAccent text-white',
                  'hover:bg-bolt-elements-item-contentAccentSecondary',
                )}
              >
                <div className="i-ph:chat-circle-text text-lg" />
                <span>Send to Chat</span>
              </button>
              <button
                onClick={() => handleCopySelection()}
                className={classNames(
                  'flex items-center gap-2 px-3 py-2 outline-0 text-sm cursor-pointer rounded-md transition-colors w-full text-left',
                  'text-bolt-elements-textPrimary bg-transparent',
                  'hover:bg-bolt-elements-item-backgroundActive',
                )}
              >
                <div className="i-ph:copy text-lg" />
                <span>Copy</span>
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
