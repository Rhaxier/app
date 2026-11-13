// The app's buttons (design PDF pages 3 and 11). One primary action per screen
// ("calm by default"); everything else is quieter.
//   primary    the screen's main action: white in dark mode, black in light
//   accent     blue, your next step on a card: Request, Ask to join
//   secondary  a soft grey fill: Me too, Send back, Share with a teacher
//   alert      soft orange: destructive or emergency actions
//   quiet      an outline, for minor actions
//   ghost      text only, in the accent colour
// ButtonLink looks the same but navigates (a real <a>).
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

type Variant = 'primary' | 'accent' | 'secondary' | 'alert' | 'quiet' | 'ghost';

interface StyleProps {
  variant?: Variant;
  size?: 'normal' | 'small';
  fullWidth?: boolean;
  icon?: IconName;
}

function classes({ variant = 'primary', size = 'normal', fullWidth }: StyleProps, extra?: string) {
  return [
    'pressable',
    styles.button,
    styles[variant],
    size === 'small' && styles.small,
    fullWidth && styles.full,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleProps {
  /** Shows "Working…" and blocks double taps while a request is running. */
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant,
  size,
  fullWidth,
  icon,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes({ variant, size, fullWidth }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon && <Icon name={icon} size={18} />}
      {loading ? 'Working…' : children}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps, StyleProps {
  children: ReactNode;
}

export function ButtonLink({
  variant,
  size,
  fullWidth,
  icon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, size, fullWidth }, className)} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </Link>
  );
}
