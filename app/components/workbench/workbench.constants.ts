import type { SliderOptions } from '~/components/ui/Slider';
import type { WorkbenchViewType } from '~/lib/stores/workbench';
import { cubicEasingFn } from '~/utils/easings';
import type { Variants } from 'framer-motion';

export const viewTransition = { ease: cubicEasingFn };

export const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: 'Code',
  },
  right: {
    value: 'diff',
    text: 'Diff',
  },

  /*
   * right: {
   *   value: 'preview',
   *   text: 'Preview',
   * },
   */
};

export const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;
