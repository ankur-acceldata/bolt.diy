import { memo, useState, useRef, useEffect } from 'react';
import { Button, type ButtonProps } from './Button';
import { Dropdown, DropdownItem } from './Dropdown';
import { classNames } from '~/utils/classNames';

interface DropdownOption {
  label: string;
  value: string;
  icon?: string;
  disabled?: boolean;
  onClick: () => void;
}

interface ButtonDropdownProps extends Omit<ButtonProps, 'onClick'> {
  /**
   * The main button content
   */
  children: React.ReactNode;

  /**
   * Array of dropdown options
   */
  options: DropdownOption[];

  /**
   * Callback for the main button click
   */
  onMainClick?: () => void;

  /**
   * Whether to show the dropdown arrow
   */
  showArrow?: boolean;

  /**
   * Position of the dropdown relative to the trigger
   */
  align?: 'start' | 'center' | 'end';

  /**
   * Additional className for the dropdown trigger
   */
  dropdownTriggerClassName?: string;
}

export const ButtonDropdown = memo<ButtonDropdownProps>(
  ({
    children,
    options,
    onMainClick,
    showArrow = true,
    align = 'end',
    dropdownTriggerClassName,
    className,
    disabled,
    variant = 'outline',
    size = 'sm',
    ...buttonProps
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDropdownToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsOpen(!isOpen);
    };

    const handleOptionClick = (option: DropdownOption) => {
      if (!option.disabled) {
        option.onClick();
        setIsOpen(false);
      }
    };

    return (
      <div ref={dropdownRef} className="relative inline-flex">
        {/* Main Button */}
        <Button
          {...buttonProps}
          variant={variant}
          size={size}
          className={classNames(
            'rounded-r-none !border-r-0 -mr-px',
            {
              // Enhanced background for accent variant
              'bg-bolt-elements-button-primary-backgroundHover hover:bg-bolt-elements-button-primary-backgroundHover hover:opacity-90':
                variant === 'accent',
            },
            className,
          )}
          disabled={disabled}
          onClick={onMainClick}
        >
          {children}
        </Button>

        {/* Dropdown Trigger */}
        <Dropdown
          align={align}
          trigger={
            <Button
              variant={variant}
              size={size}
              className={classNames(
                'rounded-l-none px-1.5 min-w-0 border-l border-l-bolt-elements-borderColor',
                'focus:ring-0 focus:ring-offset-0 focus:outline-none',
                'transition-colors',
                {
                  // Enhanced background for accent variant
                  'bg-bolt-elements-button-primary-backgroundHover hover:bg-bolt-elements-button-primary-backgroundHover hover:opacity-90':
                    variant === 'accent',
                },
                dropdownTriggerClassName,
              )}
              disabled={disabled}
              onClick={handleDropdownToggle}
              aria-haspopup="true"
              aria-expanded={isOpen}
            >
              {showArrow && (
                <div
                  className={classNames(
                    'i-ph:caret-down w-4 h-4 text-bolt-elements-item-contentAccent transition-transform',
                    isOpen ? 'rotate-180' : '',
                  )}
                />
              )}
            </Button>
          }
        >
          {options.map((option, index) => (
            <DropdownItem
              key={option.value || index}
              className={classNames(
                'flex items-center gap-2',
                option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                'hover:bg-bolt-elements-item-backgroundAccent hover:text-bolt-elements-item-contentAccent transition-colors',
              )}
              onSelect={option.disabled ? undefined : () => handleOptionClick(option)}
            >
              {option.icon && (
                <div className={classNames(option.icon, 'w-4 h-4 text-bolt-elements-button-primary-text')} />
              )}
              <span>{option.label}</span>
            </DropdownItem>
          ))}
        </Dropdown>
      </div>
    );
  },
);

ButtonDropdown.displayName = 'ButtonDropdown';
