// The app's buttons. Primary = teal fill (main action on a screen), secondary =
// white with a border, alert = orange (fix-it actions), quiet = grey fill,
// ghost = text only. ButtonLink looks the same but navigates (a real <a>).
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'alert' | 'quiet' | 'ghost';

interface StyleProps {
  variant?: Variant;
  size?: 'normal' | 'small';
  fullWidth?: boolean;
  icon?: IconName;
}

function classes({ variant = 'primary', size = 'normal', fullWidth }: StyleProps, extra?: string) {
  return [
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
      {icon && <Icon name={icon} size={20} />}
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
      {icon && <Icon name={icon} size={20} />}
      {children}
    </Link>
  );
}
