---
name: Precision Career Interface
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006e2f'
  on-secondary: '#ffffff'
  secondary-container: '#6bff8f'
  on-secondary-container: '#007432'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#001a42'
  on-tertiary-container: '#3980f4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.25'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  section-gap: 80px
---

## Brand & Style

The design system is engineered for a CV scoring and optimization platform that balances high-stakes professionalism with approachable guidance. The target audience includes job seekers and HR professionals who require clarity, speed, and data-driven insights. 

The aesthetic follows a **Modern Minimalist** approach. It prioritizes heavy whitespace to reduce cognitive load during the stressful process of job applications. By utilizing a "Soft UI" direction, the design system avoids the clinical coldness of traditional enterprise software, instead opting for a welcoming, supportive environment. The interface should feel precise, encouraging, and highly efficient, evoking an emotional response of confidence and organized progress.

## Colors

The color palette is anchored by **Deep Navy (#0F172A)**, used for primary branding and core typography to establish authority and trust. The primary functional color is **Success Green (#22C55E)**, specifically reserved for scoring indicators, progress fulfillment, and "optimized" states to provide immediate positive reinforcement.

**Action Blue (#3B82F6)** serves as the tertiary color for interactive elements like links and primary buttons, ensuring clear affordance. The background strategy utilizes a high-value **Slate White (#F8FAFC)** to maintain a clean, airy feel that distinguishes content containers from the global canvas.

## Typography

This design system employs a dual-font strategy to maximize both character and readability. **Plus Jakarta Sans** is used for headings and display text; its slightly rounded, modern geometric terminals provide a friendly, contemporary feel.

**Inter** is used for all body copy, inputs, and labels. Its tall x-height and neutral design ensure maximum legibility for dense CV content and optimization suggestions. For mobile devices, display and large headline sizes scale down to maintain hierarchy without overwhelming the viewport.

## Layout & Spacing

The design system utilizes a **12-column fluid grid** for desktop, transitioning to a **4-column grid** for mobile. A strict 8px spacing scale governs all padding and margins to ensure visual harmony.

Layouts should favor verticality and generous "breathability." Core application views (like the CV Scorer) use a split-pane layout on desktop (CV on left, Analysis on right) and a stacked, tabbed approach on mobile. Section gaps are intentionally large (80px+) to clearly demarcate the stages of the optimization funnel.

## Elevation & Depth

To achieve the "Soft UI" aesthetic, this design system rejects heavy, dark shadows in favor of **Ambient Tonal Layers**. Surfaces are elevated using low-opacity, highly diffused shadows (Blur: 20px, Spread: -5px, Color: rgba(15, 23, 42, 0.08)).

Depth is primarily communicated through subtle background shifts. The base canvas is the lightest neutral, while interactive cards and input containers use a pure white background with a 1px border in a very light grey-blue (Slate 200). This "ghost border" combined with soft shadows creates a tactile, premium feel without the clutter of traditional skeuomorphism.

## Shapes

The shape language is consistently **Rounded**. A base radius of 0.5rem (8px) is applied to buttons, input fields, and small UI elements. Larger containers, such as CV upload zones and optimization cards, utilize `rounded-lg` (16px) or `rounded-xl` (24px) to emphasize the soft, modern personality of the platform. Interactive elements never use sharp corners, reinforcing the approachable nature of the tool.

## Components

### Buttons
Primary actions use the Action Blue background with white text and a subtle 4px bottom-offset shadow to suggest "pressability." Secondary actions use a ghost style with a Slate 200 border and Navy text.

### Input Areas (CV/JD)
Drop zones and text areas feature a dash-border in a "Soft" state, which transforms into a solid Action Blue border with a 4px outer glow (ring) upon focus. 

### Progress Circles
Scoring is visualized using SVG semi-circles or full circles. The "track" is a light Slate 100, while the "fill" uses the vibrant Success Green. The score number is centered using Plus Jakarta Sans Bold.

### Optimization Cards
Lists of suggestions are housed in white cards with a 16px radius. Each item features a leading icon (e.g., a green check or an orange "info" circle) and uses a horizontal layout for clear scanning.

### Chips/Tags
Used for "Keywords Found" or "Skills Missing," chips have a pill-shape (32px radius) and use low-saturation backgrounds of the primary or secondary colors (e.g., light green background with dark green text) for high readability.