import { motion } from 'framer-motion';

import * as Tooltip from '@radix-ui/react-tooltip';
import { classNames } from '~/utils/classNames';
import type { TabVisibilityConfig } from '~/components/@settings/core/types';
import { TAB_LABELS, TAB_ICONS } from '~/components/@settings/core/constants';

// import { GlowingEffect } from '~/components/ui/GlowingEffect';

interface TabTileProps {
  tab: TabVisibilityConfig;
  onClick?: () => void;
  isActive?: boolean;
  hasUpdate?: boolean;
  statusMessage?: string;
  description?: string;
  isLoading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const TabTile: React.FC<TabTileProps> = ({
  tab,
  onClick,
  isActive,
  hasUpdate,
  statusMessage,
  description,
  isLoading,
  className,
  children,
}: TabTileProps) => {
  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <motion.div
            onClick={onClick}
            className={classNames(
              'relative flex flex-col items-center p-6 rounded-xl',
              'w-full h-full min-h-[160px]',
              'bg-bolt-elements-background-depth-1',
              'border border-bolt-elements-borderColor',
              'group',
              'hover:bg-bolt-elements-item-backgroundAccent',
              'hover:border-bolt-elements-borderColorActive/30',
              isActive
                ? 'border-bolt-elements-borderColorActive dark:border-bolt-elements-borderColorActive/50 bg-bolt-elements-item-backgroundAccent'
                : '',
              isLoading ? 'cursor-wait opacity-70' : '',
              className || '',
            )}
          >
            {/* Main Content */}
            <div className="flex flex-col items-center justify-center flex-1 w-full">
              {/* Icon */}
              <motion.div
                className={classNames(
                  'relative',
                  'w-14 h-14',
                  'flex items-center justify-center',
                  'rounded-xl',
                  'bg-bolt-elements-background-depth-2',
                  'ring-1 ring-bolt-elements-borderColor',
                  'group-hover:bg-bolt-elements-item-backgroundAccent dark:group-hover:bg-gray-700/80',
                  'group-hover:ring-bolt-elements-borderColorActive/30',
                  isActive
                    ? 'bg-bolt-elements-item-backgroundAccent dark:bg-bolt-elements-item-backgroundAccent ring-bolt-elements-borderColorActive/30'
                    : '',
                )}
              >
                <motion.div
                  className={classNames(
                    TAB_ICONS[tab.id],
                    'w-8 h-8',
                    'text-bolt-elements-textSecondary',
                    'group-hover:text-bolt-elements-item-contentAccent dark:opacity-80',
                    isActive
                      ? 'text-bolt-elements-item-contentAccent dark:text-bolt-elements-item-contentAccent dark:opacity-90'
                      : '',
                  )}
                />
              </motion.div>

              {/* Label and Description */}
              <div className="flex flex-col items-center mt-5 w-full">
                <h3
                  className={classNames(
                    'text-[15px] font-medium leading-snug mb-2',
                    'text-bolt-elements-textPrimary',
                    'group-hover:text-bolt-elements-item-contentAccent dark:opacity-90',
                    isActive ? 'text-bolt-elements-item-contentAccent dark:opacity-90' : '',
                  )}
                >
                  {TAB_LABELS[tab.id]}
                </h3>
                {description && (
                  <p
                    className={classNames(
                      'text-[13px] leading-relaxed',
                      'text-bolt-elements-textTertiary',
                      'max-w-[85%]',
                      'text-center',
                      'group-hover:text-bolt-elements-item-contentAccent dark:opacity-70',
                      isActive ? 'text-bolt-elements-item-contentAccent dark:opacity-80' : '',
                    )}
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>

            {/* Update Indicator with Tooltip */}
            {hasUpdate && (
              <>
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-bolt-elements-item-contentAccent dark:bg-bolt-elements-item-contentAccent animate-pulse" />
                <Tooltip.Portal>
                  <Tooltip.Content
                    className={classNames(
                      'px-3 py-1.5 rounded-lg',
                      'bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary',
                      'text-sm font-medium',
                      'select-none',
                      'z-[100]',
                    )}
                    side="top"
                    sideOffset={5}
                  >
                    {statusMessage}
                    <Tooltip.Arrow className="fill-bolt-elements-background-depth-3" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </>
            )}

            {/* Children (e.g. Beta Label) */}
            {children}
          </motion.div>
        </Tooltip.Trigger>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
