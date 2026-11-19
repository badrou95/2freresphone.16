import { useEffect, useState } from 'react';

interface BrandLogoProps {
  logoUrl?: string | null;
  storeName?: string;
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({
  logoUrl,
  storeName = '2Frères Phone',
  variant = 'light',
  size = 'md',
}: BrandLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [logoUrl]);

  const imgHeight = size === 'lg' ? 'h-10' : size === 'sm' ? 'h-7' : 'h-8';
  const textClass =
    variant === 'dark' ? 'text-white' : 'text-slate-900';

  if (logoUrl && !imgFailed) {
    return (
      <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
        <img
          src={logoUrl}
          alt={storeName}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`${imgHeight} w-auto max-w-[160px] object-contain`}
        />
        <span className={`font-display font-bold tracking-tight text-base ${textClass}`}>
          {storeName}
        </span>
      </span>
    );
  }

  return (
    <span className={`font-display font-bold tracking-tight text-lg whitespace-nowrap shrink-0 ${textClass}`}>
      {storeName}
    </span>
  );
}
