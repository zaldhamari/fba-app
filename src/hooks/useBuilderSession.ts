import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import type {
  BuilderSession, BuilderStage, StageStatus,
  DiscoveryData, AnalysisData, SupplierData,
  FreightData, CalculationsData, BrandData, WinnerEntry,
} from '../types/builder';
import { createSession, nextStage, STAGE_ORDER } from '../types/builder';

function genId(): string {
  return 'bld_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function loadSessions(): Promise<BuilderSession[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.builderSessions);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveSessions(sessions: BuilderSession[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.builderSessions, JSON.stringify(sessions));
}

async function loadVault(): Promise<WinnerEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.winnerVault);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveVault(vault: WinnerEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.winnerVault, JSON.stringify(vault));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBuilderSession() {
  const [sessions,     setSessions]     = useState<BuilderSession[]>([]);
  const [vault,        setVault]        = useState<WinnerEntry[]>([]);
  const [loaded,       setLoaded]       = useState(false);

  useEffect(() => {
    Promise.all([loadSessions(), loadVault()])
      .then(([s, v]) => { setSessions(s); setVault(v); })
      .finally(() => setLoaded(true));
  }, []);

  const activeSession = sessions.find(s => s.status === 'active') ?? null;
  const archivedSessions = sessions.filter(s => s.status !== 'active');

  // ── Mutate helpers ────────────────────────────────────────────────────────

  const _update = useCallback(async (updated: BuilderSession) => {
    updated.updatedAt = new Date().toISOString();
    setSessions(prev => {
      const next = prev.map(s => s.id === updated.id ? updated : s);
      saveSessions(next);
      return next;
    });
  }, []);

  // ── Session lifecycle ─────────────────────────────────────────────────────

  const startNewSession = useCallback(async (): Promise<BuilderSession> => {
    const session = createSession(genId());
    setSessions(prev => {
      const next = [...prev, session];
      saveSessions(next);
      return next;
    });
    return session;
  }, []);

  const abandonSession = useCallback(async (sessionId: string) => {
    setSessions(prev => {
      const next = prev.map(s =>
        s.id === sessionId ? { ...s, status: 'abandoned' as const, updatedAt: new Date().toISOString() } : s
      );
      saveSessions(next);
      return next;
    });
  }, []);

  // ── Stage data writers ────────────────────────────────────────────────────

  function _advance(session: BuilderSession, stage: BuilderStage, status: StageStatus): BuilderSession {
    const next = nextStage(stage);
    const updatedStages = {
      ...session.stages,
      [stage]: status,
      ...(next ? { [next]: 'active' as StageStatus } : {}),
    };
    return {
      ...session,
      stages: updatedStages,
      currentStage: next ?? stage,
    };
  }

  const completeDiscovery = useCallback(async (sessionId: string, data: DiscoveryData) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const updated = _advance({ ...session, discovery: data }, 'discovery', 'passed');
    await _update(updated);
  }, [sessions, _update]);

  const completeAnalysis = useCallback(async (sessionId: string, data: AnalysisData) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const status: StageStatus = data.userOverride ? 'soft_fail' : 'passed';
    const updated = _advance({ ...session, analysis: data }, 'analysis', status);
    await _update(updated);
  }, [sessions, _update]);

  const completeSupplier = useCallback(async (sessionId: string, data: SupplierData) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const updated = _advance({ ...session, supplier: data }, 'supplier', 'passed');
    await _update(updated);
  }, [sessions, _update]);

  const completeFreight = useCallback(async (sessionId: string, data: FreightData) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const updated = _advance({ ...session, freight: data }, 'freight', 'passed');
    await _update(updated);
  }, [sessions, _update]);

  const completeCalculations = useCallback(async (sessionId: string, data: CalculationsData) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const status: StageStatus = data.verdict === 'unprofitable' ? 'soft_fail' : 'passed';
    const updated = _advance({ ...session, calculations: data }, 'calculations', status);
    await _update(updated);
  }, [sessions, _update]);

  const completeBrand = useCallback(async (sessionId: string, data: BrandData) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const updated = _advance({ ...session, brand: data }, 'brand', 'passed');
    await _update(updated);
  }, [sessions, _update]);

  // Allow going back to change a stage choice ─────────────────────────────────

  const goBackToStage = useCallback(async (sessionId: string, stage: BuilderStage) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const stageIdx = STAGE_ORDER.indexOf(stage);
    const updatedStages = { ...session.stages };
    STAGE_ORDER.forEach((s, i) => {
      if (i === stageIdx) updatedStages[s] = 'active';
      else if (i > stageIdx) updatedStages[s] = 'locked';
    });
    const dataReset: Partial<BuilderSession> = {};
    if (stageIdx <= STAGE_ORDER.indexOf('discovery'))    dataReset.discovery    = null;
    if (stageIdx <= STAGE_ORDER.indexOf('analysis'))     dataReset.analysis     = null;
    if (stageIdx <= STAGE_ORDER.indexOf('supplier'))     dataReset.supplier     = null;
    if (stageIdx <= STAGE_ORDER.indexOf('freight'))      dataReset.freight      = null;
    if (stageIdx <= STAGE_ORDER.indexOf('calculations')) dataReset.calculations = null;
    if (stageIdx <= STAGE_ORDER.indexOf('brand'))        dataReset.brand        = null;
    const updated: BuilderSession = {
      ...session, ...dataReset,
      stages: updatedStages,
      currentStage: stage,
    };
    await _update(updated);
  }, [sessions, _update]);

  // ── Reload vault from storage (call on screen focus) ─────────────────────

  const reloadVault = useCallback(async () => {
    const v = await loadVault();
    setVault(v);
  }, []);

  // ── Publish to Winner Vault ───────────────────────────────────────────────

  const publishToVault = useCallback(async (sessionId: string): Promise<WinnerEntry | null> => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session?.calculations || !session?.brand || !session?.discovery ||
        !session?.supplier || !session?.freight) return null;

    const entry: WinnerEntry = {
      sessionId,
      completedAt:      new Date().toISOString(),
      productTitle:     session.brand.productTitle || session.discovery.product.title,
      brandName:        session.brand.brandName,
      marketplace:      session.discovery.marketplace,
      sellingPrice:     session.calculations.sellingPrice,
      unitCost:         session.supplier.unitCost,
      marginPct:        session.calculations.marginPct,
      roiPct:           session.calculations.roiPct,
      monthlyProfitEst: session.calculations.monthlyProfitEst,
      supplierName:     session.supplier.name,
      freightMode:      session.freight.modeLabel,
      freightPerUnit:   session.freight.costPerUnit,
    };

    const updatedSession: BuilderSession = {
      ...session,
      status:      'complete',
      winnerEntry: entry,
      stages:      { ...session.stages, complete: 'passed' },
      currentStage: 'complete',
    };
    await _update(updatedSession);

    const newVault = [...vault, entry];
    setVault(newVault);
    await saveVault(newVault);
    return entry;
  }, [sessions, vault, _update]);

  return {
    loaded,
    activeSession,
    archivedSessions,
    vault,
    reloadVault,
    startNewSession,
    abandonSession,
    goBackToStage,
    completeDiscovery,
    completeAnalysis,
    completeSupplier,
    completeFreight,
    completeCalculations,
    completeBrand,
    publishToVault,
  };
}
