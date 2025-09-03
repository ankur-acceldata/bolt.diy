import { useStore } from '@nanostores/react';
import { memo, useEffect, useState } from 'react';
import { themeStore, toggleTheme, setColorTheme, type ColorTheme } from '~/lib/stores/theme';
import { IconButton } from './IconButton';

interface ThemeSwitchProps {
  className?: string;
}

interface ColorThemeOption {
  key: ColorTheme;
  label: string;
  description: string;
  lightColor: string;
  darkColor: string;
  icon: string;
}

const colorThemes: ColorThemeOption[] = [
  {
    key: 'default',
    label: 'Default',
    description: 'Original bolt.diy theme',
    lightColor: '#15C5BC',
    darkColor: '#15C5BC',
    icon: 'i-ph:circle',
  },
  {
    key: 'blue',
    label: 'Acceldata Blue',
    description: 'Professional blue theme',
    lightColor: '#2f6af9',
    darkColor: '#588eff',
    icon: 'i-ph:circle-fill',
  },
  {
    key: 'green',
    label: 'Forest Green',
    description: 'Natural green theme',
    lightColor: '#10b981',
    darkColor: '#34d399',
    icon: 'i-ph:circle-fill',
  },
  {
    key: 'purple',
    label: 'Royal Purple',
    description: 'Creative purple theme',
    lightColor: '#8b5cf6',
    darkColor: '#a78bfa',
    icon: 'i-ph:circle-fill',
  },
  {
    key: 'orange',
    label: 'Sunset Orange',
    description: 'Warm orange theme',
    lightColor: '#ea580c',
    darkColor: '#fb923c',
    icon: 'i-ph:circle-fill',
  },
];

export const ThemeSwitch = memo(({ className }: ThemeSwitchProps) => {
  const theme = useStore(themeStore);
  const [domLoaded, setDomLoaded] = useState(false);

  useEffect(() => {
    setDomLoaded(true);
  }, []);

  const handleColorThemeChange = (colorTheme: ColorTheme) => {
    setColorTheme(colorTheme);
  };

  const currentColorTheme = colorThemes.find((ct) => ct.key === theme.color) || colorThemes[0];

  if (!domLoaded) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Mode Toggle Button */}
      <IconButton
        className={className}
        icon={theme.mode === 'dark' ? 'i-ph:sun' : 'i-ph:moon'}
        size="xl"
        title="Toggle Light/Dark Mode"
        onClick={toggleTheme}
      />

      {/* Simple Color Theme Button for now */}
      <IconButton
        className={className}
        title="Change Color Theme"
        size="xl"
        onClick={() => {
          // Cycle through color themes for testing
          const themes: ColorTheme[] = ['default', 'blue', 'green', 'purple', 'orange'];
          const currentIndex = themes.indexOf(theme.color);
          const nextIndex = (currentIndex + 1) % themes.length;
          handleColorThemeChange(themes[nextIndex]);
        }}
      >
        <div
          className="w-4 h-4 rounded-full border-2 border-bolt-elements-borderColor"
          style={{
            backgroundColor: theme.mode === 'dark' ? currentColorTheme.darkColor : currentColorTheme.lightColor,
          }}
        />
      </IconButton>
    </div>
  );
});

ThemeSwitch.displayName = 'ThemeSwitch';
