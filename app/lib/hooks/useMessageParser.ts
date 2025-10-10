/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Message } from 'ai';
import { useCallback, useState } from 'react';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useMessageParser');

const messageParser = new StreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      logger.trace('onArtifactOpen', data);

      workbenchStore.showWorkbench.set(true);
      workbenchStore.addArtifact(data);
    },
    onArtifactClose: (data) => {
      logger.trace('onArtifactClose');

      workbenchStore.updateArtifact(data, { closed: true });
    },
    onActionOpen: (data) => {
      logger.trace('onActionOpen', data.action);

      // we only add shell actions when when the close tag got parsed because only then we have the content
      if (data.action.type === 'file') {
        workbenchStore.addAction(data);
      }
    },
    onActionClose: (data) => {
      logger.trace('onActionClose', data.action);

      if (data.action.type !== 'file') {
        workbenchStore.addAction(data);
      }

      workbenchStore.runAction(data);
    },
    onActionStream: (data) => {
      logger.trace('onActionStream', data.action);
      workbenchStore.runAction(data, true);
    },
  },
});
const extractTextContent = (message: Message) =>
  Array.isArray(message.content)
    ? (message.content.find((item) => item.type === 'text')?.text as string) || ''
    : message.content;

export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  // Track message IDs at each position to detect when AI SDK replaces a message
  const [messageIds, setMessageIds] = useState<{ [key: number]: string }>({});

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
    }

    // Set streaming state in the parser
    messageParser.setStreaming(isLoading);

    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant' || message.role === 'user') {
        const messageContent = extractTextContent(message);
        logger.debug(
          `📝 Parsing message ${index}, id=${message.id}, contentLength=${messageContent.length}, isLoading=${isLoading}, reset=${reset}`,
        );

        const newParsedContent = messageParser.parse(message.id, messageContent);
        logger.debug(`📝 Parser returned ${newParsedContent.length} new chars for message ${index}`);

        setParsedMessages((prevParsed) => {
          const prevContent = prevParsed[index] || '';
          const updatedContent = !reset ? prevContent + newParsedContent : newParsedContent;

          logger.debug(
            `📝 Message ${index}: prevLength=${prevContent.length}, newLength=${newParsedContent.length}, totalLength=${updatedContent.length}`,
          );

          return {
            ...prevParsed,
            [index]: updatedContent,
          };
        });

        // Track message ID changes to reset parsed content when AI SDK replaces temp message
        setMessageIds((prevIds) => {
          const prevId = prevIds[index];

          /*
           * If message ID changed at this position, the parser has reset and returned full content
           * So we need to reset our parsed content too
           */
          if (prevId && prevId !== message.id) {
            logger.debug(
              `📝 Message ID changed at index ${index}: ${prevId} -> ${message.id}, resetting parsed content`,
            );

            setParsedMessages((prev) => ({
              ...prev,
              [index]: newParsedContent, // Replace with the fresh content from new message
            }));
          }

          return {
            ...prevIds,
            [index]: message.id,
          };
        });
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
