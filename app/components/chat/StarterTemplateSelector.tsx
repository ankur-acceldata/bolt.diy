import React, { useState } from 'react';
import { classNames } from '~/utils/classNames';
import sparkTemplates from '~/data/templates.json';

interface SparkTemplate {
  id: string;
  name: string;
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

          return (
            <div
              key={template.id}
              className={classNames(
                'relative cursor-pointer group transition-all duration-200',
                'bg-bolt-elements-background-depth-2 border',
                'rounded-lg h-10 px-4 py-2 min-w-[120px]',
                'hover:bg-bolt-elements-background-depth-2',
                'flex items-center justify-center',
                {
                  'border-[rgba(80,140,255,0.8)] ring-2 ring-[rgba(80,140,255,0.2)]': isSelected || isHovered,
                  'border-bolt-elements-borderColor': !isSelected && !isHovered,
                },
              )}
              onClick={() => {
                console.log('Template clicked:', template);
                onTemplateSelect({ id: template.id, name: template.name });
              }}
              onMouseEnter={() => setHoveredTemplate(template.id)}
              onMouseLeave={() => setHoveredTemplate(null)}
            >
              <div className="text-center">
                <h3 className="text-sm font-medium text-bolt-elements-textPrimary">{template.name}</h3>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
