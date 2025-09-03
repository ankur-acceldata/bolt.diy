# Acceldata Customization Changes

This document tracks all changes made to the Bolt codebase to customize it for Acceldata's use case. If you need to refresh the fork in the future, refer to this document to understand the types of changes that need to be reapplied.

## Branding Customizations

### Logo Replacement
- **What Changed**: Removed the original Bolt logo and branding from the header
- **Context**: The Bolt logo was commented out in the header component to prepare for Acceldata branding
- **Implementation**: Commented out logo code blocks in the header component

### Color Scheme Overhaul
- **What Changed**: Updated primary color palette throughout the application
- **Context**: Switched from the original color scheme to Acceldata's blue-focused theme
- **Implementation**: Modified root CSS variables in the style system:
  ```scss
  :root {
    --gradient-opacity: 0.85;
    --primary-color: rgba(120, 180, 255, var(--gradient-opacity)); // Softer blue for dark
    --secondary-color: rgba(30, 40, 60, var(--gradient-opacity)); // Deep blue-gray (not pure black)
    --accent-color: rgba(80, 140, 255, var(--gradient-opacity)); // Vibrant blue accent
    // --primary-color: rgba(147, 112, 219, var(--gradient-opacity));
    // --secondary-color: rgba(138, 43, 226, var(--gradient-opacity));
    // --accent-color: rgba(180, 170, 220, var(--gradient-opacity));
  }
  ```

## UI Theme Customization

### Component Styling
- **What Changed**: Modified multiple UI components to align with Acceldata's design system
- **Context**: Needed consistent styling across badges, buttons, cards, dialogs, and form elements
- **Implementation**: Updated component CSS classes to use Acceldata color variables and styling patterns

### Visual Hierarchy Adjustments
- **What Changed**: Revised visual emphasis in components like GradientCard, Badge, and Tabs
- **Context**: Aligned the visual hierarchy to match Acceldata's design guidelines
- **Implementation**: Adjusted opacity levels, border styles, shadows, and hover states

### Dialog and Modal Styling
- **What Changed**: Customized dialog components for a more modern appearance
- **Context**: Enhanced usability and visual appeal of modals and popups
- **Implementation**: Updated border radius, shadows, animations, and content layout

## Navigation and Layout Changes

### Menu System Implementation
- **What Changed**: Created a new menu state management system
- **Context**: Added functionality to control sidebar visibility with toggle, open, and close methods
- **Implementation**: Added a dedicated store for managing menu state across the application

### Tab Management Customization
- **What Changed**: Modified tab management system for settings and controls
- **Context**: Enhanced tab navigation to improve user experience
- **Implementation**: Updated tab styling, interaction patterns, and state management

## Functional Enhancements

### Event Logging System
- **What Changed**: Enhanced log filtering, display, and export capabilities
- **Context**: Improved debugging and monitoring capabilities
- **Implementation**: Added advanced filtering options and export formats (JSON, CSV, PDF, text)

### Chat Interface Optimization
- **What Changed**: Customized chat component styling and behavior
- **Context**: Adjusted the chat interface to better suit Acceldata's use cases
- **Implementation**: Modified chat UI components and interaction patterns

### API Key Management
- **What Changed**: Customized API key management interface
- **Context**: Enhanced security and usability for API key handling
- **Implementation**: Updated forms and validation for API key entry and storage

## Core Systems and Theme Architecture

### Theme Configuration
- **What Changed**: Modified theme variables and configuration
- **Context**: Created consistent theming across the application
- **Implementation**: Updated color theme variables and design tokens in the theming system

### Diff View Enhancement
- **What Changed**: Customized diff view styling
- **Context**: Improved code and data difference visualization
- **Implementation**: Updated syntax highlighting and visual cues in diff displays

## Guidance for Future Updates

When applying these changes to a refreshed fork, focus on:

1. **Branding Elements**: Replace logos, update color schemes in root variables
2. **UI Component Styling**: Apply Acceldata's design patterns to UI components
3. **Menu System**: Implement the menu state management store
4. **Functional Enhancements**: Apply the advanced event logging and chat interface optimizations

Rather than focusing on specific files, ensure these conceptual changes are applied throughout the project, maintaining consistency with Acceldata's design system and functional requirements. 