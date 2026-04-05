import { TrendingUp } from "lucide-react";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-wrapper ${className}`}>
      <span className="brand-icon-pill">
        <TrendingUp className="brand-icon-svg" />
      </span>
      <span className="brand-text">Boost Iraq</span>
    </span>
  );
}
