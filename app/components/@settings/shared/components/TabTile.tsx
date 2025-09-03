import * as Tooltip from '@radix-ui/react-tooltip';
import { classNames } from '~/utils/classNames';
import type { TabVisibilityConfig } from '~/components/@settings/core/types';
import { TAB_LABELS, TAB_ICONS } from '~/components/@settings/core/constants';
import { GlowingEffect } from '~/components/ui/GlowingEffect';

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
          <div className={classNames('min-h-[160px] list-none', className || '')}>
            <div className="relative h-full rounded-xl border p-0.5 border-bolt-elements-borderColor">
              <GlowingEffect
                blur={0}
                borderWidth={1}
                spread={20}
                glow={true}
                disabled={false}
                proximity={40}
                inactiveZone={0.3}
                movementDuration={0.4}
              />
              <div
                onClick={onClick}
                className={classNames(
                  'relative flex flex-col items-center justify-center h-full p-4 rounded-lg',
                  'bg-bolt-elements-background-depth-1',
                  'group cursor-pointer',
                  'hover:bg-bolt-elements-item-backgroundAccent',
                  'transition-colors duration-100 ease-out',
                  isActive ? 'bg-bolt-elements-item-backgroundAccent' : '',
                  isLoading ? 'cursor-wait opacity-70 pointer-events-none' : '',
                )}
              >
                {/* Icon */}
                <div
                  className={classNames(
                    'relative',
                    'w-14 h-14',
                    'flex items-center justify-center',
                    'rounded-xl',
                    'bg-bolt-elements-background-depth-2',
                    'ring-1 ring-bolt-elements-borderColor',
                    'group-hover:bg-bolt-elements-item-backgroundAccent dark:group-hover:bg-gray-700/80',
                    'group-hover:ring-bolt-elements-borderColorActive/30',
                    isActive ? 'bg-bolt-elements-item-backgroundAccent ring-bolt-elements-borderColorActive/30' : '',
                  )}
                >
                  <div
                    className={classNames(
                      TAB_ICONS[tab.id],
                      'w-8 h-8',
                      'text-bolt-elements-textSecondary',
                      'group-hover:text-bolt-elements-item-contentAccent dark:opacity-80',
                      isActive ? 'text-bolt-elements-item-contentAccent dark:opacity-90' : '',
                    )}
                  />
                </div>

                {/* Label and Description */}
                <div className="flex flex-col items-center mt-4 w-full">
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

                {/* Children (e.g. Beta Label) */}
                {children}
              </div>

              {/* Update Indicator with Tooltip */}
              {hasUpdate && (
                <>
                  <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-bolt-elements-item-contentAccent animate-pulse" />
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
            </div>
          </div>
        </Tooltip.Trigger>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
