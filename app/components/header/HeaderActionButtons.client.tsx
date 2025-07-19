import { useStore } from '@nanostores/react';
import { streamingState } from '~/lib/stores/streaming';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { useChatHistory } from '~/lib/persistence';
import { PipelineRunner } from './PipelineRunner';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted }: HeaderActionButtonsProps) {
  const isStreaming = useStore(streamingState);
  const { exportChat } = useChatHistory();

  const shouldShowButtons = !isStreaming;

  return (
    <div className="flex items-center">
      {chatStarted && shouldShowButtons && (
        <>
          <PipelineRunner />
          <ExportChatButton exportChat={exportChat} />
        </>
      )}
      {/* {shouldShowButtons && <DeployButton />} */}
    </div>
  );
}
