import Sidebar5 from "@/components/ui/sidebar-5";

export default function Sidebar5Demo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f4f6f9] p-4 sm:p-10 font-['Inter',system-ui,sans-serif]">
      <div className="w-full max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="font-['Space_Grotesk',sans-serif] text-xl font-bold text-slate-900">
              Concentrix AMCAT — App Sidebar 5
            </h1>
            <p className="text-xs text-slate-500">
              Themed with landing page brand assets, editorial color tokens, and AMCAT assessment modules.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200">
            Interactive Preview
          </span>
        </div>
        <Sidebar5 />
      </div>
    </div>
  );
}
