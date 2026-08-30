import { useEventData } from './hooks/useEventData';
import ScoringScreen from './components/ScoringScreen';

export default function App() {
  const { data, loading, error, reload } = useEventData();

  return (
    <div className="w-full max-w-[420px] mx-auto h-dvh bg-ink flex flex-col relative overflow-hidden
      sm:rounded-[34px] sm:shadow-[0_0_0_10px_#050B08,0_30px_70px_rgba(0,0,0,.7)] sm:max-h-[860px] sm:my-auto">
      {/* Header */}
      <header className="px-[18px] pt-4 pb-[14px] flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[21px] font-semibold tracking-tight leading-tight"
            style={{ fontVariationSettings: "'opsz' 32, 'SOFT' 30, 'WONK' 0" }}>
            The Freeman Cup
          </h1>
          <div className="text-[11.5px] text-moss tracking-wide mt-[5px]">
            5th Annual · Sand Valley · Oct 2026
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col min-h-0">
        {loading && (
          <div className="flex-1 flex items-center justify-center text-moss">
            Loading…
          </div>
        )}
        {error && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="font-display text-lg font-semibold text-red mb-2">Error</div>
              <div className="text-moss text-sm">{error}</div>
              <div className="text-moss-dim text-xs mt-2">
                RLS requires authentication. Using anon key returns empty data.
              </div>
            </div>
          </div>
        )}
        {data && <ScoringScreen data={data} reload={reload} />}
      </div>

      {/* Bottom nav */}
      <nav className="flex border-t border-line bg-ink flex-none pb-[env(safe-area-inset-bottom)]">
        <div className="flex-1 py-[14px] px-1 border-t-2 border-brass -mt-px text-bone text-center font-display text-base font-semibold"
          style={{ fontVariationSettings: "'opsz' 32, 'SOFT' 30, 'WONK' 0" }}>
          Scoring
        </div>
        <div className="flex-1 py-[14px] px-1 border-t-2 border-transparent -mt-px text-moss-dim text-center font-display text-base font-semibold opacity-50"
          style={{ fontVariationSettings: "'opsz' 32, 'SOFT' 30, 'WONK' 0" }}>
          Live
        </div>
        <div className="flex-1 py-[14px] px-1 border-t-2 border-transparent -mt-px text-moss-dim text-center font-display text-base font-semibold opacity-50"
          style={{ fontVariationSettings: "'opsz' 32, 'SOFT' 30, 'WONK' 0" }}>
          Schedule
        </div>
      </nav>
    </div>
  );
}
