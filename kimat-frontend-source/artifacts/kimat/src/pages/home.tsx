import { useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Building2,
  Check,
  ChevronDown,
  Compass,
  IndianRupee,
  Keyboard,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetPincodeInsightQueryKey,
  getHealthCheckQueryKey,
  getSearchPropertiesQueryKey,
  useGetPincodeInsight,
  useHealthCheck,
  useSearchProperties,
} from '@workspace/api-client-react';
import type { Listing, SearchPropertiesParams } from '@workspace/api-client-react';

const suggestionChips = [
  { label: 'Family home · Indiranagar', pincode: '560038', text: '3 BHK with parking, a balcony, and good natural light' },
  { label: 'Quiet home · Koregaon Park', pincode: '411001', text: '2 BHK, newer building, near cafes and a park' },
  { label: 'Commute-friendly · HSR', pincode: '560102', text: '2 BHK under 95 lakh with covered parking' },
];

const formatLakhs = (value: number) => value >= 100 ? `₹${(value / 100).toFixed(2)} Cr` : `₹${value.toFixed(value % 1 ? 1 : 0)}L`;
const formatNumber = (value: number) => new Intl.NumberFormat('en-IN').format(value);
const mod = (value: number, length: number) => ((value % length) + length) % length;

function SearchSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="loading-property-results">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="scanline relative overflow-hidden rounded-2xl border border-border bg-card/70 p-5">
          <div className="skeleton-pulse mb-7 h-2.5 w-20 rounded-full bg-muted" />
          <div className="skeleton-pulse mb-3 h-5 w-4/5 rounded bg-muted" />
          <div className="skeleton-pulse mb-8 h-3 w-1/2 rounded bg-muted" />
          <div className="flex gap-2"><div className="skeleton-pulse h-6 w-16 rounded bg-muted" /><div className="skeleton-pulse h-6 w-20 rounded bg-muted" /></div>
        </div>
      ))}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-14 w-14 shrink-0" aria-label={`${score}% match`}>
      <svg className="-rotate-90" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
        <circle cx="20" cy="20" r={radius} fill="none" stroke="hsl(var(--primary))" strokeLinecap="round" strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={circumference - (score / 100) * circumference} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono-app text-[10px] font-medium text-primary">{score}</span>
    </div>
  );
}

function SaveButton({ saved, onToggle, id }: { saved: boolean; onToggle: () => void; id: number }) {
  return (
    <button
      type="button"
      aria-label={saved ? 'Remove saved property' : 'Save property'}
      onClick={onToggle}
      className={`focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${saved ? 'border-accent/70 bg-accent/15 text-accent' : 'border-border/80 bg-background/50 text-muted-foreground hover:border-accent hover:text-accent'}`}
      data-testid={`button-save-property-${id}`}
    >
      <Bookmark className={`h-4 w-4 ${saved ? 'fill-accent' : ''}`} />
    </button>
  );
}

function ListingBrowser({
  listings,
  savedIds,
  onToggleSave,
}: {
  listings: Listing[];
  savedIds: Set<number>;
  onToggleSave: (id: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pointerRef = useRef({ x: 0, time: 0 });
  const normalizedIndex = mod(activeIndex, listings.length);
  const activeListing = listings[normalizedIndex];

  const goStep = (direction: 1 | -1) => {
    setActiveIndex((current) => mod(current + direction, listings.length));
    setDragX(0);
    setExpanded(false);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current = { x: event.clientX, time: performance.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragX(event.clientX - pointerRef.current.x);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const distance = event.clientX - pointerRef.current.x;
    const elapsed = Math.max(1, performance.now() - pointerRef.current.time);
    const flick = Math.abs(distance) > 52 || Math.abs(distance / elapsed) > 0.45;
    setDragging(false);
    if (flick) goStep(distance < 0 ? 1 : -1);
    else setDragX(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      goStep(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      goStep(-1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setExpanded((value) => !value);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-[#071c25]/90 p-3 shadow-[var(--shadow-md)] sm:p-5" data-testid="section-property-browser">
      <div className="console-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative flex flex-wrap items-start justify-between gap-4 px-2 pb-3 sm:px-3">
        <div>
          <p className="font-mono-app text-[9px] uppercase tracking-[.18em] text-primary/75">03 / live shortlist</p>
          <h2 className="mt-1 text-xl font-bold tracking-[-.03em] text-foreground sm:text-2xl">Settle on a signal<span className="text-accent">.</span></h2>
        </div>
        <div className="flex items-center gap-2 font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          {normalizedIndex + 1} / {listings.length} ranked
        </div>
      </div>

      <div
        className="coverflow-stage touch-pan-y relative h-[405px] overflow-hidden rounded-[1.45rem] border border-primary/15 bg-[radial-gradient(circle_at_50%_38%,rgba(72,205,190,.15),transparent_38%),linear-gradient(145deg,#0a2831,#06141e)] outline-none sm:h-[430px]"
        role="application"
        aria-label={`Property browser. Showing ${activeListing.address}. Use arrow keys or swipe to change homes.`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="property-browser-stage"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/35 to-transparent" />
        <div className="pointer-events-none absolute inset-x-[15%] top-[19%] h-px teal-rule opacity-50" />
        {listings.map((listing, index) => {
          let distance = index - normalizedIndex;
          if (distance > listings.length / 2) distance -= listings.length;
          if (distance < -listings.length / 2) distance += listings.length;
          const visible = Math.abs(distance) <= 2;
          const shifted = distance * 40 + (dragX / 9);
          const rotate = distance * -15 + (dragX / 26);
          const scale = distance === 0 ? 1 : Math.max(.72, 1 - Math.abs(distance) * .12);
          const opacity = distance === 0 ? 1 : Math.max(.1, 1 - Math.abs(distance) * .34);
          return (
            <article
              key={listing.id}
              className="coverflow-card absolute left-1/2 top-1/2 h-[274px] w-[min(76vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-[1.3rem] border border-primary/20 bg-[linear-gradient(145deg,rgba(16,53,61,.98),rgba(6,24,32,.98))] p-5 screen-shadow sm:h-[292px] sm:p-6"
              style={{ transform: `translate3d(calc(-50% + ${shifted}%), -50%, ${-Math.abs(distance) * 100}px) rotateY(${rotate}deg) scale(${scale})`, opacity: visible ? opacity : 0, zIndex: 20 - Math.abs(distance), transition: dragging ? 'none' : 'transform .46s cubic-bezier(.2,.8,.2,1), opacity .38s ease', pointerEvents: distance === 0 ? 'auto' : 'none' }}
              aria-hidden={distance !== 0}
              data-testid={`card-browser-property-${listing.id}`}
            >
              <div className="absolute inset-0 overflow-hidden rounded-[1.3rem]">
                <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
                <div className="absolute -bottom-16 -left-8 h-44 w-44 rounded-full bg-accent/10 blur-3xl" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#06151c] to-transparent" />
              </div>
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono-app text-[9px] uppercase tracking-[.16em] text-primary/75">match / {Math.round(listing.match_score)}%</span>
                  <SaveButton saved={savedIds.has(listing.id)} onToggle={() => onToggleSave(listing.id)} id={listing.id} />
                </div>
                <div>
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.12em] text-accent"><Sparkles className="h-3 w-3" /> leading signal</div>
                  <h3 className="max-w-[360px] text-[clamp(1.35rem,3vw,2rem)] font-bold leading-[1.05] tracking-[-.045em] text-foreground">{listing.address}</h3>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-primary" /> {listing.property_type} · {listing.pincode}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-primary/15 pt-3 text-[11px]">
                  <span><strong className="block text-sm text-foreground">{listing.bhk} BHK</strong><span className="text-muted-foreground">layout</span></span>
                  <span><strong className="block text-sm text-foreground">{formatNumber(listing.area_sqft)}</strong><span className="text-muted-foreground">sq ft</span></span>
                  <span><strong className="block text-sm text-primary">{formatLakhs(listing.predicted_price)}</strong><span className="text-muted-foreground">kimat</span></span>
                </div>
              </div>
            </article>
          );
        })}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground/70">
          <span className="rounded-full border border-border/80 bg-background/45 px-3 py-1.5 backdrop-blur">flick to browse · settle to inspect</span>
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3 px-1 sm:px-3">
        <button type="button" onClick={() => goStep(-1)} className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/55 text-foreground transition hover:border-primary hover:text-primary" aria-label="Previous property" data-testid="button-previous-property"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-bold text-foreground">{activeListing.address}</p>
          <p className="mt-1 font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">{activeListing.pincode} · {formatLakhs(activeListing.price_low)}–{formatLakhs(activeListing.price_high)}</p>
        </div>
        <button type="button" onClick={() => goStep(1)} className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/55 text-foreground transition hover:border-primary hover:text-primary" aria-label="Next property" data-testid="button-next-property"><ArrowRight className="h-4 w-4" /></button>
      </div>
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-1 pt-4 sm:px-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Keyboard className="h-3.5 w-3.5 text-primary" /> <span>Arrow keys or swipe</span></div>
        <button type="button" onClick={() => setExpanded((value) => !value)} className="focus-ring group inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:-translate-y-0.5" data-testid="button-inspect-property">
          {expanded ? 'Close property signal' : 'Inspect this signal'} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
      {expanded && (
        <div className="relative mt-4 grid gap-3 rounded-2xl border border-primary/20 bg-background/35 p-4 animate-rise-in sm:grid-cols-[1fr_auto] sm:items-center" data-testid="panel-active-property-detail">
          <div>
            <p className="font-mono-app text-[9px] uppercase tracking-[.16em] text-primary/75">active valuation readout</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">A {activeListing.bhk} BHK {activeListing.property_type.toLowerCase()} with {formatNumber(activeListing.area_sqft)} sq ft in {activeListing.pincode}. Estimated at <strong className="text-foreground">{formatLakhs(activeListing.predicted_price)}</strong>, with a likely range of <strong className="text-foreground">{formatLakhs(activeListing.price_low)}–{formatLakhs(activeListing.price_high)}</strong>.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/10 px-3 py-2"><ScoreRing score={Math.round(activeListing.match_score)} /><span className="text-xs font-bold text-accent">fit for your brief</span></div>
        </div>
      )}
    </section>
  );
}

function InsightPanel({ pincode, submitted }: { pincode: string; submitted: boolean }) {
  const insightParams = useMemo(() => ({ pincode: submitted ? pincode : '000000' }), [pincode, submitted]);
  const insight = useGetPincodeInsight(insightParams, { query: { enabled: submitted, queryKey: getGetPincodeInsightQueryKey(insightParams) } });

  if (!submitted) {
    return (
      <aside className="scanline relative min-h-[320px] overflow-hidden rounded-3xl border border-primary/20 bg-[#0b222c] p-6 shadow-[var(--shadow-md)] sm:p-7" data-testid="panel-insight-empty">
        <div className="console-grid absolute inset-0 opacity-70" />
        <div className="relative flex h-full min-h-[268px] flex-col justify-between">
          <div className="flex items-center justify-between"><span className="font-mono-app text-[10px] uppercase tracking-[.16em] text-primary/70">market read / standby</span><Compass className="h-5 w-5 text-accent" /></div>
          <div><div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-primary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> waiting for a pincode</div><p className="display-serif max-w-xs text-3xl leading-[1.05] text-foreground">See the signal behind the address.</p><p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">Kimat reads price bands, inventory, and demand so your shortlist starts with context.</p></div>
          <div className="flex items-center gap-3 border-t border-primary/15 pt-4 font-mono-app text-[9px] uppercase tracking-[.12em] text-muted-foreground"><Radar className="h-3.5 w-3.5 text-accent" /> local intelligence layer</div>
        </div>
      </aside>
    );
  }
  if (insight.isLoading) return <aside className="rounded-3xl border border-border bg-card p-6 sm:p-7" data-testid="loading-insight"><div className="skeleton-pulse h-3 w-28 rounded bg-muted" /><div className="skeleton-pulse mt-8 h-9 w-44 rounded bg-muted" /><div className="skeleton-pulse mt-3 h-3 w-56 rounded bg-muted" /><div className="mt-10 grid grid-cols-2 gap-3"><div className="skeleton-pulse h-20 rounded-2xl bg-muted" /><div className="skeleton-pulse h-20 rounded-2xl bg-muted" /></div></aside>;
  if (insight.isError || !insight.data) return <aside className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6" data-testid="error-insight"><p className="font-semibold text-destructive">Market read unavailable</p><p className="mt-2 text-sm text-muted-foreground">We could not read this pincode right now. Your property results may still be available.</p><button type="button" onClick={() => insight.refetch()} className="focus-ring mt-4 text-sm font-bold text-primary underline underline-offset-4" data-testid="button-retry-insight">Try again</button></aside>;
  const data = insight.data;
  const confidence = Math.round(data.confidence <= 1 ? data.confidence * 100 : data.confidence);
  return (
    <aside className="scanline relative overflow-hidden rounded-3xl border border-border bg-card/90 p-6 shadow-[var(--shadow-sm)] sm:p-7" data-testid="panel-insight">
      <div className="relative flex items-start justify-between"><div><span className="font-mono-app text-[10px] uppercase tracking-[.16em] text-muted-foreground">market read / {data.pincode}</span><h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">{data.locality}</h2><p className="mt-1 text-sm text-muted-foreground">{data.demand_label} demand in this pocket</p></div><div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent"><TrendingUp className="h-5 w-5" /></div></div>
      <div className="relative mt-7 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-border bg-secondary/55 p-4"><p className="font-mono-app text-[9px] uppercase tracking-[.12em] text-muted-foreground">average price</p><p className="mt-2 text-xl font-bold text-primary">{formatLakhs(data.average_price_lakh)}</p></div><div className="rounded-2xl border border-border bg-secondary/55 p-4"><p className="font-mono-app text-[9px] uppercase tracking-[.12em] text-muted-foreground">per sqft</p><p className="mt-2 text-xl font-bold text-primary">₹{formatNumber(data.price_per_sqft)}</p></div></div>
      <div className="relative mt-5 flex items-center justify-between border-t border-border pt-4 text-xs"><span className="text-muted-foreground">{formatNumber(data.inventory_count)} homes in view</span><span className="flex items-center gap-1.5 font-semibold text-foreground"><ShieldCheck className="h-3.5 w-3.5 text-accent" /> {confidence}% confidence</span></div>
      {data.price_bands.length > 0 && <div className="relative mt-6"><p className="mb-3 font-mono-app text-[10px] uppercase tracking-[.14em] text-muted-foreground">price bands</p><div className="space-y-3">{data.price_bands.map((band) => <div key={band.label} data-testid={`row-price-band-${band.label}`}><div className="mb-1.5 flex justify-between gap-3 text-[11px]"><span className="font-semibold text-foreground">{band.label}</span><span className="text-right text-muted-foreground">{band.count} listings · {formatLakhs(band.min_lakh)}–{formatLakhs(band.max_lakh)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(8, Math.min(100, band.count / Math.max(data.inventory_count, 1) * 100))}%` }} /></div></div>)}</div></div>}
    </aside>
  );
}

export default function Home() {
  const [pincode, setPincode] = useState('');
  const [freeText, setFreeText] = useState('');
  const [bhk, setBhk] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [validation, setValidation] = useState('');
  const [submitted, setSubmitted] = useState<SearchPropertiesParams | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 300000 } });
  const searchParams = useMemo(() => submitted ?? { pincode: '000000' }, [submitted]);
  const search = useSearchProperties(searchParams, { query: { enabled: Boolean(submitted), queryKey: getSearchPropertiesQueryKey(searchParams) } });

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPincode = pincode.trim();
    if (!/^\d{6}$/.test(trimmedPincode)) { setValidation('Enter a valid 6-digit pincode to start.'); return; }
    if (budgetMin && budgetMax && Number(budgetMin) > Number(budgetMax)) { setValidation('Your minimum budget should be below your maximum budget.'); return; }
    setValidation('');
    setSubmitted({ pincode: trimmedPincode, ...(freeText.trim() ? { free_text: freeText.trim() } : {}), ...(bhk ? { bhk: Number(bhk) } : {}), ...(propertyType ? { property_type: propertyType } : {}), ...(budgetMin ? { budget_min: Number(budgetMin) } : {}), ...(budgetMax ? { budget_max: Number(budgetMax) } : {}), limit: 12 });
  };
  const useSuggestion = (suggestion: typeof suggestionChips[number]) => { setPincode(suggestion.pincode); setFreeText(suggestion.text); setValidation(''); };
  const toggleSaved = (id: number) => setSavedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const searchedPincode = submitted?.pincode ?? '';
  const parsed = search.data?.parsed_requirement;
  const results = search.data?.results ?? [];

  return (
    <div className="grain min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      <header className="relative z-20 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3" data-testid="brand-kimat"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary"><Building2 className="h-4 w-4" strokeWidth={2.2} /></div><div><p className="text-[17px] font-extrabold tracking-[-.05em] text-foreground">kimat<span className="text-primary">.</span></p><p className="font-mono-app text-[8px] uppercase tracking-[.16em] text-muted-foreground">property intelligence</p></div></div>
          <nav className="hidden items-center gap-5 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground sm:flex"><a href="#search" className="focus-ring transition hover:text-primary" data-testid="link-search">Search</a><a href="#market" className="focus-ring transition hover:text-primary" data-testid="link-market">Market read</a><span className="flex items-center gap-2 border-l border-border pl-5"><span className={`h-1.5 w-1.5 rounded-full ${health.data?.status === 'ok' ? 'bg-primary shadow-[0_0_12px_hsl(var(--primary))]' : 'bg-accent'}`} />{health.data?.status === 'ok' ? 'online' : 'ready'}</span></nav>
        </div>
      </header>

      <main>
        <section className="hero-field relative isolate overflow-hidden" data-testid="hero-property-intelligence">
          <div className="pointer-events-none absolute inset-0 z-[-1]"><div className="console-grid absolute inset-0 opacity-30" /><div className="absolute -left-32 top-28 h-80 w-80 rounded-full bg-primary/10 blur-[110px]" /><div className="absolute right-[-120px] top-[45%] h-96 w-96 rounded-full bg-accent/10 blur-[125px]" /></div>
          <div className="relative z-10 mx-auto max-w-[1480px] px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16 lg:px-12 lg:pb-20 lg:pt-20">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,.92fr)_minmax(420px,.72fr)] lg:items-end lg:gap-16">
              <div className="animate-rise-in">
                <p className="mb-5 flex items-center gap-2 font-mono-app text-[10px] font-medium uppercase tracking-[.18em] text-primary"><span className="h-px w-8 bg-accent" /> a second opinion for your search</p>
                <h1 className="max-w-4xl text-[clamp(3.25rem,7.4vw,8.6rem)] font-bold leading-[.86] tracking-[-.085em] text-foreground">Find the home<br /><span className="display-serif font-medium italic text-primary">behind the listing.</span></h1>
                <p className="mt-7 max-w-xl text-base leading-7 text-secondary-foreground sm:text-lg">Search by pincode and plain English. Kimat turns local signals into a ranked shortlist and a number you can actually explain.</p>
                <div className="mt-8 flex flex-wrap gap-4 font-mono-app text-[9px] uppercase tracking-[.12em] text-muted-foreground"><span className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-accent" /> ranked by fit</span><span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-primary" /> pincode aware</span></div>
              </div>
              <form id="search" onSubmit={submitSearch} className="scanline relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-[#071c25]/90 p-5 shadow-[var(--shadow-md)] sm:p-7" data-testid="form-property-search">
                <div className="console-grid absolute inset-0 opacity-45" />
                <div className="relative mb-6 flex items-center justify-between"><div><p className="font-mono-app text-[10px] uppercase tracking-[.16em] text-primary/75">01 / define the brief</p><h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">What should this home do?</h2></div><div className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary sm:flex"><Search className="h-4 w-4" /></div></div>
                <div className="relative grid gap-4 sm:grid-cols-[.65fr_1.35fr]">
                  <label className="block"><span className="mb-2 block text-xs font-bold text-foreground">Pincode</span><div className="property-field relative rounded-xl"><MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" /><input value={pincode} onChange={(event) => setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 560038" inputMode="numeric" className="focus-ring h-12 w-full rounded-xl bg-transparent pl-10 pr-3 text-sm font-semibold tracking-[.08em] text-foreground outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground" data-testid="input-pincode" /></div></label>
                  <label className="block"><span className="mb-2 block text-xs font-bold text-foreground">Describe your ideal home</span><textarea value={freeText} onChange={(event) => setFreeText(event.target.value)} rows={1} placeholder="A bright 2 BHK with parking, close to a metro..." className="property-field focus-ring min-h-12 w-full resize-none rounded-xl px-4 py-3 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground" data-testid="input-requirements" /></label>
                </div>
                {validation && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-destructive" data-testid="status-validation"><X className="h-3.5 w-3.5" /> {validation}</p>}
                <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-5"><button type="button" onClick={() => setShowFilters((value) => !value)} className="focus-ring flex min-h-10 items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-primary" data-testid="button-toggle-filters"><SlidersHorizontal className="h-3.5 w-3.5" /> {showFilters ? 'Hide filters' : 'Add filters'} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} /></button><button type="submit" className="focus-ring group flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/.18)] transition hover:-translate-y-0.5 active:translate-y-0 sm:w-auto" data-testid="button-search-properties">Find my shortlist <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></button></div>
                {showFilters && <div className="relative mt-5 grid animate-rise-in gap-3 border-t border-border/80 pt-5 sm:grid-cols-3" data-testid="section-structured-filters"><label className="block"><span className="mb-2 block text-[11px] font-semibold text-muted-foreground">Bedrooms</span><select value={bhk} onChange={(event) => setBhk(event.target.value)} className="property-field focus-ring h-11 w-full rounded-lg px-3 text-sm text-foreground outline-none" data-testid="select-bhk"><option value="">Any BHK</option><option value="1">1 BHK</option><option value="2">2 BHK</option><option value="3">3 BHK</option><option value="4">4 BHK</option></select></label><label className="block"><span className="mb-2 block text-[11px] font-semibold text-muted-foreground">Property type</span><select value={propertyType} onChange={(event) => setPropertyType(event.target.value)} className="property-field focus-ring h-11 w-full rounded-lg px-3 text-sm text-foreground outline-none" data-testid="select-property-type"><option value="">Any type</option><option value="Apartment">Apartment</option><option value="Independent House">Independent house</option><option value="Villa">Villa</option></select></label><div><span className="mb-2 block text-[11px] font-semibold text-muted-foreground">Budget (₹ lakh)</span><div className="flex gap-2"><input value={budgetMin} onChange={(event) => setBudgetMin(event.target.value.replace(/\D/g, ''))} placeholder="From" inputMode="numeric" className="property-field focus-ring h-11 min-w-0 w-1/2 rounded-lg px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground" data-testid="input-budget-min" /><input value={budgetMax} onChange={(event) => setBudgetMax(event.target.value.replace(/\D/g, ''))} placeholder="To" inputMode="numeric" className="property-field focus-ring h-11 min-w-0 w-1/2 rounded-lg px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground" data-testid="input-budget-max" /></div></div></div>}
              </form>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2.5" data-testid="suggestion-chips"><span className="mr-1 font-mono-app text-[10px] uppercase tracking-[.12em] text-muted-foreground">try a search</span>{suggestionChips.map((suggestion) => <button key={suggestion.pincode} type="button" onClick={() => useSuggestion(suggestion)} className="focus-ring rounded-full border border-border bg-background/35 px-3 py-2 text-[11px] font-semibold text-muted-foreground backdrop-blur transition hover:border-primary/60 hover:text-primary" data-testid={`button-suggestion-${suggestion.pincode}`}>{suggestion.label}</button>)}</div>

            {submitted && <div className="mt-12 animate-rise-in" data-testid="section-search-results">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono-app text-[10px] uppercase tracking-[.16em] text-primary/75">02 / your shortlist · {searchedPincode}</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Homes that make sense<span className="text-accent">.</span></h2>{parsed && <div className="mt-3 flex flex-wrap gap-2">{parsed.bhk && <span className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"><Check className="h-3 w-3" /> {parsed.bhk} BHK read from your brief</span>}{parsed.budget_lakh && <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">around {formatLakhs(parsed.budget_lakh)}</span>}{parsed.tags.map((tag) => <span key={tag} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{tag}</span>)}</div>}</div>{search.data && <p className="font-mono-app text-[10px] uppercase tracking-[.13em] text-muted-foreground" data-testid="text-result-count">{search.data.total_candidates} candidates ranked</p>}</div>
              {search.isLoading && <SearchSkeleton />}
              {search.isError && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-7" data-testid="error-search-results"><p className="font-semibold text-destructive">We could not rank homes for that search.</p><p className="mt-2 text-sm text-muted-foreground">Check the pincode and try once more. Your brief will stay right here.</p><button type="button" onClick={() => search.refetch()} className="focus-ring mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary underline underline-offset-4" data-testid="button-retry-search">Retry search <ArrowRight className="h-3.5 w-3.5" /></button></div>}
              {!search.isLoading && !search.isError && search.data && search.data.results.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card/70 p-10 text-center" data-testid="empty-search-results"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Search className="h-5 w-5" /></div><h3 className="mt-5 font-bold text-foreground">No close matches yet</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Try widening the budget or describing one fewer must-have. The local market read is still useful.</p></div>}
              {!search.isLoading && !search.isError && results.length > 0 && <ListingBrowser listings={results} savedIds={savedIds} onToggleSave={toggleSaved} />}
            </div>}
          </div>
        </section>

        <section id="market" className="relative mx-auto grid max-w-[1480px] gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,.7fr)_minmax(330px,.5fr)] lg:px-12 lg:py-20">
          <div className="self-center"><p className="mb-5 flex items-center gap-2 font-mono-app text-[10px] uppercase tracking-[.18em] text-primary"><span className="h-px w-8 bg-accent" /> context before confidence</p><h2 className="max-w-lg text-[clamp(2.4rem,5vw,5rem)] font-bold leading-[.91] tracking-[-.075em] text-foreground">The street has a <span className="display-serif font-medium italic text-primary">pulse.</span></h2><p className="mt-6 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">A price is only useful when you know what surrounds it. Open a market read for the searched pincode to see inventory, demand, and bands in one place.</p><div className="mt-8 flex items-center gap-3 font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground"><ArrowDown className="h-4 w-4 text-accent" /> scroll for local context</div></div>
          <div><InsightPanel pincode={searchedPincode} submitted={Boolean(submitted)} /></div>
        </section>
      </main>
      <footer className="relative mx-auto flex max-w-[1480px] flex-col gap-3 border-t border-border px-5 py-7 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><p className="font-mono-app uppercase tracking-[.12em]">kimat / estimate with context</p><p className="flex items-center gap-2"><IndianRupee className="h-3 w-3 text-accent" /> Estimates are a starting point, not a promise.</p></footer>
    </div>
  );
}