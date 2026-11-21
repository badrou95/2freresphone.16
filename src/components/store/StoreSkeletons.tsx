import React from 'react';

export function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-white border border-slate-200/90 rounded-xl overflow-hidden flex flex-col shadow-xs"
    >
      {/* Aspect 4:3 Image Placeholder */}
      <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 via-slate-200/70 to-slate-100 animate-pulse relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      </div>

      {/* Content Placeholder */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Category & Stock Status */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-24 rounded-md bg-slate-200/80 animate-pulse" />
          <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
          <div className="h-3 w-14 rounded-md bg-emerald-100/80 animate-pulse" />
        </div>

        {/* Title Lines */}
        <div className="mt-2.5 space-y-2">
          <div className="h-4 w-11/12 rounded-md bg-slate-200/90 animate-pulse" />
          <div className="h-4 w-2/3 rounded-md bg-slate-200/75 animate-pulse" />
        </div>

        {/* Star Rating */}
        <div className="mt-3 flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="w-3.5 h-3.5 rounded-xs bg-amber-100/90 animate-pulse"
              />
            ))}
          </div>
          <div className="h-3 w-8 rounded-md bg-slate-100 animate-pulse" />
        </div>

        {/* Price & Button Footer */}
        <div className="mt-auto pt-4 flex items-end justify-between gap-3">
          <div className="space-y-1.5">
            <div className="h-4 w-24 rounded-md bg-slate-200/95 animate-pulse" />
            <div className="h-3 w-16 rounded-md bg-slate-100 animate-pulse" />
          </div>
          <div className="h-8 w-24 rounded-lg bg-slate-200/90 animate-pulse shrink-0" />
        </div>
      </div>
    </div>
  );
}

export function CollectionCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-white border border-slate-200/90 rounded-xl overflow-hidden flex flex-col"
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 via-slate-200/70 to-slate-100 animate-pulse" />
      <div className="p-5 flex-1 flex flex-col space-y-2.5">
        <div className="h-3 w-28 rounded-md bg-slate-200/80 animate-pulse" />
        <div className="h-5 w-3/4 rounded-md bg-slate-200/95 animate-pulse" />
        <div className="space-y-1.5 pt-1">
          <div className="h-3.5 w-full rounded-md bg-slate-100 animate-pulse" />
          <div className="h-3.5 w-4/5 rounded-md bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function StoreHomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Chargement de la page d'accueil 2Frères Phone"
      className="space-y-16 pb-20"
    >
      <span className="sr-only">Chargement de la boutique 2Frères Phone...</span>

      {/* Section 1: Editorial Split Hero Skeleton */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <div className="h-3.5 w-64 rounded-md bg-blue-100/90 animate-pulse" />

              <div className="mt-4 space-y-3">
                <div className="h-9 sm:h-11 w-11/12 rounded-lg bg-slate-200/90 animate-pulse" />
                <div className="h-9 sm:h-11 w-4/5 rounded-lg bg-slate-200/85 animate-pulse" />
                <div className="h-9 sm:h-11 w-3/5 rounded-lg bg-slate-200/75 animate-pulse" />
              </div>

              <div className="mt-5 space-y-2 max-w-xl">
                <div className="h-4 w-full rounded-md bg-slate-100 animate-pulse" />
                <div className="h-4 w-5/6 rounded-md bg-slate-100 animate-pulse" />
              </div>

              {/* Search Bar Skeleton */}
              <div className="mt-7 flex gap-2 max-w-lg">
                <div className="h-11 flex-1 rounded-lg border border-slate-200 bg-slate-100/80 animate-pulse" />
                <div className="h-11 w-28 rounded-lg bg-blue-200/70 animate-pulse shrink-0" />
              </div>

              {/* Trust Badges Skeleton */}
              <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-slate-200 animate-pulse shrink-0" />
                    <div className="h-3 w-32 rounded-md bg-slate-200/80 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 via-slate-200/75 to-slate-100 border border-slate-200 h-full min-h-[280px] animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Three Core Store Universes Skeleton */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div className="space-y-2">
            <div className="h-7 w-36 rounded-lg bg-slate-200/90 animate-pulse" />
            <div className="h-4 w-80 max-w-full rounded-md bg-slate-200/70 animate-pulse" />
          </div>
          <div className="h-4 w-20 rounded-md bg-blue-100 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, idx) => (
            <CollectionCardSkeleton key={idx} />
          ))}
        </div>
      </section>

      {/* Section 3: Featured Products Grid Skeleton */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div className="space-y-2">
            <div className="h-7 w-52 rounded-lg bg-slate-200/90 animate-pulse" />
            <div className="h-4 w-96 max-w-full rounded-md bg-slate-200/70 animate-pulse" />
          </div>
          <div className="h-4 w-36 rounded-md bg-blue-100 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <ProductCardSkeleton key={idx} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function CatalogViewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Chargement du catalogue 2Frères Phone"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
    >
      <span className="sr-only">Chargement du catalogue 2Frères Phone...</span>

      {/* Top Header & Search/Sort Bar Skeleton */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-lg bg-slate-200/90 animate-pulse" />
          <div className="h-4 w-36 rounded-md bg-slate-200/70 animate-pulse" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="h-9 min-w-[240px] flex-1 md:flex-none rounded-lg border border-slate-200 bg-white animate-pulse" />
          <div className="h-9 w-44 rounded-lg border border-slate-200 bg-white animate-pulse" />
        </div>
      </div>

      {/* Group Segmented Filter Skeleton */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <div className="h-7 w-28 rounded-md bg-white shadow-xs animate-pulse" />
          <div className="h-7 w-36 rounded-md bg-slate-200/70 animate-pulse" />
          <div className="h-7 w-32 rounded-md bg-slate-200/70 animate-pulse" />
          <div className="h-7 w-36 rounded-md bg-slate-200/70 animate-pulse" />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Filters Skeleton */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 rounded-md bg-slate-200/90 animate-pulse" />
              <div className="h-3.5 w-20 rounded-md bg-blue-100 animate-pulse" />
            </div>

            <div className="space-y-2">
              <div className="h-3.5 w-24 rounded-md bg-slate-200/80 animate-pulse" />
              <div className="h-9 w-full rounded-lg bg-slate-100 animate-pulse" />
            </div>

            <div className="space-y-2.5">
              <div className="h-3.5 w-28 rounded-md bg-slate-200/80 animate-pulse" />
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-200 animate-pulse" />
                  <div className="h-3.5 w-40 rounded-md bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="h-3.5 w-24 rounded-md bg-slate-200/80 animate-pulse" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-9 rounded-lg bg-slate-100 animate-pulse" />
                <div className="h-9 rounded-lg bg-slate-100 animate-pulse" />
              </div>
            </div>
          </div>
        </aside>

        {/* Product Grid Skeleton */}
        <div className="lg:col-span-9">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <ProductCardSkeleton key={idx} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
