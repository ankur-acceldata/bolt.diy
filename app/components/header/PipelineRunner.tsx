import { useState, useRef } from 'react';
import { Button } from '~/components/ui/Button';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { apiFetch } from '~/utils/api';

interface PipelineRunnerProps {
  onClose?: () => void;
}

export function PipelineRunner({ onClose }: PipelineRunnerProps) {
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [showPipelineDialog, setShowPipelineDialog] = useState(false);
  const [auditData, setAuditData] = useState<any[] | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pipelineCompleted, setPipelineCompleted] = useState(false);

  // Ref to track if modal is open for polling cleanup
  const modalOpenRef = useRef(false);

  // Helper to poll audit
  const pollAudit = async (runId: number) => {
    setIsPolling(true);
    setErrorMsg(null);
    setPipelineCompleted(false);
    modalOpenRef.current = true;

    let finished = false;

    while (!finished && modalOpenRef.current) {
      try {
        const res = await apiFetch('/api/pipeline-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId }),
        });

        if (!res.ok) {
          throw new Error(`Audit API error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        // Defensive: data?.data?.data should be an array
        const events =
          data &&
          typeof data === 'object' &&
          'data' in data &&
          (data as any).data &&
          typeof (data as any).data === 'object' &&
          ((data as any).data as any).data &&
          Array.isArray(((data as any).data as any).data)
            ? ((data as any).data as any).data
            : [];

        setAuditData(events);

        // Check if pipeline is complete - pipeline is finished when the last object has status of FAILED or SUCCESS
        const lastEvent = events[events.length - 1];
        const isLastStageComplete = lastEvent && (lastEvent.status === 'FAILED' || lastEvent.status === 'SUCCESS');

        if (isLastStageComplete) {
          finished = true;
          setPipelineCompleted(true);
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to fetch pipeline audit.');
        finished = true;
      }
    }

    setIsPolling(false);
  };

  // Handle modal close
  const handleModalClose = () => {
    modalOpenRef.current = false;
    setShowPipelineDialog(false);
    onClose?.();
  };

  // Handle modal open change
  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      handleModalClose();
    } else {
      modalOpenRef.current = true;
    }

    setShowPipelineDialog(open);
  };

  // Helper to render audit events
  const renderAuditEvents = (events: any[]) => {
    if (!Array.isArray(events) || events.length === 0) {
      return <div>No audit events found.</div>;
    }

    return (
      <ul className="space-y-3">
        {events.map((event) => {
          let statusColor = 'text-yellow-500';
          let statusIcon = 'i-ph:clock';

          if (typeof event.status === 'string') {
            if (event.status.endsWith('_failed') || event.status === 'FAILED') {
              statusColor = 'text-red-500';
              statusIcon = 'i-ph:x-circle';
            } else if (
              event.status.endsWith('_succeeded') ||
              event.status === 'execution_completed' ||
              event.status === 'SUCCESS'
            ) {
              statusColor = 'text-green-500';
              statusIcon = 'i-ph:check-circle';
            } else if (event.status === 'INPROGRESS') {
              statusColor = 'text-yellow-500';
              statusIcon = 'i-ph:clock';
            }
          }

          return (
            <li
              key={event.id}
              className="flex items-center gap-4 border-b border-[var(--bolt-elements-borderColor)] pb-2 last:border-b-0"
            >
              <span className={`w-5 h-5 ${statusColor} ${statusIcon}`} />
              <span className="font-medium text-[var(--bolt-elements-textPrimary)]">{event.status}</span>
              <span className="text-xs text-[var(--bolt-elements-textSecondary)] ml-auto">
                {event.eventTime ? new Date(event.eventTime).toLocaleString() : ''}
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  // Helper to summarize audit
  const summarizeAudit = (events: any[]) => {
    if (!Array.isArray(events) || events.length === 0) {
      return null;
    }

    const anyFailed = events.some((e: any) => typeof e.status === 'string' && e.status.endsWith('_failed'));
    const hasExecutionCompleted = events.some((e: any) => e.status === 'execution_completed');
    const allSucceeded = events.every(
      (e: any) =>
        typeof e.status === 'string' &&
        (e.status.endsWith('_succeeded') || e.status === 'execution_completed' || e.status !== 'INPROGRESS'),
    );

    if (anyFailed) {
      return <div className="text-red-500 font-semibold mb-4">Some stages failed.</div>;
    }

    if (allSucceeded || hasExecutionCompleted) {
      return <div className="text-green-500 font-semibold mb-4">All stages succeeded.</div>;
    }

    return <div className="text-yellow-500 font-semibold mb-4">Pipeline is in progress...</div>;
  };

  const handleRunPipeline = async () => {
    setIsRunningPipeline(true);
    setAuditData(null);
    setErrorMsg(null);
    setShowPipelineDialog(false);

    try {
      const res = await apiFetch('/api/pipeline-execute', { method: 'POST' });

      if (!res.ok) {
        throw new Error(`Execute API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      let runId: number | undefined;

      if (
        data &&
        typeof data === 'object' &&
        'data' in data &&
        data.data &&
        typeof data.data === 'object' &&
        'data' in data.data &&
        data.data.data &&
        typeof data.data.data === 'object' &&
        'id' in data.data.data
      ) {
        runId = Number((data.data.data as { id: unknown }).id);
      }

      if (runId) {
        setShowPipelineDialog(true);
        pollAudit(runId);
      } else {
        throw new Error('No runId returned from execute API.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to execute pipeline.');
      setShowPipelineDialog(true);
    } finally {
      setIsRunningPipeline(false);
    }
  };

  return (
    <>
      <Button onClick={handleRunPipeline} disabled={isRunningPipeline} variant="accent" size="sm" className="mr-2">
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
        <DialogRoot open={showPipelineDialog} onOpenChange={handleModalOpenChange}>
          <Dialog onClose={handleModalClose} className="w-full max-w-3xl">
            <div className="p-6 bg-[var(--bolt-elements-bg-depth-1)] text-[var(--bolt-elements-textPrimary)] rounded-lg">
              <DialogTitle>Pipeline Audit</DialogTitle>
              <DialogDescription className="mb-6">
                Monitor the progress and status of your pipeline execution
              </DialogDescription>
              {errorMsg ? (
                <div className="text-red-500 text-sm mb-6">{errorMsg}</div>
              ) : isPolling && (!auditData || auditData.length === 0) ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="i-ph-spinner-gap-bold animate-spin w-6 h-6 text-[var(--bolt-elements-textPrimary)]" />
                    <div>
                      <div className="font-medium text-[var(--bolt-elements-textPrimary)]">Pipeline is running...</div>
                      <div className="text-sm text-[var(--bolt-elements-textSecondary)]">Checking every 10 seconds</div>
                    </div>
                  </div>
                  <div className="bg-[var(--bolt-elements-bg-depth-2)] rounded-lg p-4">
                    <div className="text-sm text-[var(--bolt-elements-textSecondary)] mb-2">What's happening:</div>
                    <ul className="text-xs text-[var(--bolt-elements-textTertiary)] space-y-1">
                      <li>• Pipeline execution started successfully</li>
                      <li>• Monitoring individual stage progress</li>
                      <li>• Will show results when all stages complete</li>
                      <li>• This may take several minutes depending on pipeline complexity</li>
                    </ul>
                  </div>
                </div>
              ) : isPolling && auditData && auditData.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="i-ph-spinner-gap-bold animate-spin w-6 h-6 text-[var(--bolt-elements-textPrimary)]" />
                    <div>
                      <div className="font-medium text-[var(--bolt-elements-textPrimary)]">Pipeline in progress...</div>
                      <div className="text-sm text-[var(--bolt-elements-textSecondary)]">
                        {auditData.filter((e: any) => e.status === 'INPROGRESS').length} stages still running
                      </div>
                    </div>
                  </div>
                  {summarizeAudit(auditData)}
                  {renderAuditEvents(auditData)}
                </div>
              ) : Array.isArray(auditData) && auditData.length > 0 ? (
                <div className="space-y-6">
                  {pipelineCompleted && (
                    <div className="p-4 bg-[var(--bolt-elements-bg-depth-2)] rounded-lg border border-[var(--bolt-elements-borderColor)]">
                      <div className="text-sm text-[var(--bolt-elements-textSecondary)]">
                        ✅ Pipeline completed! {isPolling ? 'Final results below:' : 'Results:'}
                      </div>
                    </div>
                  )}
                  {summarizeAudit(auditData)}
                  {renderAuditEvents(auditData)}
                </div>
              ) : (
                <div className="text-sm text-[var(--bolt-elements-textSecondary)]">No audit data available.</div>
              )}
              <div className="mt-8 flex justify-end">
                <Button onClick={handleModalClose} variant="outline" size="sm">
                  Close
                </Button>
              </div>
            </div>
          </Dialog>
        </DialogRoot>
      )}
    </>
  );
}
