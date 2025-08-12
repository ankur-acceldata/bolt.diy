/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { Markdown } from './Markdown';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import type {
  TextUIPart,
  ReasoningUIPart,
  ToolInvocationUIPart,
  SourceUIPart,
  FileUIPart,
  StepStartUIPart,
} from '@ai-sdk/ui-utils';

interface UserMessageProps {
  content: string | Array<{ type: string; text?: string; image?: string }>;
  parts:
    | (TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart)[]
    | undefined;
}

export function UserMessage({ content, parts }: UserMessageProps) {
  const profile = useStore(profileStore);

  // Extract images from parts - look for file parts with image mime types
  const images =
    parts?.filter(
      (part): part is FileUIPart => part.type === 'file' && 'mimeType' in part && part.mimeType.startsWith('image/'),
    ) || [];

  // Get text content regardless of content type
  const textContent = Array.isArray(content)
    ? stripMetadata(content.find((item) => item.type === 'text')?.text || '')
    : stripMetadata(content);

  return (
    <div className="flex gap-3 w-full justify-end items-start pr-2">
      <div className="flex flex-col max-w-chat">
        {/* Optional username label */}
        {profile?.username && (
          <div className="text-xs text-bolt-elements-textSecondary mb-1 text-right pr-1">{profile.username}</div>
        )}

        {/* Message bubble */}
        <div className="bg-bolt-elements-background-depth-2 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-sm border border-bolt-elements-borderColor">
          {/* Images */}
          {images.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {images.map((item, index) => (
                <div key={index} className="rounded-lg border border-bolt-elements-borderColor overflow-hidden">
                  <img
                    src={`data:${item.mimeType};base64,${item.data}`}
                    alt={`Image ${index + 1}`}
                    className="h-16 w-16 object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Text content */}
          {textContent && <Markdown html>{textContent}</Markdown>}
        </div>
      </div>

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-bolt-elements-background-depth-3 ring-2 ring-bolt-elements-borderColor shadow-sm flex-shrink-0 mt-1">
        {profile?.avatar ? (
          <img
            src={profile.avatar}
            alt={profile?.username || 'User'}
            className="w-full h-full object-cover"
            loading="eager"
            decoding="sync"
          />
        ) : (
          <div className="i-ph:user w-6 h-6 text-bolt-elements-textSecondary" />
        )}
      </div>
    </div>
  );
}

function stripMetadata(content: string) {
  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '');
}
