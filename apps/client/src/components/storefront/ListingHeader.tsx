export function ListingHeader({ title, countLabel }: { title: string; countLabel: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-normal mb-2">{title}</h1>
      <p className="text-sm text-gray-400">{countLabel}</p>
    </div>
  );
}
