# 🎨 Semantic Theme System Guide

## Overview

The new semantic theme system allows you to create complete themes by defining just **19 core semantic colors**. All 100+ bolt-elements variables are automatically generated from these base colors using intelligent mapping.

## 🚀 Quick Start: Adding a New Theme

### Step 1: Define Your Semantic Colors

Instead of manually defining 100+ variables, you only need these 19 colors:

```scss
$background: #ffffff,           // Main background color
$foreground: #0f3d30,          // Main text color
$card: #ffffff,                // Card/panel backgrounds
$card-foreground: #0f3d30,     // Text on cards
$popover: #ffffff,             // Dropdown/popup backgrounds
$popover-foreground: #0f3d30,  // Text on dropdowns
$primary: #10b981,             // Primary action color (buttons, links)
$primary-foreground: #ffffff,  // Text on primary elements
$secondary: #ecfdf5,           // Secondary element backgrounds
$secondary-foreground: #10b981, // Text on secondary elements
$muted: #f0fdf9,               // Subtle backgrounds (less prominent)
$muted-foreground: #4b7a6d,    // Subtle text (less prominent)
$accent: #e8fal3,              // Accent highlights
$accent-foreground: #10b981,   // Text on accent elements
$destructive: #ef4444,         // Error/danger color
$destructive-foreground: #ffffff, // Text on error elements
$border: #d1e9e3,              // Border colors
$input: #d1e9e3,               // Form input borders
$ring: #a7d7c5                 // Focus ring colors
```

### Step 2: Update the Theme Store

**File**: `app/lib/stores/theme.ts`

```typescript
export type ColorTheme = 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'forest'; // Add your theme
```

### Step 3: Add to ThemeSwitch

**File**: `app/components/ui/ThemeSwitch.tsx`

```typescript
const colorThemes: ColorThemeOption[] = [
  // ... existing themes ...
  {
    key: 'forest',
    label: 'Forest Green',
    description: 'Natural forest theme',
    lightColor: '#10b981',
    darkColor: '#34d399',
    icon: 'i-ph:circle-fill',
  },
];
```

### Step 4: Define Your Theme in CSS

**File**: `app/styles/variables.scss` (or create a new theme file)

```scss
/* Import the mixin from semantic-themes.scss if needed */
@import 'semantic-themes';

/* Forest Theme - Light Mode */
:root.color-forest {
  @include generate-theme-variables(
    $background: #ffffff,
    $foreground: #0f3d30,
    $card: #ffffff,
    $card-foreground: #0f3d30,
    $popover: #ffffff,
    $popover-foreground: #0f3d30,
    $primary: #10b981,
    $primary-foreground: #ffffff,
    $secondary: #ecfdf5,
    $secondary-foreground: #10b981,
    $muted: #f0fdf9,
    $muted-foreground: #4b7a6d,
    $accent: #e8fal3,
    $accent-foreground: #10b981,
    $destructive: #ef4444,
    $destructive-foreground: #ffffff,
    $border: #d1e9e3,
    $input: #d1e9e3,
    $ring: #a7d7c5
  );
}

/* Forest Theme - Dark Mode */
:root[data-theme='dark'].color-forest {
  @include generate-theme-variables(
    $background: #0f1b17,
    $foreground: #ecfdf5,
    $card: #1a2e23,
    $card-foreground: #ecfdf5,
    $popover: #1a2e23,
    $popover-foreground: #ecfdf5,
    $primary: #34d399,
    $primary-foreground: #064e3b,
    $secondary: #1a2e23,
    $secondary-foreground: #34d399,
    $muted: #253d2f,
    $muted-foreground: #a7d7c5,
    $accent: #2a4a37,
    $accent-foreground: #34d399,
    $destructive: #f87171,
    $destructive-foreground: #ffffff,
    $border: #374151,
    $input: #374151,
    $ring: #34d399
  );
}
```

## 🎯 Color Mapping Logic

The mixin automatically maps your semantic colors to bolt-elements variables:

| Semantic Color | Maps To | Purpose |
|---------------|---------|---------|
| `background` | `--bolt-elements-bg-depth-1` | Main app background |
| `muted` | `--bolt-elements-bg-depth-2` | Cards, panels |
| `secondary` | `--bolt-elements-bg-depth-3` | Secondary elements |
| `accent` | `--bolt-elements-bg-depth-4` | Highlights, active states |
| `primary` | `--bolt-elements-borderColorActive` | Active borders, primary actions |
| `border` | `--bolt-elements-borderColor` | Default borders |
| `foreground` | `--bolt-elements-textPrimary` | Main text |
| `muted-foreground` | `--bolt-elements-textSecondary` | Secondary text |
| `accent-foreground` | `--bolt-elements-item-contentAccent` | Accent text |

## 🎨 Color Picking Tips

### 1. **Start with Your Primary Color**
Choose your main brand/accent color first, then build around it.

### 2. **Create Harmonious Backgrounds**
- `background`: Pure white/black or very light/dark
- `muted`: Slightly tinted version of background
- `secondary`: More noticeable tint
- `accent`: Most colorful background (but still subtle)

### 3. **Ensure Contrast**
- Test all text/background combinations
- Use contrast checkers (aim for 4.5:1 minimum)
- Make sure `destructive` stands out for errors

### 4. **Light vs Dark Considerations**
```scss
// Light mode: Dark text, light backgrounds
$foreground: #0f3d30,  // Dark text
$background: #ffffff,   // Light background

// Dark mode: Light text, dark backgrounds  
$foreground: #ecfdf5,  // Light text
$background: #0f1b17,  // Dark background
```

## 📁 File Organization

You can organize themes in multiple ways:

### Option 1: Single File
Add all themes to `app/styles/variables.scss`

### Option 2: Separate Files
```
app/styles/
├── variables.scss          # Core system + default theme
├── semantic-themes.scss    # Mixin definition
├── themes/
│   ├── forest-theme.scss
│   ├── ocean-theme.scss
│   └── sunset-theme.scss
```

## 🔧 Advanced Customization

### Custom Color Calculations
You can use SCSS functions for more sophisticated color relationships:

```scss
:root.color-advanced {
  @include generate-theme-variables(
    $primary: #10b981,
    $primary-foreground: #ffffff,
    $secondary: lighten(#10b981, 45%),  // Automatically lighter
    $accent: saturate(#10b981, 20%),    // More saturated
    $border: rgba(#10b981, 0.2),       // Semi-transparent
    // ... other colors
  );
}
```

### Override Specific Variables
You can override any generated variable after including the mixin:

```scss
:root.color-custom {
  @include generate-theme-variables(/* your colors */);
  
  // Override specific variables
  --bolt-elements-button-primary-backgroundHover: #{darken($primary, 10%)};
  --bolt-elements-sidebar-dropdownShadow: 0 8px 16px rgba($primary, 0.3);
}
```

## ✅ Testing Your Theme

1. **Switch Between Modes**: Test both light and dark versions
2. **Check All UI States**: Hover, focus, active, disabled
3. **Verify Contrast**: Ensure text is readable everywhere
4. **Test Edge Cases**: Error states, loading states, empty states

## 🚀 Migration from Old System

To convert existing manual themes to the new system:

1. Identify your theme's core colors
2. Map them to the 19 semantic colors
3. Replace the manual variable definitions with the mixin
4. Test and adjust as needed

This new system makes theming **10x easier** while ensuring consistency and reducing maintenance! 🎉