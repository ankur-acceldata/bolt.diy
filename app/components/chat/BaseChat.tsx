/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { JSONValue, Message } from 'ai';
import React, { type RefCallback, useEffect, useState, useRef, useCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Menu } from '~/components/sidebar/Menu.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { PostMessageService } from '~/lib/services/postMessageService';
import { MessageType } from '~/types/communicationBus';
import type { BusMessage } from '~/types/communicationBus';

import { Messages } from './Messages.client';
import { getApiKeysFromCookies } from './APIKeyManager';
import Cookies from 'js-cookie';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './BaseChat.module.scss';
import { ImportButtons } from '~/components/chat/chatExportAndImport/ImportButtons';

// import { ExamplePrompts } from '~/components/chat/ExamplePrompts';

// import GitCloneButton from './GitCloneButton';
import type { ProviderInfo } from '~/types/model';

// import StarterTemplates from './StarterTemplates';
import type { ActionAlert, SupabaseAlert, DeployAlert, LlmErrorAlertType } from '~/types/actions';
import DeployChatAlert from '~/components/deploy/DeployAlert';
import ChatAlert from './ChatAlert';
import type { ModelInfo } from '~/lib/modules/llm/types';
import ProgressCompilation from './ProgressCompilation';
import type { ProgressAnnotation } from '~/types/context';
import { SupabaseChatAlert } from '~/components/chat/SupabaseAlert';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import { useStore } from '@nanostores/react';
import { StickToBottom, useStickToBottomContext } from '~/lib/hooks';
import { ChatBox } from './ChatBox';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import LlmErrorAlert from './LLMApiAlert';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('Basechat');

const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  showWorkbench?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  onStreamingChange?: (streaming: boolean) => void;
  messages?: Message[];
  description?: string;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  setInput?: (input: string) => void;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
  exportChat?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  supabaseAlert?: SupabaseAlert;
  clearSupabaseAlert?: () => void;
  deployAlert?: DeployAlert;
  clearDeployAlert?: () => void;
  llmErrorAlert?: LlmErrorAlertType;
  clearLlmErrorAlert?: () => void;
  data?: JSONValue[] | undefined;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  append?: (message: Message) => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: (element: ElementInfo | null) => void;
  selectedTemplate?: any;
  setSelectedTemplate?: (template: any) => void;
  addToolResult?: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      showChat = true,
      showWorkbench = true,
      chatStarted = false,
      isStreaming = false,
      onStreamingChange,
      model,
      setModel,
      provider,
      setProvider,
      providerList,
      input = '',
      setInput,
      enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      enhancePrompt,
      sendMessage,
      handleStop,
      importChat,
      exportChat,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      deployAlert,
      clearDeployAlert,
      supabaseAlert,
      clearSupabaseAlert,
      llmErrorAlert,
      clearLlmErrorAlert,
      data,
      chatMode,
      setChatMode,
      append,
      designScheme,
      setDesignScheme,
      selectedElement,
      setSelectedElement,
      selectedTemplate,
      setSelectedTemplate,
      addToolResult = () => {
        throw new Error('addToolResult not implemented');
      },
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    const [isModelSettingsCollapsed, setIsModelSettingsCollapsed] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const expoUrl = useStore(expoUrlAtom);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const postMessageServiceRef = useRef<PostMessageService | null>(null);
    const modelsFetchedRef = useRef(false);
    const lastResponseBroadcastRef = useRef<{
      state: 'idle' | 'in-progress' | 'generated' | 'error';
      message?: string;
      reason?: string;
    }>({
      state: 'idle',
      message: undefined,
      reason: undefined,
    });

    useEffect(() => {
      // Initialize PostMessageService
      if (!postMessageServiceRef.current) {
        const service = new PostMessageService();
        service.setReady();

        const resetPayload = {
          type: MessageType.RESPONSE_RESET,
          payload: {
            message: 'Response reset',
            status: 'idle',
            timestamp: Date.now(),
            reason: 'initial-load',
          },
          visibility: 'public' as const,
        } satisfies Partial<BusMessage<any>>;

        service.sendMessage(resetPayload);
        postMessageServiceRef.current = service;
        lastResponseBroadcastRef.current = { state: 'idle', message: 'Response reset', reason: 'initial-load' };
      }

      return () => {
        postMessageServiceRef.current?.destroy();
        postMessageServiceRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (expoUrl) {
        setQrModalOpen(true);
      }
    }, [expoUrl]);

    useEffect(() => {
      if (!Array.isArray(data) || data.length === 0) {
        return;
      }

      const progressList = data.filter(
        (x) => typeof x === 'object' && (x as any).type === 'progress',
      ) as ProgressAnnotation[];
      setProgressAnnotations(progressList);
    }, [data]);
    useEffect(() => {
      // Transcript effect
    }, [transcript]);

    useEffect(() => {
      onStreamingChange?.(isStreaming);
    }, [isStreaming, onStreamingChange]);

    const buildStatusPayload = useCallback(() => {
      return {
        state: lastResponseBroadcastRef.current.state,
        message: lastResponseBroadcastRef.current.message,
        reason: lastResponseBroadcastRef.current.reason,
        timestamp: Date.now(),
      };
    }, []);

    const sendStatusMessage = useCallback(
      (options?: { responseId?: string; visibility?: 'public' | 'private' }) => {
        const service = postMessageServiceRef.current;

        if (!service) {
          return;
        }

        service.sendMessage({
          type: MessageType.RESPONSE_STATUS,
          payload: buildStatusPayload(),
          responseId: options?.responseId,
          visibility: options?.visibility,
        });
      },
      [buildStatusPayload],
    );

    const broadcastResponseState = useCallback(
      (
        state: 'idle' | 'in-progress' | 'generated' | 'error',
        annotation?: ProgressAnnotation | { message?: string; status?: string; reason?: string },
      ) => {
        const service = postMessageServiceRef.current;
        const lastState = lastResponseBroadcastRef.current.state;
        const lastMessage = lastResponseBroadcastRef.current.message;
        const lastReason = lastResponseBroadcastRef.current.reason;
        const incomingMessage = annotation?.message;
        const incomingReason = annotation && 'reason' in annotation ? annotation.reason : undefined;

        if (state === lastState && incomingMessage === lastMessage && incomingReason === lastReason) {
          return;
        }

        const basePayload: Record<string, any> = {
          message: incomingMessage,
          status: annotation?.status,
          timestamp: Date.now(),
          reason: incomingReason,
        };

        if (service) {
          if (state === 'idle') {
            service.sendMessage({
              type: MessageType.RESPONSE_RESET,
              payload: basePayload,
              visibility: 'public',
            });
          } else if (state === 'in-progress') {
            service.sendMessage({
              type: MessageType.RESPONSE_IN_PROGRESS,
              payload: basePayload,
              visibility: 'public',
            });
          } else {
            service.sendMessage({
              type: MessageType.RESPONSE_GENERATED,
              payload: {
                ...basePayload,
                success: state === 'generated',
                error: state === 'error',
              },
              visibility: 'public',
            });
          }
        }

        lastResponseBroadcastRef.current = {
          state,
          message: incomingMessage,
          reason: incomingReason,
        };

        if (state !== 'idle') {
          sendStatusMessage();
        }
      },
      [sendStatusMessage],
    );

    useEffect(() => {
      const handleBeforeUnload = () => {
        broadcastResponseState('idle', { message: 'Response reset', reason: 'frame-unload' });
        lastResponseBroadcastRef.current = { state: 'idle', message: undefined, reason: 'frame-unload' };
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        broadcastResponseState('idle', { message: 'Response reset', reason: 'frame-destroy' });
        window.removeEventListener('beforeunload', handleBeforeUnload);
        lastResponseBroadcastRef.current = { state: 'idle', message: undefined, reason: 'frame-destroy' };
      };
    }, [broadcastResponseState]);

    const previousStreamingRef = useRef(false);

    useEffect(() => {
      const wasStreaming = previousStreamingRef.current;
      previousStreamingRef.current = isStreaming;

      if (isStreaming && !wasStreaming) {
        setProgressAnnotations([]);
        lastResponseBroadcastRef.current = { state: 'idle', message: undefined, reason: 'stream-start' };
        broadcastResponseState('in-progress', {
          message: 'Generating Response',
          status: 'in-progress',
          label: 'response',
        });

        return;
      }

      if (!isStreaming && wasStreaming && lastResponseBroadcastRef.current.state === 'in-progress') {
        broadcastResponseState('error', {
          message: 'Response not generated',
          status: 'complete',
          label: 'response',
        });
      }
    }, [broadcastResponseState, isStreaming]);

    useEffect(() => {
      if (!chatStarted) {
        lastResponseBroadcastRef.current = { state: 'idle', message: undefined, reason: 'chat-not-started' };
        return;
      }

      const responseAnnotations = progressAnnotations.filter((annotation) => annotation.label === 'response');
      const latestAnnotation = responseAnnotations[responseAnnotations.length - 1];

      if (latestAnnotation?.status === 'complete' && latestAnnotation.message === 'Response Generated') {
        broadcastResponseState('generated', latestAnnotation);
        return;
      }

      if (latestAnnotation?.status === 'complete' && latestAnnotation.message !== 'Response Generated') {
        broadcastResponseState('error', latestAnnotation);
        return;
      }

      if (latestAnnotation?.status === 'in-progress') {
        broadcastResponseState('in-progress', latestAnnotation);
        return;
      }

      if (lastResponseBroadcastRef.current.state !== 'idle') {
        lastResponseBroadcastRef.current = {
          state: 'idle',
          message: undefined,
          reason: 'idle-reset',
        };
      }
    }, [broadcastResponseState, chatStarted, progressAnnotations]);

    useEffect(() => {
      const service = postMessageServiceRef.current;

      if (!service) {
        return undefined;
      }

      const unsubscribe = service.on(MessageType.GET_RESPONSE_STATUS, (_payload, message) => {
        sendStatusMessage({ responseId: message.messageId });
      });

      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }, [sendStatusMessage]);

    useEffect(() => {
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join('');

          setTranscript(transcript);

          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: transcript },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        };

        recognition.onerror = (event) => {
          logger.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }, []);

    useEffect(() => {
      // Only fetch models once on initial mount
      if (typeof window !== 'undefined' && !modelsFetchedRef.current) {
        modelsFetchedRef.current = true;

        let parsedApiKeys: Record<string, string> | undefined = {};

        try {
          parsedApiKeys = getApiKeysFromCookies();
          setApiKeys(parsedApiKeys);
        } catch (error) {
          logger.error('Error loading API keys from cookies:', error);
          Cookies.remove('apiKeys');
        }

        setIsModelLoading('all');
        fetch('/api/models')
          .then((response) => response.json())
          .then((data) => {
            const typedData = data as { modelList: ModelInfo[] };
            setModelList(typedData.modelList);

            // Auto-select the first (latest) model for the current provider if no model is currently selected
            if (provider && setModel && !model) {
              const currentProviderModels = typedData.modelList.filter((m) => m.provider === provider.name);

              if (currentProviderModels.length > 0) {
                const latestModel = currentProviderModels[0]; // First model is the latest due to our sorting
                setModel(latestModel.name);
                Cookies.set('selectedModel', latestModel.name, { expires: 30 });
                logger.info(`Auto-selected latest model: ${latestModel.name} for provider: ${provider.name}`);
              }
            }
          })
          .catch((error) => {
            logger.error('Error fetching model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, []);

    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      const newApiKeys = { ...apiKeys, [providerName]: apiKey };
      setApiKeys(newApiKeys);
      Cookies.set('apiKeys', JSON.stringify(newApiKeys));

      setIsModelLoading(providerName);

      let providerModels: ModelInfo[] = [];

      try {
        const response = await fetch(`/api/models/${encodeURIComponent(providerName)}`);
        const data = await response.json();
        providerModels = (data as { modelList: ModelInfo[] }).modelList;
      } catch (error) {
        logger.error('Error loading dynamic models for:', providerName, error);
      }

      // Only update models for the specific provider
      setModelList((prevModels) => {
        const otherModels = prevModels.filter((model) => model.provider !== providerName);
        return [...otherModels, ...providerModels];
      });

      // Auto-select the first (latest) model if this is the current provider
      if (provider?.name === providerName && providerModels.length > 0 && setModel) {
        const latestModel = providerModels[0]; // First model is the latest due to our sorting
        setModel(latestModel.name);
        Cookies.set('selectedModel', latestModel.name, { expires: 30 });
        logger.info(`Auto-selected latest model after API key change: ${latestModel.name}`);
      }

      setIsModelLoading(undefined);
    };

    const startListening = () => {
      if (recognition) {
        recognition.start();
        setIsListening(true);
      }
    };

    const stopListening = () => {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    };

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput);
        setSelectedElement?.(null);

        if (recognition) {
          recognition.abort(); // Stop current recognition
          setTranscript(''); // Clear transcript
          setIsListening(false);

          // Clear the input by triggering handleInputChange with empty value
          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: '' },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        }
      }
    };

    const handleFileUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    // Chat content component
    const chatContent = (
      <div
        className={classNames('flex flex-col h-full w-full overflow-y-auto', {
          'px-4': chatStarted && showWorkbench, // Only add padding when in panel mode
        })}
      >
        {!chatStarted && (
          <div id="intro" className="mt-[16vh] max-w-2xl mx-auto text-center px-4 lg:px-0">
            {/* Commented out intro content - keeping div for animation purposes */}
            {/* <h1 className="text-3xl lg:text-6xl font-bold text-bolt-elements-textPrimary mb-4 animate-fade-in">
                  Where ideas begin
                </h1> */}
            {/* <p className="text-md lg:text-xl mb-8 text-bolt-elements-textSecondary animate-fade-in animation-delay-200">
                  Bring ideas to life in seconds or get help on existing projects.
                </p> */}

            {/* Add minimal content to ensure element exists for animation */}
            <div className="min-h-[1px] opacity-0"></div>
          </div>
        )}
        <StickToBottom
          className={classNames('pt-6 relative', {
            'h-full flex flex-col modern-scrollbar': chatStarted,
          })}
          resize="smooth"
          initial="smooth"
        >
          <StickToBottom.Content
            className={classNames('flex flex-col gap-4 relative', {
              'max-w-chat mx-auto': !chatStarted || !showWorkbench,
            })}
          >
            <ClientOnly>
              {() => {
                return chatStarted ? (
                  <Messages
                    className="flex flex-col w-full flex-1 pb-4 px-2 z-1"
                    messages={messages}
                    isStreaming={isStreaming}
                    append={append}
                    chatMode={chatMode}
                    setChatMode={setChatMode}
                    provider={provider}
                    model={model}
                    addToolResult={addToolResult}
                  />
                ) : null;
              }}
            </ClientOnly>
            <ScrollToBottom />
          </StickToBottom.Content>
          <div
            className={classNames('my-auto flex flex-col gap-2 w-full z-prompt mb-6 px-2', {
              'sticky bottom-2': chatStarted,
              'max-w-chat mx-auto': !chatStarted || !showWorkbench,
            })}
          >
            <div className="flex flex-col gap-2">
              {deployAlert && (
                <DeployChatAlert
                  alert={deployAlert}
                  clearAlert={() => clearDeployAlert?.()}
                  postMessage={(message: string | undefined) => {
                    sendMessage?.({} as any, message);
                    clearSupabaseAlert?.();
                  }}
                />
              )}
              {supabaseAlert && (
                <SupabaseChatAlert
                  alert={supabaseAlert}
                  clearAlert={() => clearSupabaseAlert?.()}
                  postMessage={(message) => {
                    sendMessage?.({} as any, message);
                    clearSupabaseAlert?.();
                  }}
                />
              )}
              {actionAlert && (
                <ChatAlert
                  alert={actionAlert}
                  clearAlert={() => clearAlert?.()}
                  postMessage={(message) => {
                    sendMessage?.({} as any, message);
                    clearAlert?.();
                  }}
                />
              )}
              {llmErrorAlert && <LlmErrorAlert alert={llmErrorAlert} clearAlert={() => clearLlmErrorAlert?.()} />}
            </div>
            {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
            <ChatBox
              isModelSettingsCollapsed={isModelSettingsCollapsed}
              setIsModelSettingsCollapsed={setIsModelSettingsCollapsed}
              provider={provider}
              setProvider={setProvider}
              providerList={providerList || (PROVIDER_LIST as ProviderInfo[])}
              model={model}
              setModel={setModel}
              modelList={modelList}
              apiKeys={apiKeys}
              isModelLoading={isModelLoading}
              onApiKeysChange={onApiKeysChange}
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              imageDataList={imageDataList}
              setImageDataList={setImageDataList}
              textareaRef={textareaRef}
              input={input}
              handleInputChange={handleInputChange}
              handlePaste={handlePaste}
              TEXTAREA_MIN_HEIGHT={TEXTAREA_MIN_HEIGHT}
              TEXTAREA_MAX_HEIGHT={TEXTAREA_MAX_HEIGHT}
              isStreaming={isStreaming}
              handleStop={handleStop}
              handleSendMessage={handleSendMessage}
              enhancingPrompt={enhancingPrompt}
              enhancePrompt={enhancePrompt}
              isListening={isListening}
              startListening={startListening}
              stopListening={stopListening}
              chatStarted={chatStarted}
              exportChat={exportChat}
              qrModalOpen={qrModalOpen}
              setQrModalOpen={setQrModalOpen}
              handleFileUpload={handleFileUpload}
              chatMode={chatMode}
              setChatMode={setChatMode}
              designScheme={designScheme}
              setDesignScheme={setDesignScheme}
              selectedElement={selectedElement}
              setSelectedElement={setSelectedElement}
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
            />
          </div>
        </StickToBottom>
        <div className="flex flex-col justify-center">
          {!chatStarted && (
            <div className="flex justify-center gap-2">
              {ImportButtons(importChat)}
              {/* <GitCloneButton importChat={importChat} /> */}
            </div>
          )}
          {/* <div className="flex flex-col gap-5">
                {!chatStarted &&
                  ExamplePrompts((event, messageInput) => {
                    if (isStreaming) {
                      handleStop?.();
                      return;
                    }

                    handleSendMessage?.(event, messageInput);
                  })}
                {!chatStarted && <StarterTemplates />}
              </div> */}

          {/* Commented out examples section - keeping this comment for reference */}
          {/*
              {!chatStarted && (
                <div id="examples">
                  {ExamplePrompts((event, messageInput) => {
                    if (isStreaming) {
                      handleStop?.();
                      return;
                    }
                    handleSendMessage?.(event, messageInput);
                  })}
                </div>
              )}
              */}
        </div>
      </div>
    );

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>

        {/* Use PanelGroup only when workbench is visible */}
        {chatStarted && showWorkbench ? (
          <PanelGroup direction="horizontal" className="w-full h-full" key={`panel-group-${showChat}`}>
            <Panel
              defaultSize={showChat ? 35 : 0}
              minSize={showChat ? 25 : 0}
              maxSize={showChat ? 75 : 0}
              collapsible={true}
              collapsedSize={0}
              className={classNames(styles.Chat, 'flex flex-col h-full w-full', {
                hidden: !showChat,
              })}
            >
              {chatContent}
            </Panel>

            {showChat && (
              <PanelResizeHandle className="w-1.5 bg-bolt-elements-borderColor hover:bg-bolt-elements-borderColorActive transition-colors hover:w-2" />
            )}

            <Panel defaultSize={showChat ? 65 : 100} minSize={25} maxSize={showChat ? 75 : 100} className="h-full">
              <ClientOnly>
                {() => (
                  <Workbench
                    chatStarted={chatStarted}
                    isStreaming={isStreaming}
                    setSelectedElement={setSelectedElement}
                    selectedTemplate={selectedTemplate}
                    onSendMessage={(message: string) => {
                      if (sendMessage) {
                        sendMessage({} as React.UIEvent, message);
                      }
                    }}
                    onSetChatInput={(message: string) => {
                      if (setInput) {
                        setInput(message);
                      }
                    }}
                  />
                )}
              </ClientOnly>
            </Panel>
          </PanelGroup>
        ) : (
          <>
            {/* Centered chat when workbench is not visible */}
            <div className={classNames(styles.Chat, 'flex flex-col h-full w-full max-w-chat mx-auto')}>
              {chatContent}
            </div>
          </>
        )}

        {!chatStarted && (
          <ClientOnly>
            {() => (
              <Workbench
                chatStarted={chatStarted}
                isStreaming={isStreaming}
                setSelectedElement={setSelectedElement}
                selectedTemplate={selectedTemplate}
                onSendMessage={(message: string) => {
                  if (sendMessage) {
                    sendMessage({} as React.UIEvent, message);
                  }
                }}
                onSetChatInput={(message: string) => {
                  if (setInput) {
                    setInput(message);
                  }
                }}
              />
            )}
          </ClientOnly>
        )}
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);

function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <>
        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-bolt-elements-background-depth-1 to-transparent h-20 z-10" />
        <button
          className="sticky z-50 bottom-0 left-0 right-0 text-4xl rounded-lg px-1.5 py-0.5 flex items-center justify-center mx-auto gap-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
          onClick={() => scrollToBottom()}
        >
          Go to last message
          <span className="i-ph:arrow-down animate-bounce" />
        </button>
      </>
    )
  );
}
