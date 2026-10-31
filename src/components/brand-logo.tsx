import Image from "next/image";

type BrandLogoProps = {
  appearance?: "plain" | "teal" | "platform";
};

export function BrandLogo({ appearance = "plain" }: BrandLogoProps) {
  const source = appearance === "plain" ? "/Light-Logo.png" : "/Dark-Logo.png";
  const className = appearance === "plain"
    ? "brand-logo"
    : appearance === "teal"
      ? "brand-logo brand-logo--teal"
      : "brand-logo brand-logo--platform";

  return <span className={className} aria-hidden="true">
    <Image src={source} alt="" width={54} height={54} priority />
  </span>;
}
