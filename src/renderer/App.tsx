import { useEffect, useMemo, useRef, useState } from 'react';
import { assessThemeContrast } from '../shared/accessibility';
import { buildAppearanceGuide } from '../shared/appearance-guide';
import type { OfficialCodexStatus } from '../shared/ipc';
import {
  CODE_FONT_FAMILIES,
  UI_FONT_FAMILIES,
  type ActivityLog,
  type StudioState,
  type ThemeRecord,
  type ThemeValues,
} from '../shared/theme';
import type { ApplyResult } from '../shared/adapters';
import type { ThemeRecommendationMode } from '../shared/theme-recommendation';
import { ThemePreview } from './components/ThemePreview';
import { RangeControl } from './components/RangeControl';
import {
  addImportedTheme,
  addTheme,
  appendLog,
  cloneSelectedTheme,
  deleteSelectedTheme,
  getSelectedTheme,
  updateSelectedTheme,
  updateSelectedValues,
} from './state';

type SaveStatus =
  | { kind: 'idle'; message: string }
  | { kind: 'saving'; message: string }
  | { kind: 'saved'; message: string }
  | { kind: 'error'; message: string };

const COLOR_FIELDS: Array<{ key: keyof ThemeValues; label: string }> = [
  { key: 'sidebarColor', label: '사이드바' },
  { key: 'bodyColor', label: '본문' },
  { key: 'inputColor', label: '입력창' },
  { key: 'borderColor', label: '테두리' },
  { key: 'accentColor', label: '강조색' },
  { key: 'foregroundColor', label: '본문 글자' },
  { key: 'mutedForegroundColor', label: '보조 글자' },
  { key: 'inputForegroundColor', label: '입력 글자' },
  { key: 'linkColor', label: '링크' },
  { key: 'selectionColor', label: '선택 영역' },
  { key: 'caretColor', label: '입력 커서' },
];

const RECOMMENDATION_MODES: Array<{ mode: ThemeRecommendationMode; label: string }> = [
  { mode: 'photo', label: '사진 강조' },
  { mode: 'balanced', label: '균형' },
  { mode: 'contrast', label: '가독성 우선' },
];

export function App() {
  const [studio, setStudio] = useState<StudioState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    kind: 'idle',
    message: '작업 공간을 여는 중',
  });
  const [activePanel, setActivePanel] = useState<'image' | 'colors' | 'typography'>('image');
  const [guideStatus, setGuideStatus] = useState<string | null>(null);
  const [codexStatus, setCodexStatus] = useState<OfficialCodexStatus | null>(null);
  const [codexBusy, setCodexBusy] = useState<'apply' | 'restore' | null>(null);
  const [codexRetryRequired, setCodexRetryRequired] = useState(false);
  const [liveUpdateEnabled, setLiveUpdateEnabled] = useState(true);
  const [liveUpdateBusy, setLiveUpdateBusy] = useState(false);
  const [liveUpdateStatus, setLiveUpdateStatus] = useState('적용 뒤 변경 사항을 바로 반영합니다.');
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [recommendationStatus, setRecommendationStatus] = useState<string | null>(null);
  const lastAppliedSignature = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    window.frostline
      .loadState()
      .then((state) => {
        if (!active) return;
        setStudio(appendLog(state, 'info', '저장된 로컬 작업 공간을 불러왔습니다.'));
        setSaveStatus({ kind: 'saved', message: '로컬 데이터 복구 완료' });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setBootError(readError(error));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    window.frostline
      .getOfficialCodexStatus()
      .then((status) => {
        if (active) setCodexStatus(status);
      })
      .catch(() => {
        if (!active) return;
        setCodexStatus({
          available: false,
          canRestore: false,
          requiresCodexExit: false,
          phase: 'unavailable',
          experimental: true,
          message: 'Codex 수동 적용 상태를 확인하지 못했습니다.',
        });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!studio) return;
    const timer = window.setTimeout(() => {
      setSaveStatus({ kind: 'saving', message: '변경 사항 저장 중' });
      window.frostline
        .saveState(studio)
        .then(({ savedAt }) => {
          setSaveStatus({
            kind: 'saved',
            message: `${formatTime(savedAt)} 저장됨`,
          });
        })
        .catch((error: unknown) => {
          setSaveStatus({ kind: 'error', message: `저장 실패: ${readError(error)}` });
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [studio]);

  const selectedTheme = useMemo(
    () => (studio ? getSelectedTheme(studio) : null),
    [studio],
  );
  const appearanceGuide = useMemo(
    () => (selectedTheme ? buildAppearanceGuide(selectedTheme) : ''),
    [selectedTheme],
  );
  const contrastChecks = useMemo(
    () => (selectedTheme ? assessThemeContrast(selectedTheme.values) : []),
    [selectedTheme],
  );

  useEffect(() => {
    if (
      !selectedTheme ||
      codexStatus?.phase !== 'active' ||
      !liveUpdateEnabled ||
      liveUpdateBusy ||
      codexBusy !== null
    ) {
      return;
    }
    const signature = themeSignature(selectedTheme);
    if (lastAppliedSignature.current === signature) return;
    const timer = window.setTimeout(() => {
      setLiveUpdateBusy(true);
      setLiveUpdateStatus('Codex에 변경 사항 반영 중…');
      window.frostline
        .updateOfficialCodexTheme(selectedTheme)
        .then((result) => {
          if (result.ok) {
            lastAppliedSignature.current = signature;
            setLiveUpdateStatus(`Codex에 바로 반영됨 · ${formatTime(result.attemptedAt)}`);
            return;
          }
          setLiveUpdateEnabled(false);
          setLiveUpdateStatus(formatApplyMessage(result));
          setStudio((current) =>
            current ? appendLog(current, 'error', formatApplyMessage(result)) : current,
          );
        })
        .catch((error: unknown) => {
          setLiveUpdateEnabled(false);
          setLiveUpdateStatus(`라이브 갱신 중단: ${readError(error)}`);
        })
        .finally(() => setLiveUpdateBusy(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [selectedTheme, codexStatus?.phase, liveUpdateEnabled, liveUpdateBusy, codexBusy]);

  if (bootError) {
    return (
      <main className="boot-state boot-error">
        <span>!</span>
        <h1>작업 공간을 열지 못했습니다.</h1>
        <p>{bootError}</p>
        <p>원본 설정 파일은 덮어쓰지 않았습니다. 앱을 닫고 로그를 확인해 주세요.</p>
      </main>
    );
  }

  if (!studio || !selectedTheme) {
    return (
      <main className="boot-state">
        <div className="loading-orbit" />
        <h1>Frostline Studio</h1>
        <p>로컬 작업 공간을 준비하고 있습니다.</p>
      </main>
    );
  }

  const updateValues = (patch: Partial<ThemeValues>) => {
    setStudio((current) => (current ? updateSelectedValues(current, patch) : current));
  };

  const chooseImage = async () => {
    try {
      const result = await window.frostline.selectImage();
      if (result.canceled || !result.asset) return;
      setStudio((current) => {
        if (!current) return current;
        return appendLog(
          updateSelectedTheme(current, (theme) => ({ ...theme, image: result.asset! })),
          'success',
          `“${result.asset!.originalName}” 사진을 앱 전용 폴더에 복사했습니다.`,
        );
      });
    } catch (error) {
      recordError(`사진 선택 실패: ${readError(error)}`);
    }
  };

  const recommendPalette = async (mode: ThemeRecommendationMode) => {
    setRecommendationBusy(true);
    setRecommendationStatus(null);
    try {
      const recommendation = await window.frostline.recommendThemePalette(selectedTheme, mode);
      const label = RECOMMENDATION_MODES.find((item) => item.mode === mode)?.label ?? mode;
      setStudio((current) =>
        current
          ? appendLog(
              updateSelectedValues(current, recommendation.values),
              'success',
              `${label} 추천 색상을 적용했습니다. 사진 평균색은 ${recommendation.averageColor}입니다.`,
            )
          : current,
      );
      setRecommendationStatus(
        `${label} 적용 · 평균색 ${recommendation.averageColor} · 밝기 ${Math.round(recommendation.luminance * 100)}%`,
      );
    } catch (error) {
      setRecommendationStatus(`추천 실패: ${readError(error)}`);
      recordError(`사진 기반 색상 추천 실패: ${readError(error)}`);
    } finally {
      setRecommendationBusy(false);
    }
  };

  const exportTheme = async () => {
    try {
      const result = await window.frostline.exportTheme(selectedTheme);
      if (result.canceled) return;
      setStudio((current) =>
        current
          ? appendLog(current, 'success', `테마를 “${result.fileName ?? '파일'}”로 내보냈습니다.`)
          : current,
      );
    } catch (error) {
      recordError(`테마 내보내기 실패: ${readError(error)}`);
    }
  };

  const importTheme = async () => {
    try {
      const result = await window.frostline.importTheme();
      if (result.canceled || !result.theme) return;
      setStudio((current) => (current ? addImportedTheme(current, result.theme!) : current));
    } catch (error) {
      recordError(`테마 가져오기 실패: ${readError(error)}`);
    }
  };

  const copyAppearanceGuide = async () => {
    try {
      await window.frostline.copyAppearanceGuide(appearanceGuide);
      setGuideStatus('클립보드에 복사했습니다.');
      setStudio((current) =>
        current
          ? appendLog(current, 'success', 'Codex Appearance 수동 가이드를 복사했습니다.')
          : current,
      );
    } catch (error) {
      setGuideStatus('복사하지 못했습니다.');
      recordError(`Appearance 가이드 복사 실패: ${readError(error)}`);
    }
  };

  const applyToCodex = async () => {
    const approved = window.confirm(
      '선택한 사진과 색상을 현재 Codex 화면에 한 번 적용합니다. 실행 중인 Codex는 Frostline이 종료하지 않으며, 먼저 직접 완전히 종료하라는 안내가 나올 수 있습니다. 계속할까요?',
    );
    if (!approved) return;
    setCodexBusy('apply');
    try {
      const result = await window.frostline.applyOfficialCodexTheme(selectedTheme);
      setCodexRetryRequired(!result.ok && result.phase !== 'waiting-for-exit');
      if (result.ok) {
        lastAppliedSignature.current = themeSignature(selectedTheme);
        setLiveUpdateEnabled(true);
        setLiveUpdateStatus('라이브 연결됨 · 이후 변경 사항을 바로 반영합니다.');
      }
      setCodexStatus((current) =>
        current
          ? {
              ...current,
              canRestore: result.canRestore ?? current.canRestore,
              requiresCodexExit: result.requiresCodexExit ?? false,
              phase: result.phase ?? current.phase,
              message: result.message,
            }
          : current,
      );
      setStudio((current) =>
        current
          ? appendLog(current, result.ok ? 'success' : 'error', formatApplyMessage(result))
          : current,
      );
    } catch (error) {
      setCodexRetryRequired(true);
      recordError(`Codex 수동 적용 실패: ${readError(error)}`);
    } finally {
      setCodexBusy(null);
    }
  };

  const restoreCodex = async () => {
    const approved = window.confirm(
      '현재 Codex 화면에서 Frostline Studio가 넣은 사진 스킨만 제거할까요? Codex Appearance 설정은 변경하지 않습니다.',
    );
    if (!approved) return;
    setCodexBusy('restore');
    try {
      const result = await window.frostline.restoreOfficialCodexTheme();
      if (result.ok) {
        setCodexRetryRequired(false);
        setLiveUpdateEnabled(false);
        lastAppliedSignature.current = null;
        setLiveUpdateStatus('복원됨 · 라이브 연결이 종료됐습니다.');
      }
      setCodexStatus((current) =>
        current
          ? {
              ...current,
              canRestore: result.canRestore ?? current.canRestore,
              requiresCodexExit: result.requiresCodexExit ?? false,
              phase: result.phase ?? current.phase,
              message: result.message,
            }
          : current,
      );
      setStudio((current) =>
        current
          ? appendLog(current, result.ok ? 'success' : 'error', result.message)
          : current,
      );
    } catch (error) {
      recordError(`Codex 복원 실패: ${readError(error)}`);
    } finally {
      setCodexBusy(null);
    }
  };

  const toggleLiveUpdate = async () => {
    if (liveUpdateEnabled) {
      setLiveUpdateEnabled(false);
      setLiveUpdateStatus('라이브 갱신을 일시정지했습니다.');
      return;
    }
    setLiveUpdateBusy(true);
    setLiveUpdateStatus('라이브 연결 다시 확인 중…');
    try {
      const result = await window.frostline.updateOfficialCodexTheme(selectedTheme);
      setLiveUpdateStatus(formatApplyMessage(result));
      if (result.ok) {
        lastAppliedSignature.current = themeSignature(selectedTheme);
        setLiveUpdateEnabled(true);
      } else {
        setStudio((current) =>
          current ? appendLog(current, 'error', formatApplyMessage(result)) : current,
        );
      }
    } catch (error) {
      setLiveUpdateStatus(`라이브 연결 실패: ${readError(error)}`);
    } finally {
      setLiveUpdateBusy(false);
    }
  };

  const recordError = (message: string) => {
    setStudio((current) => (current ? appendLog(current, 'error', message) : current));
  };

  return (
    <div className="studio-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span>F</span></div>
        <div className="brand-copy">
          <h1>Frostline Studio</h1>
          <p>로컬 테마 작업실 · M3 실험적 수동 적용</p>
        </div>
        <div className={`save-indicator ${saveStatus.kind}`} role="status">
          <i /> {saveStatus.message}
        </div>
      </header>

      <div className="workspace">
        <aside className="theme-rail">
          <div className="rail-heading">
            <div><span className="section-kicker">LIBRARY</span><h2>내 테마</h2></div>
            <button className="icon-button" type="button" onClick={() => setStudio(addTheme(studio))} aria-label="새 테마">＋</button>
          </div>

          <div className="theme-list">
            {studio.themes.map((theme, index) => (
              <button
                className={`theme-card ${theme.id === studio.selectedThemeId ? 'selected' : ''}`}
                key={theme.id}
                type="button"
                onClick={() => setStudio({ ...studio, selectedThemeId: theme.id })}
              >
                <span className="theme-swatch" style={{ background: theme.values.accentColor }}>
                  {theme.image ? <img src={theme.image.url} alt="" /> : <i />}
                </span>
                <span><strong>{theme.name}</strong><small>테마 {String(index + 1).padStart(2, '0')}</small></span>
                <b aria-hidden="true">›</b>
              </button>
            ))}
          </div>

          <div className="rail-actions">
            <button type="button" onClick={() => setStudio(cloneSelectedTheme(studio))}>복제</button>
            <button type="button" onClick={() => setStudio(deleteSelectedTheme(studio))} disabled={studio.themes.length <= 1}>삭제</button>
          </div>
          <div className="file-actions">
            <button type="button" onClick={importTheme}>↑ 가져오기</button>
            <button type="button" onClick={exportTheme}>↓ 내보내기</button>
          </div>

          <section className="integration-card" aria-label="Codex 연동 상태">
            <div className="status-line"><i /> {codexStatus?.phase === 'active' ? '사진 스킨 적용됨' : codexStatus?.requiresCodexExit ? '사용자 종료 대기' : codexStatus?.available ? '수동 1회 적용 가능' : '미리보기 전용'}</div>
            <h3>{codexStatus?.available ? '실험적 CDP Runtime Adapter' : '안전한 PreviewAdapter'}</h3>
            <p>{codexStatus?.message ?? 'Codex 연동 상태를 확인하고 있습니다.'}</p>
          </section>
        </aside>

        <main className="studio-main">
          <section className="preview-section">
            <div className="section-heading">
              <div><span className="section-kicker">LIVE CANVAS</span><h2>실시간 미리보기</h2></div>
              <span className="preview-badge"><i /> LIVE</span>
            </div>
            <ThemePreview theme={selectedTheme} />
          </section>

          <section className="editor-panel">
            <div className="editor-title-row">
              <label className="theme-name-field">
                <span>테마 이름</span>
                <input
                  value={selectedTheme.name}
                  maxLength={80}
                  onChange={(event) => {
                    const name = event.currentTarget.value;
                    if (!name) return;
                    setStudio(updateSelectedTheme(studio, (theme) => ({ ...theme, name })));
                  }}
                />
              </label>
              <div className="segmented-tabs" role="tablist" aria-label="편집 패널">
                <button type="button" role="tab" aria-selected={activePanel === 'image'} className={activePanel === 'image' ? 'active' : ''} onClick={() => setActivePanel('image')}>사진</button>
                <button type="button" role="tab" aria-selected={activePanel === 'colors'} className={activePanel === 'colors' ? 'active' : ''} onClick={() => setActivePanel('colors')}>색상</button>
                <button type="button" role="tab" aria-selected={activePanel === 'typography'} className={activePanel === 'typography' ? 'active' : ''} onClick={() => setActivePanel('typography')}>글꼴·표면</button>
              </div>
            </div>

            {activePanel === 'image' ? (
              <div className="control-grid image-controls">
                <div className="image-picker-card">
                  <div className="image-thumb">
                    {selectedTheme.image ? <img src={selectedTheme.image.url} alt="선택한 배경" /> : <span>IMG</span>}
                  </div>
                  <div><strong>{selectedTheme.image?.originalName ?? '사진을 선택하세요'}</strong><small>원본이 이동해도 앱 전용 복사본을 사용합니다.</small></div>
                  <button type="button" onClick={chooseImage}>사진 선택</button>
                </div>

                <div className="recommendation-card">
                  <div>
                    <strong>사진 기반 색상 추천</strong>
                    <small>사진 평균색으로 UI 색과 글자 대비를 함께 맞춥니다.</small>
                  </div>
                  <div className="recommendation-buttons">
                    {RECOMMENDATION_MODES.map(({ mode, label }) => (
                      <button
                        type="button"
                        key={mode}
                        disabled={!selectedTheme.image || recommendationBusy}
                        onClick={() => void recommendPalette(mode)}
                      >{label}</button>
                    ))}
                  </div>
                  {recommendationStatus && <span role="status">{recommendationStatus}</span>}
                </div>

                <div className="fit-control">
                  <span>맞춤 방식</span>
                  <div>
                    <button type="button" className={selectedTheme.values.backgroundFit === 'cover' ? 'active' : ''} onClick={() => updateValues({ backgroundFit: 'cover' })}>Cover</button>
                    <button type="button" className={selectedTheme.values.backgroundFit === 'contain' ? 'active' : ''} onClick={() => updateValues({ backgroundFit: 'contain' })}>Contain</button>
                  </div>
                </div>
                <RangeControl label="가로 위치" min={0} max={100} value={selectedTheme.values.backgroundX} onChange={(backgroundX) => updateValues({ backgroundX })} />
                <RangeControl label="세로 위치" min={0} max={100} value={selectedTheme.values.backgroundY} onChange={(backgroundY) => updateValues({ backgroundY })} />
                <RangeControl label="배경 크기" min={50} max={200} value={selectedTheme.values.backgroundScale} onChange={(backgroundScale) => updateValues({ backgroundScale })} />
                <RangeControl label="밝기" min={20} max={160} value={selectedTheme.values.brightness} onChange={(brightness) => updateValues({ brightness })} />
                <RangeControl label="채도" min={0} max={200} value={selectedTheme.values.saturation} onChange={(saturation) => updateValues({ saturation })} />
                <RangeControl label="대비" min={50} max={180} value={selectedTheme.values.contrast} onChange={(contrast) => updateValues({ contrast })} />
                <RangeControl label="블러" min={0} max={24} value={selectedTheme.values.blur} suffix="px" onChange={(blur) => updateValues({ blur })} />
              </div>
            ) : activePanel === 'colors' ? (
              <div className="color-editor-stack">
                <div className="control-grid color-controls">
                  <label className="color-control overlay-color"><span>어두운 오버레이</span><div><input aria-label="오버레이 색상" type="color" value={selectedTheme.values.overlayColor} onChange={(event) => updateValues({ overlayColor: event.currentTarget.value })} /><code>{selectedTheme.values.overlayColor}</code></div></label>
                  <RangeControl label="오버레이 투명도" min={0} max={100} value={selectedTheme.values.overlayOpacity} onChange={(overlayOpacity) => updateValues({ overlayOpacity })} />
                  {COLOR_FIELDS.map(({ key, label }) => (
                    <label className="color-control" key={key}>
                      <span>{label}</span>
                      <div><input aria-label={`${label} 색상`} type="color" value={String(selectedTheme.values[key])} onChange={(event) => updateValues({ [key]: event.currentTarget.value })} /><code>{String(selectedTheme.values[key])}</code></div>
                    </label>
                  ))}
                </div>

                <section className="appearance-guide" aria-label="Codex Appearance 수동 가이드">
                  <div className="appearance-guide-copy">
                    <span className="section-kicker">SAFE HANDOFF</span>
                    <h3>Codex Appearance 수동 가이드</h3>
                    <p>공식 앱의 <code>Ctrl+, → Appearance</code>에 직접 옮길 색상값을 복사합니다. Codex에는 자동으로 적용하지 않습니다.</p>
                    <button type="button" onClick={copyAppearanceGuide}>Appearance 가이드 복사</button>
                    {guideStatus && <span className="guide-status" role="status">{guideStatus}</span>}
                  </div>
                  <div className="contrast-summary" aria-label="접근성 대비 검사">
                    <strong>WCAG AA 대비 참고</strong>
                    {contrastChecks.map((check) => (
                      <div className={check.passes ? 'pass' : 'review'} key={check.id}>
                        <span>{check.label}</span>
                        <b>{check.ratio.toFixed(2)}:1</b>
                        <em>{check.passes ? '통과' : '검토 필요'}</em>
                      </div>
                    ))}
                    <small>일반 텍스트는 4.5:1을 기준으로 봅니다. 검토 필요 값은 실제 표시에서 대비가 높은 흑백으로 안전 보정합니다.</small>
                  </div>
                </section>
              </div>
            ) : (
              <div className="typography-editor">
                <div className="font-control-grid">
                  <label>
                    <span>UI 글꼴</span>
                    <select
                      value={selectedTheme.values.uiFontFamily}
                      onChange={(event) => updateValues({ uiFontFamily: event.currentTarget.value as ThemeValues['uiFontFamily'] })}
                    >
                      {UI_FONT_FAMILIES.map((font) => <option key={font} value={font}>{font}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>코드 글꼴</span>
                    <select
                      value={selectedTheme.values.codeFontFamily}
                      onChange={(event) => updateValues({ codeFontFamily: event.currentTarget.value as ThemeValues['codeFontFamily'] })}
                    >
                      {CODE_FONT_FAMILIES.map((font) => <option key={font} value={font}>{font}</option>)}
                    </select>
                  </label>
                  <RangeControl label="글자 크기" min={80} max={125} value={selectedTheme.values.fontScale} suffix="%" onChange={(fontScale) => updateValues({ fontScale })} />
                </div>

                <div className="surface-control-grid">
                  <RangeControl label="사이드바 불투명도" min={0} max={100} value={selectedTheme.values.sidebarOpacity} onChange={(sidebarOpacity) => updateValues({ sidebarOpacity })} />
                  <RangeControl label="본문 불투명도" min={0} max={100} value={selectedTheme.values.bodyOpacity} onChange={(bodyOpacity) => updateValues({ bodyOpacity })} />
                  <RangeControl label="입력창 불투명도" min={0} max={100} value={selectedTheme.values.inputOpacity} onChange={(inputOpacity) => updateValues({ inputOpacity })} />
                  <RangeControl label="카드 불투명도" min={0} max={100} value={selectedTheme.values.cardOpacity} onChange={(cardOpacity) => updateValues({ cardOpacity })} />
                </div>

                <div className="font-sample" style={{ fontFamily: selectedTheme.values.uiFontFamily }}>
                  <strong>Frostline Studio 미리보기</strong>
                  <p>한글과 English UI 글꼴이 실제 Codex 적용값과 같은 토큰을 사용합니다.</p>
                  <code style={{ fontFamily: selectedTheme.values.codeFontFamily }}>const theme = 'frostline';</code>
                </div>
              </div>
            )}
          </section>

          <section className="future-controls" aria-label="Codex 적용 기능">
            <div><span className="section-kicker">CODEX INTEGRATION</span><h2>사진 스킨 적용 및 복원</h2><p>최초 적용 뒤에는 같은 검증된 세션에서 편집값을 바로 갱신합니다. 실패하면 라이브 갱신을 잠그며 자동 재시도하지 않습니다.</p><span className={`live-update-status ${liveUpdateEnabled ? 'connected' : ''}`}>{liveUpdateBusy ? '반영 중…' : liveUpdateStatus}</span></div>
            <div className="future-buttons">
              <button
                type="button"
                onClick={applyToCodex}
                disabled={!codexStatus?.available || codexBusy !== null || codexStatus.phase === 'active'}
                title={codexStatus?.phase === 'active' ? '현재 스킨을 먼저 복원하세요' : '사진과 색상을 한 번 적용'}
              >{codexBusy === 'apply' ? '적용 중…' : codexStatus?.phase === 'waiting-for-exit' ? '종료 후 적용 계속' : codexRetryRequired ? '수동 재시도' : 'Codex에 적용'}</button>
              <button
                type="button"
                onClick={restoreCodex}
                disabled={!codexStatus?.available || codexBusy !== null || !codexStatus.canRestore}
                title="현재 Codex 화면에서 Frostline 사진 스킨만 제거"
              >{codexBusy === 'restore' ? '복원 중…' : '복원'}</button>
              <button
                type="button"
                onClick={() => void toggleLiveUpdate()}
                disabled={codexStatus?.phase !== 'active' || codexBusy !== null || liveUpdateBusy}
                title="현재 검증된 Codex 세션의 테마를 다시 연결하거나 일시정지"
              >{liveUpdateEnabled ? '라이브 갱신 일시정지' : '라이브 연결 다시 시작'}</button>
              <button type="button" disabled title="M4 승인 뒤 제공">자동 적용 켜기</button>
              <button className="danger" type="button" disabled title="M4 승인 뒤 제공">비상 정지</button>
            </div>
          </section>

          <section className="activity-panel">
            <div className="section-heading compact"><div><span className="section-kicker">ACTIVITY</span><h2>실행 로그</h2></div><span>최근 {Math.min(studio.logs.length, 6)}건</span></div>
            <div className="log-list">
              {studio.logs.slice(0, 6).map((log) => <LogRow key={log.id} log={log} />)}
              {studio.logs.length === 0 && <p className="empty-log">아직 기록된 로컬 작업이 없습니다.</p>}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function LogRow({ log }: { log: ActivityLog }) {
  return (
    <div className={`log-row ${log.level}`}>
      <i />
      <span>{log.message}</span>
      <time dateTime={log.createdAt}>{formatTime(log.createdAt)}</time>
    </div>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
}

function themeSignature(theme: ThemeRecord): string {
  return JSON.stringify({ image: theme.image?.assetId ?? null, values: theme.values });
}

function formatApplyMessage(result: ApplyResult): string {
  const diagnostic = [result.stage, result.diagnosticCode].filter(Boolean).join('/');
  return diagnostic ? `${result.message} [${diagnostic}]` : result.message;
}
