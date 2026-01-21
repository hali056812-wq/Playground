import MapWrapper from '@/components/MapWrapper';

export default function Home() {
  return (
    <main className="h-screen w-full flex flex-col">
      <header className="p-4 bg-white/90 backdrop-blur fixed top-0 w-full z-[1000] shadow-sm">
        <h1 className="text-xl font-bold text-gray-800">Field Satellite View</h1>
      </header>
      <div className="flex-grow">
        <MapWrapper />
      </div>
    </main>
  );
}
