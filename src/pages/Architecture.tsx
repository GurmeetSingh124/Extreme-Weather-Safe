import { useMemo, useState } from 'react';
import {
  ArrowDown, ArrowRight, Brain, Check, ChevronRight, Cpu, Database, Eye, GitBranch, Layers,
  Radio, Route, Server, ShieldAlert, Sparkles, Target, Workflow, Zap,
} from 'lucide-react';
import { PIPELINE } from '../data/engine';
import { api } from '../services/api';
import { DemoTag, Metric, Panel } from '../components/common/ui';
import { PageHead } from './Overview';
import { cn, fmtNum } from '../lib/utils';

const NODE_ICONS = [Radio, Database, Workflow, Brain, Target, Route, Sparkles, ShieldAlert, Layers, Zap];

const TECH = {
  frontend: ['React 18 + TypeScript', 'Vite 5', 'Tailwind CSS 3', 'Google Maps JS API', 'Recharts 2', 'Zustand 5', 'Lucide icons'],
  backend: ['FastAPI + Uvicorn', 'Pydantic v2 models', 'Celery / Airflow orchestration', 'WebSocket alert push'],
  data: ['Python · NumPy · Pandas', 'xarray + Dask for GRIB/NetCDF', 'PostgreSQL 16 + PostGIS 3', 'Zarr / COG tile store', 'Redis cache'],
  ai: ['PyTorch · ConvLSTM forecaster', 'Convolutional autoencoder anomaly detector', 'scikit-learn GBDT ETA regressor', 'SciPy Hungarian assignment', 'Kalman smoother'],
  geo: ['Google Maps ImageMapType field overlays', 'GeoJSON vector overlays', 'Web-mercator rasterisation of regular lat/lon grids', 'PostGIS spatial aggregation'],
};

export function Architecture() {
  const [sel, setSel] = useState<string>('anomaly');
  const nodes = PIPELINE;
  const active = nodes.find((n) => n.id === sel) ?? nodes[0];

  const totalMs = nodes.reduce((s, n) => s + n.ms, 0);

  return (
    <div className="space-y-3 p-3">
      <PageHead
        icon={<Cpu size={16} />}
        title="System Architecture"
        sub="End-to-end pipeline from medium-range forecast ingest to GIS visualisation and alert generation"
        right={<DemoTag />}
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
        {/* pipeline */}
        <Panel title="Processing pipeline" icon={<Workflow size={13} className="text-brand-400" />} sub={`selected: ${active.label} · total batched runtime ${fmtNum(totalMs)} ms`} dense>
          <div className="space-y-1.5 p-3">
            {nodes.map((n, i) => {
              const on = n.id === sel;
              return (
                <div key={n.id}>
                  <button
                    onClick={() => setSel(n.id)}
                    className={cn(
                      'arch-node w-full rounded-xl border px-3 py-2.5 text-left transition-all',
                      on ? 'border-brand-500/55 bg-brand-500/12 shadow-glow' : 'border-edge bg-ink-850/55 hover:border-edge2 hover:bg-ink-800/75'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-[13px]', on ? 'border-brand-500/50 bg-brand-500/16' : 'border-edge bg-ink-800/70')}>
                        {(() => {
                          const IconComp = NODE_ICONS[i] ?? Workflow;
                          return <IconComp size={14} className={on ? 'text-brand-300' : 'text-txt-lo'} />;
                        })()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="mono text-[10px] text-txt-lo">{String(i + 1).padStart(2, '0')}</span>
                          <span className={cn('truncate text-[12px] font-semibold', on ? 'text-brand-400' : 'text-txt-hi')}>{n.label}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-txt-lo">{n.tech}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="mono text-[10.5px] font-semibold text-txt-mid">{n.ms} ms</div>
                        <div className="mono text-[9px] text-txt-lo">{n.io}</div>
                      </div>
                      <ChevronRight size={14} className={cn('shrink-0 transition', on ? 'text-brand-400' : 'text-txt-lo')} />
                    </div>
                  </button>
                  {i < nodes.length - 1 && (
                    <div className="relative ml-[26px] flex h-4 items-center">
                      <div className="flow-line h-full w-px" />
                      <span className="flow-dot absolute left-[-2px] h-1.5 w-1.5 rounded-full bg-brand-400" style={{ animationDelay: `${i * 0.22}s` }} />
                      <span className="ml-3 mono text-[9px] text-txt-lo">
                        {i === 0 ? 'GRIB2 → Zarr' : i === 3 ? 'grid → objects' : i === 5 ? 'objects → tracks' : i === 7 ? 'tracks → risk' : 'in-memory handoff'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        {/* node detail + stack */}
        <div className="space-y-3">
          <Panel title={active.label} icon={<Target size={13} className="text-brand-400" />} sub={active.tech} dense>
            <div className="space-y-2.5 p-3">
              <p className="text-[11.5px] leading-relaxed text-txt-mid">{active.detail}</p>
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Input / output" value={<span className="text-[11px]">{active.io}</span>} mono={false} />
                <Metric label="Stage runtime" value={String(active.ms)} unit="ms" />
              </div>
              <div className="rounded-lg border hairline bg-ink-850/50 px-2.5 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-txt-lo">Stage contract</div>
                <pre className="mono mt-1 overflow-x-auto text-[10px] leading-relaxed text-txt-mid">{payloadFor(active.id)}</pre>
              </div>
            </div>
          </Panel>

          <Panel title="Technology stack" icon={<Server size={13} className="text-emerald-400" />} dense>
            <div className="space-y-2.5 p-3">
              {(Object.keys(TECH) as (keyof typeof TECH)[]).map((k) => (
                <div key={k}>
                  <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-txt-lo">{k}</div>
                  <div className="flex flex-wrap gap-1">
                    {TECH[k].map((x) => (
                      <span key={x} className="chip border-edge bg-ink-800/60 text-txt-mid">{x}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Deployment topology" icon={<GitBranch size={13} className="text-violet-300" />} dense>
            <div className="space-y-1.5 p-3 text-[11px] text-txt-mid">
              {[
                ['Scheduler', 'Airflow DAG triggers every 6 h on the 00Z / 06Z / 12Z / 18Z cycles'],
                ['Ingest workers', 'Dask cluster pulls GRIB2 from IMD / NCMRWF / ECMWF open endpoints'],
                ['Inference', 'GPU worker runs the autoencoder + ConvLSTM, writes tracks to PostGIS'],
                ['API', 'FastAPI serves events, fields, regions, compounds and alerts'],
                ['Frontend', 'React SPA renders Google Maps overlays and consumes the API service layer'],
                ['Alerts', 'Rule engine pushes deduplicated alerts over WebSocket to dashboards'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <div>
                    <span className="font-semibold text-txt-hi">{k}: </span>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* data flow ribbon */}
      <Panel title="Data contract flow" icon={<Route size={13} className="text-brand-400" />} sub="shape of the payload handed between stages" dense>
        <div className="overflow-x-auto p-3">
          <div className="flex min-w-[900px] items-stretch gap-2">
            {[
              { t: 'Forecast field', d: '192 × 128 × 120 · lat/lon/time · float32', c: '#4dc4ff' },
              { t: 'Anomaly field', d: 'z-score per cell vs daily climatology', c: '#5eead4' },
              { t: 'Event objects', d: 'id, area, centroid, peak, t_start', c: '#c084fc' },
              { t: 'Tracks', d: 'linked objects · Kalman-smoothed positions', c: '#eab308' },
              { t: 'Forecast', d: 'intensity(t), extent(t), ETA per region', c: '#a78bfa' },
              { t: 'Risk field', d: '0–100 composite per administrative unit', c: '#f97316' },
              { t: 'Alerts', d: 'severity, region, event_id, narrative', c: '#ef4444' },
            ].map((s, i, arr) => (
              <div key={s.t} className="flex items-center gap-2">
                <div className="w-[136px] rounded-lg border px-2.5 py-2" style={{ borderColor: `${s.c}55`, background: `${s.c}12` }}>
                  <div className="text-[11px] font-semibold" style={{ color: s.c }}>{s.t}</div>
                  <div className="mt-0.5 text-[9.5px] leading-snug text-txt-lo">{s.d}</div>
                </div>
                {i < arr.length - 1 && <ArrowRight size={14} className="shrink-0 text-txt-lo" />}
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function payloadFor(id: string) {
  const map: Record<string, string> = {
    ingest: `GET  /forecast/{cycle}/{run}
  var: [t2m, tp, u10, v10, msl, rh850]
  grid: 0.25°   steps: 121   format: GRIB2`,
    ingestion: `store.dataset("cycle_00z")
  .chunk({ time: 12, lat: 64, lon: 64 })
  .validate(checksum=True)`,
    preprocess: `regrid(target="common_0.25")
debiaise(reference="era5_daily")
mask(quality< 0.9)`,
    anomaly: `z = (x - clim.mean) / clim.std
residual = autoencoder.encode(x)
anomaly = 0.7*z_norm + 0.3*residual_norm`,
    identify: `labels = conncomp(anomaly >= 1.8)
objects = regionprops(labels)
  .filter(area_km2 > 5000)`,
    track: `cost = 0.5*d_centroid + 0.3*d_area + 0.2*d_type
assign  = hungarian(prev, curr, cost)
track   = kalman_smooth(assign)`,
    forecast: `intensity = convlstm(track, horizon=120)
eta       = gbdt(track.features) -> region, hours
uncertainty(lead_t) = 95 + lead_t * 15  # km`,
    risk: `risk = w1*hazard + w2*exposure
     + w3*(1 - confidence) + compound_bonus`,
    gis: `raster:  field -> 1024x1024 canvas -> image source
vector:  tracks, corridors, ETA, markers
crs:     EPSG:3857 (web mercator)`,
    alert: `if severity >= HIGH and confidence >= 60:
    emit Alert(id, severity, region, event_id)
    dedupe(window=6h)`,
  };
  return map[id] ?? '—';
}

export function SystemData() {
  const [meta, setMeta] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  useMemo(() => {
    api.meta().then(setMeta);
    api.health().then(setHealth);
  }, []);

  return (
    <div className="space-y-3 p-3">
      <PageHead icon={<Database size={16} />} title="AI &amp; Data" sub="Data sources, model cards and service status for the prototype" right={<DemoTag />} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Data sources" icon={<Database size={13} className="text-brand-400" />} sub="intended production inputs" dense>
          <div className="space-y-2 p-3">
            {(meta?.datasets ?? []).map((d: any) => (
              <div key={d.name} className="rounded-lg border hairline bg-ink-850/50 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-semibold text-txt-hi">{d.name}</span>
                  <span className="chip border-edge bg-ink-800/60 text-txt-lo">{d.role}</span>
                </div>
                <div className="mono mt-0.5 text-[10px] text-txt-mid">{d.src}</div>
                <div className="mono text-[9.5px] text-txt-lo">{d.res}</div>
              </div>
            ))}
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-2.5 py-2">
              <div className="flex items-start gap-2">
                <ShieldAlert size={12} className="mt-0.5 shrink-0 text-amber-300" />
                <p className="text-[10.5px] leading-snug text-amber-100/80">
                  This prototype is <strong>not connected</strong> to any live meteorological feed. All fields, tracks,
                  statistics and alerts are produced by a deterministic demo engine. The service layer is shaped so a real
                  FastAPI backend can replace it endpoint-for-endpoint.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Model cards" icon={<Brain size={13} className="text-violet-300" />} sub="model confidence as reported by the prototype" dense>
            <div className="space-y-2 p-3">
              {(meta?.models ?? []).map((m: any) => (
                <div key={m.name} className="rounded-lg border hairline bg-ink-850/50 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-semibold text-txt-hi">{m.name}</span>
                    <span className="mono ml-auto text-[10.5px] font-semibold text-emerald-300">{m.conf}%</span>
                  </div>
                  <div className="mono mt-0.5 text-[10px] text-txt-mid">{m.tech}</div>
                  <div className="mt-0.5 text-[10px] leading-snug text-txt-lo">{m.note}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Service status" icon={<Radio size={13} className="text-emerald-400" />} sub="mock API layer (USE_MOCK_API = true)" dense>
            <div className="space-y-2 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Status" value={<span className="text-emerald-300">● {health?.status ?? '…'}</span>} mono={false} />
                <Metric label="Mode" value={health?.mode ?? 'DEMO'} hint={health?.dataset} />
                <Metric label="Requests served" value={String(health?.requests ?? 0)} />
                <Metric label="Resolution" value={health?.resolutionDeg ?? 0.25} unit="°" />
              </div>
              <div className="rounded-lg border hairline bg-ink-850/50 px-2.5 py-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-txt-lo">Observed endpoints</div>
                <div className="mono space-y-0.5 text-[10px] text-txt-mid">
                  {(health?.endpoints ?? []).map((e: string) => (
                    <div key={e} className="flex items-center gap-1.5"><Check size={9} className="text-emerald-400" /> {e}</div>
                  ))}
                  {!health?.endpoints?.length && <div className="text-txt-lo">No requests yet this session.</div>}
                </div>
              </div>
              <div className="rounded-lg border hairline bg-ink-850/50 px-2.5 py-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-txt-lo">API surface (mock — mirrors FastAPI routes)</div>
                <pre className="mono overflow-x-auto text-[9.5px] leading-relaxed text-txt-mid">{`GET /api/v1/health
GET /api/v1/events?t={hours}
GET /api/v1/events/{id}
GET /api/v1/field/{layer}?t={hours}
GET /api/v1/field/wind-vectors?t={hours}
GET /api/v1/regions/risk?t={hours}
GET /api/v1/compounds?t={hours}
GET /api/v1/alerts?t={hours}
GET /api/v1/stats?t={hours}
GET /api/v1/analytics/history?t={hours}
GET /api/v1/analytics/outlook?t={hours}
GET /api/v1/meta`}</pre>
              </div>
              <div className="text-[10px] leading-snug text-txt-lo">
                Every component reads through <span className="mono text-txt-mid">src/services/api.ts</span>. Switching
                <span className="mono text-txt-mid"> USE_MOCK_API</span> to false and pointing
                <span className="mono text-txt-mid"> VITE_API_BASE</span> at a live backend connects real data without
                touching a single UI file.
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Client-side render budget" icon={<Zap size={13} className="text-amber-300" />} sub="how the interface stays smooth" dense>
        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Field rasterisation', '57×57 grid sampled into a 1024×1024 web-mercator canvas, then uploaded once per layer per timeline step.'],
            ['Layer lifecycle', 'Overlay map types are created once at load; frames only mutate data and paint properties.'],
            ['Track updates', 'GeoJSON setData calls are batched into a single requestAnimationFrame per state change.'],
            ['Wind particles', 'Particle vectors sampled from a 57×57 vector field; population scales with viewport area and pauses when hidden.'],
            ['Memoised selectors', 'Snapshot, region-risk and compound results are cached per 0.5 h timeline step.'],
            ['Debounced search', 'Search queries resolve after 180 ms of idle typing across the place + event index.'],
            ['Lazy panel mounting', 'Detail drawers and analytics panels mount only when opened.'],
            ['Chart throttling', 'Series are sub-sampled (every 2nd–3rd keyframe) before reaching Recharts.'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border hairline bg-ink-850/50 px-2.5 py-2">
              <div className="text-[11px] font-semibold text-txt-hi">{k}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-txt-lo">{v}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <DemoTag />
        <span className="text-[10px] text-txt-lo">Model confidence values describe prototype behaviour, not validated operational skill.</span>
      </div>
    </div>
  );
}


