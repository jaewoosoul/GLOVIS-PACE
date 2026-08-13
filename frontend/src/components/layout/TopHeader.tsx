export function TopHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
      <h1 className="text-lg font-bold tracking-tight text-gray-900">{title}</h1>
    </header>
  );
}
