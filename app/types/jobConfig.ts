/**
 * Job Configuration types from XDP
 */
export interface JobConfig {
  baseImage: string;
  dataplaneName: string;
  dataplaneId: string;
  stages: string[];
  depends: {
    dataStores: Array<{
      dataStoreId: number;
    }>;
  };
  executionConfig: {
    imagePullSecrets: string[];
    imagePullPolicy: string;
    dynamicAllocation: {
      enabled: boolean;
      initialExecutors: number;
      minExecutors: number;
      maxExecutors: number;
      shuffleTrackingTimeout: number;
    };
    driver: {
      cores: number;
      memory: string;
      memoryOverhead: string;
    };
    executor: {
      cores: number;
      memory: string;
      memoryOverhead: string;
    };
    sparkConfig: Record<string, any>;
  };
}

export interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
  metadata?: {
    gitUrl?: string;
  };
  updateChatMestaData?: (metadata: any) => void;
  setSelectedElement?: (element: any | null) => void; // Using any for now since ElementInfo is internal
  selectedTemplate?: {
    id: string;
    name: string;
  };
  onSendMessage?: (message: string) => void;
  onSetChatInput?: (message: string) => void;
  model?: string;
  provider?: string;
}
