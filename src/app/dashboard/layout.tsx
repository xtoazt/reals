
import ParticlesBackground from '@/components/particles-background';
import { TopNavBar } from '@/components/top-nav-bar'; // New component

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // SidebarProvider is removed as we are moving to top navigation
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      <ParticlesBackground />
      <TopNavBar /> 
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-[calc(57px+1rem)] md:pt-[calc(57px+1.5rem)]"> {/* Added padding-top to account for fixed TopNavBar height */}
        {children}
      </main>
    </div>
  );
}
