import React from "react";
import { SearchInput } from "./Input";

export type MarketingSearchVariant = "hero-dark" | "light-section";

export type MarketingSearchInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Calculators hub hero (dark band) or light marketing sections (reports, directory). */
  variant?: MarketingSearchVariant;
  /** When true, search spans full column width (e.g. hero copy, mobile directory headers). */
  fullWidth?: boolean;
  wrapperClassName?: string;
};

function marketingSearchClasses(
  variant: MarketingSearchVariant,
  fullWidth: boolean,
  wrapperClassName?: string,
  inputClassName?: string
): { wrapper: string; input: string } {
  const wrapper = [
    "pg-marketing-search",
    `pg-marketing-search--${variant}`,
    fullWidth ? "pg-marketing-search--full-width" : "",
    wrapperClassName
  ]
    .filter(Boolean)
    .join(" ");

  const input = ["pg-marketing-search__input", inputClassName].filter(Boolean).join(" ");

  return { wrapper, input };
}

/**
 * Search field for public marketing pages — icon + input spacing from calculators hub hero.
 */
export function MarketingSearchInput({
  variant = "light-section",
  fullWidth = false,
  wrapperClassName,
  className,
  ...props
}: MarketingSearchInputProps) {
  const classes = marketingSearchClasses(variant, fullWidth, wrapperClassName, className);

  return <SearchInput wrapperClassName={classes.wrapper} className={classes.input} {...props} />;
}
