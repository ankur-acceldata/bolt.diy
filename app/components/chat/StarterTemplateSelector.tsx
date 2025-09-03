import React, { useState, useEffect } from 'react';
import { classNames } from '~/utils/classNames';
import sparkTemplates from '~/data/templates.json';

interface SparkTemplate {
  id: string;
  name: string;
  selected?: boolean;
  disabled?: boolean;
}

interface SparkTemplateSelectorProps {
  onTemplateSelect: (template: SparkTemplate) => void;
  selectedTemplate?: SparkTemplate | null;
}

export const StarterTemplateSelector: React.FC<SparkTemplateSelectorProps> = ({
  onTemplateSelect,
  selectedTemplate,
}) => {
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  // Auto-select the last template with selected: true on mount
  useEffect(() => {
    const templatesWithSelected = sparkTemplates.filter((template) => template.selected);

    if (templatesWithSelected.length > 0 && !selectedTemplate) {
      const lastSelectedTemplate = templatesWithSelected[templatesWithSelected.length - 1];
      onTemplateSelect(lastSelectedTemplate);
    }
  }, [onTemplateSelect, selectedTemplate]);

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-2">Choose a Template</h2>
        <p className="text-sm text-bolt-elements-textSecondary">Select a template to start building your application</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
        {sparkTemplates.map((template) => {
          const isSelected = selectedTemplate?.id === template.id;
          const isHovered = hoveredTemplate === template.id;
          const isDisabled = template.disabled || template.id === 'java-application';

          return (
            <div
              key={template.id}
              className={classNames(
                'relative group transition-all duration-200',
                'bg-bolt-elements-background-depth-2 border',
                'rounded-lg h-10 px-4 py-2 min-w-[120px]',
                'flex items-center justify-center',
                {
                  'cursor-pointer hover:bg-bolt-elements-background-depth-2': !isDisabled,
                  'cursor-not-allowed opacity-60': isDisabled,
                  'border-[rgba(80,140,255,0.8)] ring-2 ring-[rgba(80,140,255,0.2)]':
                    !isDisabled && (isSelected || isHovered),
                  'border-bolt-elements-borderColor': !isSelected && !isHovered,
                },
              )}
              onClick={() => {
                if (!isDisabled) {
                  console.log('Template clicked:', template);
                  onTemplateSelect(template);
                }
              }}
              onMouseEnter={() => !isDisabled && setHoveredTemplate(template.id)}
              onMouseLeave={() => setHoveredTemplate(null)}
              title={isDisabled ? 'Coming Soon' : undefined}
            >
              {isDisabled && (
                <div className="absolute -top-1 -right-3 bg-bolt-elements-item-contentAccent text-white text-xs px-1 py-0.5 rounded text-[10px] leading-none">
                  Coming Soon
                </div>
              )}
              <div className="text-center">
                <h3
                  className={classNames(
                    'text-sm font-medium',
                    isDisabled ? 'text-bolt-elements-textTertiary' : 'text-bolt-elements-textPrimary',
                  )}
                >
                  {template.name}
                </h3>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
