export function ListingHeader({ title, countLabel }: { title: string; countLabel: string }) {
  return (
    <div className="mb-6 text-center sm:mb-8">
      <h1 className="text-[18px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">{title}</h1>
      <p className="mt-1.5 text-[12px] text-black/50">{countLabel}</p>
    </div>
  );
}
