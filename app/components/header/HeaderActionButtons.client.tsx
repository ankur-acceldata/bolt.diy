import { useStore } from '@nanostores/react';

/*
 * import { workbenchStore } from '~/lib/stores/workbench';
 * import { useState } from 'react';
 */
import { streamingState } from '~/lib/stores/streaming';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { useChatHistory } from '~/lib/persistence';
import { useState } from 'react';
import { Button } from '~/components/ui/Button';
import { Dialog, DialogRoot } from '~/components/ui/Dialog';

// import { DeployButton } from '~/components/deploy/DeployButton';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted }: HeaderActionButtonsProps) {
  /*
   * const [activePreviewIndex] = useState(0);
   * const previews = useStore(workbenchStore.previews);
   * const activePreview = previews[activePreviewIndex];
   */
  const isStreaming = useStore(streamingState);
  const { exportChat } = useChatHistory();

  const shouldShowButtons = !isStreaming;

  // Run Pipeline state
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [showPipelineDialog, setShowPipelineDialog] = useState(false);

  const handleRunPipeline = async () => {
    setIsRunningPipeline(true);
    setPipelineResult(null);
    setShowPipelineDialog(false);

    try {
      const res = await fetch('/api/pipeline-execute', { method: 'POST' });
      const data = await res.json();
      setPipelineResult(data);
      setShowPipelineDialog(true);
    } catch (error) {
      setPipelineResult({ error: error instanceof Error ? error.message : 'Unknown error' });
      setShowPipelineDialog(true);
    } finally {
      setIsRunningPipeline(false);
    }
  };

  return (
    <div className="flex items-center">
      {chatStarted && shouldShowButtons && (
        <>
          <Button onClick={handleRunPipeline} disabled={isRunningPipeline} variant="outline" size="sm" className="mr-2">
            {isRunningPipeline ? (
              <>
                <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                Running...
              </>
            ) : (
              'Run Pipeline'
            )}
          </Button>
          {showPipelineDialog && (
            <DialogRoot open={showPipelineDialog} onOpenChange={setShowPipelineDialog}>
              <Dialog onClose={() => setShowPipelineDialog(false)} className="w-full max-w-3xl">
                <div className="p-6 bg-[var(--bolt-elements-bg-depth-1)] text-[var(--bolt-elements-textPrimary)] rounded-lg">
                  <h2 className="text-lg font-semibold mb-2">Pipeline Execution Result</h2>
                  <pre className="rounded p-4 text-xs overflow-x-auto max-h-96 bg-[var(--bolt-elements-code-background)] text-[var(--bolt-elements-code-text)]">
                    {JSON.stringify(pipelineResult, null, 2)}
                  </pre>
                  <div className="mt-4 flex justify-end">
                    <Button onClick={() => setShowPipelineDialog(false)} variant="outline" size="sm">
                      Close
                    </Button>
                  </div>
                </div>
              </Dialog>
            </DialogRoot>
          )}
        </>
      )}
      {chatStarted && shouldShowButtons && <ExportChatButton exportChat={exportChat} />}
      {/* {shouldShowButtons && <DeployButton />} */}
    </div>
  );
}
