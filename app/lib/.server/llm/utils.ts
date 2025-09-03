import { type Message } from 'ai';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { IGNORE_PATTERNS, type FileMap } from './constants';
import ignore from 'ignore';
import type { ContextAnnotation } from '~/types/context';

export function extractPropertiesFromMessage(message: Omit<Message, 'id'>): {
  model: string;
  provider: string;
  content: any;
} {
  // Helper function to safely extract text from nested structures
  function extractText(content: any): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      // Handle nested arrays - flatten and extract text
      return content
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }

          if (item && typeof item === 'object') {
            if (item.type === 'text') {
              return typeof item.text === 'string' ? item.text : extractText(item.text);
            }

            // For other types, return empty string to avoid breaking regex
            return '';
          }

          return '';
        })
        .join(' ');
    }

    if (content && typeof content === 'object' && content.type === 'text') {
      return typeof content.text === 'string' ? content.text : extractText(content.text);
    }

    return '';
  }

  const textContent = Array.isArray(message.content)
    ? extractText(message.content.find((item) => item.type === 'text'))
    : extractText(message.content);

  const modelMatch = textContent.match(MODEL_REGEX);
  const providerMatch = textContent.match(PROVIDER_REGEX);

  /*
   * Extract model
   * const modelMatch = message.content.match(MODEL_REGEX);
   */
  const model = modelMatch ? modelMatch[1] : DEFAULT_MODEL;

  /*
   * Extract provider
   * const providerMatch = message.content.match(PROVIDER_REGEX);
   */
  const provider = providerMatch ? providerMatch[1] : DEFAULT_PROVIDER.name;

  // Helper function to clean content while preserving structure
  function cleanContent(content: any): any {
    if (typeof content === 'string') {
      return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '');
    }

    if (Array.isArray(content)) {
      return content.map((item) => cleanContent(item));
    }

    if (content && typeof content === 'object') {
      if (content.type === 'text') {
        return {
          ...content,
          text: cleanContent(content.text),
        };
      }

      return content; // Preserve non-text items as is
    }

    return content;
  }

  const cleanedContent = Array.isArray(message.content)
    ? message.content.map((item) => {
        if (item.type === 'text') {
          return {
            type: 'text',
            text: cleanContent(item.text),
          };
        }

        return item; // Preserve image_url and other types as is
      })
    : cleanContent(message.content);

  return { model, provider, content: cleanedContent };
}

export function simplifyBoltActions(input: string): string {
  // Using regex to match boltAction tags that have type="file"
  const regex = /(<boltAction[^>]*type="file"[^>]*>)([\s\S]*?)(<\/boltAction>)/g;

  // Replace each matching occurrence
  return input.replace(regex, (_0, openingTag, _2, closingTag) => {
    return `${openingTag}\n          ...\n        ${closingTag}`;
  });
}

export function createFilesContext(files: FileMap, useRelativePath?: boolean) {
  const ig = ignore().add(IGNORE_PATTERNS);
  let filePaths = Object.keys(files);
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  const fileContexts = filePaths
    .filter((x) => files[x] && files[x].type == 'file')
    .map((path) => {
      const dirent = files[path];

      if (!dirent || dirent.type == 'folder') {
        return '';
      }

      const codeWithLinesNumbers = dirent.content
        .split('\n')
        // .map((v, i) => `${i + 1}|${v}`)
        .join('\n');

      let filePath = path;

      if (useRelativePath) {
        filePath = path.replace('/home/project/', '');
      }

      return `<boltAction type="file" filePath="${filePath}">${codeWithLinesNumbers}</boltAction>`;
    });

  return `<boltArtifact id="code-content" title="Code Content" >\n${fileContexts.join('\n')}\n</boltArtifact>`;
}

export function extractCurrentContext(messages: Message[]) {
  const lastAssistantMessage = messages.filter((x) => x.role == 'assistant').slice(-1)[0];

  if (!lastAssistantMessage) {
    return { summary: undefined, codeContext: undefined };
  }

  let summary: ContextAnnotation | undefined;
  let codeContext: ContextAnnotation | undefined;

  if (!lastAssistantMessage.annotations?.length) {
    return { summary: undefined, codeContext: undefined };
  }

  for (let i = 0; i < lastAssistantMessage.annotations.length; i++) {
    const annotation = lastAssistantMessage.annotations[i];

    if (!annotation || typeof annotation !== 'object') {
      continue;
    }

    if (!(annotation as any).type) {
      continue;
    }

    const annotationObject = annotation as any;

    if (annotationObject.type === 'codeContext') {
      codeContext = annotationObject;
      break;
    } else if (annotationObject.type === 'chatSummary') {
      summary = annotationObject;
      break;
    }
  }

  return { summary, codeContext };
}
