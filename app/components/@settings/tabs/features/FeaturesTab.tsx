// Remove unused imports
import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Switch } from '~/components/ui/Switch';
import { useSettings } from '~/lib/hooks/useSettings';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { PromptLibrary } from '~/lib/common/prompt-library';

interface FeatureToggle {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  beta?: boolean;
  experimental?: boolean;
  tooltip?: string;
}

const FeatureCard = memo(
  ({
    feature,
    index,
    onToggle,
  }: {
    feature: FeatureToggle;
    index: number;
    onToggle: (id: string, enabled: boolean) => void;
  }) => (
    <motion.div
      key={feature.id}
      layoutId={feature.id}
      className={classNames(
        'relative group cursor-pointer',
        'bg-bolt-elements-background-depth-2',
        'hover:bg-bolt-elements-background-depth-3',
        'transition-colors duration-200',
        'rounded-lg overflow-hidden',
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={classNames(feature.icon, 'w-5 h-5 text-bolt-elements-textSecondary')} />
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-bolt-elements-textPrimary">{feature.title}</h4>
              {feature.beta && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500 font-medium">Beta</span>
              )}
              {feature.experimental && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/10 text-orange-500 font-medium">
                  Experimental
                </span>
              )}
            </div>
          </div>
          <Switch checked={feature.enabled} onCheckedChange={(checked) => onToggle(feature.id, checked)} />
        </div>
        <p className="mt-2 text-sm text-bolt-elements-textSecondary">{feature.description}</p>
        {feature.tooltip && <p className="mt-1 text-xs text-bolt-elements-textTertiary">{feature.tooltip}</p>}
      </div>
    </motion.div>
  ),
);

const FeatureSection = memo(
  ({
    title,
    features,
    icon,
    description,
    onToggleFeature,
  }: {
    title: string;
    features: FeatureToggle[];
    icon: string;
    description: string;
    onToggleFeature: (id: string, enabled: boolean) => void;
  }) => (
    <motion.div
      layout
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <div className={classNames(icon, 'text-xl text-purple-500')} />
        <div>
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">{title}</h3>
          <p className="text-sm text-bolt-elements-textSecondary">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature, index) => (
          <FeatureCard key={feature.id} feature={feature} index={index} onToggle={onToggleFeature} />
        ))}
      </div>
    </motion.div>
  ),
);

export default function FeaturesTab() {
  const {
    autoSelectTemplate,
    isLatestBranch,
    contextOptimizationEnabled,
    eventLogs,
    syncEnabled,
    syncAutoSync,
    syncInterval,
    syncRemoteUrl,
    setAutoSelectTemplate,
    enableLatestBranch,
    enableContextOptimization,
    setEventLogs,
    setSyncEnabled,
    setSyncAutoSync,
    setSyncInterval,
    setSyncRemoteUrl,
    setPromptId,
    promptId,
  } = useSettings();

  // Enable features by default on first load
  React.useEffect(() => {
    // Only set defaults if values are undefined
    if (isLatestBranch === undefined) {
      enableLatestBranch(false); // Default: OFF - Don't auto-update from main branch
    }

    if (contextOptimizationEnabled === undefined) {
      enableContextOptimization(true); // Default: ON - Enable context optimization
    }

    if (autoSelectTemplate === undefined) {
      setAutoSelectTemplate(true); // Default: ON - Enable auto-select templates
    }

    if (promptId === undefined) {
      setPromptId('default'); // Default: 'default'
    }

    if (eventLogs === undefined) {
      setEventLogs(true); // Default: ON - Enable event logging
    }
  }, []); // Only run once on component mount

  const handleToggleFeature = useCallback(
    (id: string, enabled: boolean) => {
      switch (id) {
        case 'latestBranch': {
          enableLatestBranch(enabled);
          toast.success(`Main branch updates ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'autoSelectTemplate': {
          setAutoSelectTemplate(enabled);
          toast.success(`Auto select template ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'contextOptimization': {
          enableContextOptimization(enabled);
          toast.success(`Context optimization ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'eventLogs': {
          setEventLogs(enabled);
          toast.success(`Event logging ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'syncEnabled': {
          setSyncEnabled(enabled);
          toast.success(`File sync ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'syncAutoSync': {
          setSyncAutoSync(enabled);
          toast.success(`Auto sync ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        default:
          break;
      }
    },
    [
      enableLatestBranch,
      setAutoSelectTemplate,
      enableContextOptimization,
      setEventLogs,
      setSyncEnabled,
      setSyncAutoSync,
    ],
  );

  const features = {
    stable: [
      {
        id: 'latestBranch',
        title: 'Main Branch Updates',
        description: 'Get the latest updates from the main branch',
        icon: 'i-ph:git-branch',
        enabled: isLatestBranch,
        tooltip: 'Enabled by default to receive updates from the main development branch',
      },
      {
        id: 'autoSelectTemplate',
        title: 'Auto Select Template',
        description: 'Automatically select starter template',
        icon: 'i-ph:selection',
        enabled: autoSelectTemplate,
        tooltip: 'Enabled by default to automatically select the most appropriate starter template',
      },
      {
        id: 'contextOptimization',
        title: 'Context Optimization',
        description: 'Optimize context for better responses',
        icon: 'i-ph:brain',
        enabled: contextOptimizationEnabled,
        tooltip: 'Enabled by default for improved AI responses',
      },
      {
        id: 'eventLogs',
        title: 'Event Logging',
        description: 'Enable detailed event logging and history',
        icon: 'i-ph:list-bullets',
        enabled: eventLogs,
        tooltip: 'Enabled by default to record detailed logs of system events and user actions',
      },
    ],
    beta: [
      {
        id: 'syncEnabled',
        title: 'File Sync',
        description: 'Enable real-time file synchronization',
        icon: 'i-ph:cloud-arrow-up',
        enabled: syncEnabled,
        beta: true,
        tooltip: 'Beta feature: Sync files with remote servers or other clients',
      },
      {
        id: 'syncAutoSync',
        title: 'Auto Sync',
        description: 'Automatically sync changes as you work',
        icon: 'i-ph:arrows-clockwise',
        enabled: syncAutoSync,
        beta: true,
        tooltip: 'When enabled, changes are automatically synchronized without manual intervention',
      },
    ],
  };

  return (
    <div className="flex flex-col gap-8">
      <FeatureSection
        title="Core Features"
        features={features.stable}
        icon="i-ph:check-circle"
        description="Essential features that are enabled by default for optimal performance"
        onToggleFeature={handleToggleFeature}
      />

      {features.beta.length > 0 && (
        <FeatureSection
          title="Beta Features"
          features={features.beta}
          icon="i-ph:test-tube"
          description="New features that are ready for testing but may have some rough edges"
          onToggleFeature={handleToggleFeature}
        />
      )}

      <motion.div
        layout
        className={classNames(
          'bg-bolt-elements-background-depth-2',
          'hover:bg-bolt-elements-background-depth-3',
          'transition-all duration-200',
          'rounded-lg p-4',
          'group',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <div
            className={classNames(
              'p-2 rounded-lg text-xl',
              'bg-bolt-elements-background-depth-3 group-hover:bg-bolt-elements-background-depth-4',
              'transition-colors duration-200',
              'text-purple-500',
            )}
          >
            <div className="i-ph:book" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-bolt-elements-textPrimary group-hover:text-purple-500 transition-colors">
              Prompt Library
            </h4>
            <p className="text-xs text-bolt-elements-textSecondary mt-0.5">
              Choose a prompt from the library to use as the system prompt
            </p>
          </div>
          <select
            value={promptId}
            onChange={(e) => {
              setPromptId(e.target.value);
              toast.success('Prompt template updated');
            }}
            className={classNames(
              'p-2 rounded-lg text-sm min-w-[200px]',
              'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary',
              'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
              'group-hover:border-purple-500/30',
              'transition-all duration-200',
            )}
          >
            {PromptLibrary.getList().map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Sync Configuration */}
      {syncEnabled && (
        <motion.div
          layout
          className={classNames(
            'bg-bolt-elements-background-depth-2',
            'hover:bg-bolt-elements-background-depth-3',
            'transition-all duration-200',
            'rounded-lg p-4',
            'group',
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div
              className={classNames(
                'p-2 rounded-lg text-xl',
                'bg-bolt-elements-background-depth-3 group-hover:bg-bolt-elements-background-depth-4',
                'transition-colors duration-200',
                'text-blue-500',
              )}
            >
              <div className="i-ph:cloud-arrow-up" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary group-hover:text-blue-500 transition-colors">
                Sync Configuration
              </h4>
              <p className="text-xs text-bolt-elements-textSecondary mt-0.5">
                Configure how file synchronization works
              </p>
            </div>
          </div>

          {/* Info about Golang API integration */}
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="i-ph:info text-blue-500" />
              <p className="text-xs text-blue-600">
                <strong>Golang API Integration:</strong> Files are automatically synchronized with your Golang server
                and Minio storage. Auto-save functionality is enabled for real-time file synchronization.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                Auto-save Interval (milliseconds)
              </label>
              <input
                type="number"
                value={syncInterval}
                onChange={(e) => {
                  const interval = parseInt(e.target.value, 10);

                  if (!isNaN(interval) && interval >= 1000) {
                    setSyncInterval(interval);
                  }
                }}
                min="1000"
                step="1000"
                className={classNames(
                  'w-full p-2 rounded-lg text-sm',
                  'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                  'transition-all duration-200',
                )}
              />
              <p className="text-xs text-bolt-elements-textTertiary mt-1">
                How often to auto-save and sync files (minimum 1000ms, recommended: 5000ms)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                Golang API Server URL
              </label>
              <input
                type="text"
                value={syncRemoteUrl || '/api/fern-fs'}
                onChange={(e) => setSyncRemoteUrl(e.target.value)}
                placeholder="/api/fern-fs"
                className={classNames(
                  'w-full p-2 rounded-lg text-sm',
                  'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                  'transition-all duration-200',
                )}
              />
              <p className="text-xs text-bolt-elements-textTertiary mt-1">
                Direct URL to your Golang API server with Minio backend (default: http://localhost:8080/api)
              </p>
            </div>

            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="i-ph:check-circle text-green-500" />
                <span className="text-sm font-medium text-green-600">Auto-save Features</span>
              </div>
              <ul className="text-xs text-green-600 space-y-1">
                <li>• Files are automatically saved 2 seconds after editing stops</li>
                <li>• Real-time sync with Golang API and Minio storage</li>
                <li>• WebSocket connection for instant file updates</li>
                <li>• No browser permissions required</li>
                <li>• Background synchronization with visual feedback</li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
