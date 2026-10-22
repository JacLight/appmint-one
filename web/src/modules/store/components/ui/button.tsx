// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
// from base-app/src/components/ui/button.tsx — ported verbatim; only import paths rewired.
import React, { useId } from 'react';
import { withTooltip } from './tooltip';
import { classNames } from '@/modules/store/lib-client/helpers';
import { buttonClass, buttonHoverClass } from '@/modules/store/lib-client/constants';
import { IconRenderer } from './icon-renderer';
import BusyIcon from './busy-icon';

const ButtonTooltip = withTooltip('button', 'bottom', 20, 0);
export const Button = (props: {
  id?;
  title?;
  variant?;
  type?;
  onClick?;
  disabled?;
  controlRef?;
  iconSize?;
  isLoading?;
  label?;
  icon?;
  className?;
  unstyled?;
  children?;
}) => {
  const stableId = useId();

  const onClick = (e) => {
    // Only prevent default if we have a custom onClick handler
    // For form submit buttons (type="submit"), we want to allow default behavior
    if (props.onClick) {
      e.preventDefault();
      e.stopPropagation();
      props.onClick(props.controlRef);
    }
  };
  const baseStyle = props.unstyled ? '' : classNames(buttonStyles[props.variant] || buttonStyles.default, 'w-full');
  return (
    <ButtonTooltip
      disabled={props.disabled}
      type={props.type || 'button'}
      id={props.id || props.title || stableId}
      title={props.title}
      className={classNames(baseStyle, props.className)}
      onClick={onClick}
    >
      {props.children ? (
        props.children
      ) : (
        <>
          <BusyIcon isLoading={props.isLoading} size={props.iconSize ? props.iconSize : undefined} />
          {typeof props.icon === 'string' ? (
            <IconRenderer icon={props.icon as any} size={props.iconSize ? props.iconSize : undefined} />
          ) : (
            props.icon || null
          )}
          {props.label && <span>{props.label}</span>}
        </>
      )}
    </ButtonTooltip>
  );
};

const buttonStyles = {
  slim: 'px-3 py-1.5 text-sm font-medium rounded-md',
  default: classNames(buttonHoverClass, buttonClass),
};
