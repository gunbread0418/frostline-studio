import { useEffect, useMemo, useState } from 'react';
import type { ActivityLog, StudioState, ThemeValues } from '../shared/theme';
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
];

export function App() {
  const [studio, setStudio] = useState<StudioState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    kind: 'idle',
    message: '작업 공간을 여는 중',
  });
  const [activePanel, setActivePanel] = useState<'image' | 'colors'>('image');

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

  const recordError = (message: string) => {
    setStudio((current) => (current ? appendLog(current, 'error', message) : current));
  };

  return (
    <div className="studio-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span>F</span></div>
        <div className="brand-copy">
          <h1>Frostline Studio</h1>
          <p>로컬 테마 작업실 · 미리보기 전용</p>
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
            <div className="status-line"><i /> 실제 적용 안 함</div>
            <h3>안전한 PreviewAdapter</h3>
            <p>현재 화면은 독립 미리보기입니다. Codex 프로세스와 설치 파일에는 접근하지 않습니다.</p>
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
            ) : (
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
            )}
          </section>

          <section className="future-controls" aria-label="향후 Codex 적용 기능">
            <div><span className="section-kicker">CODEX INTEGRATION</span><h2>적용 및 자동화</h2><p>M2 공식 지원 조사와 별도 승인 전까지 잠겨 있습니다.</p></div>
            <div className="future-buttons">
              <button type="button" disabled title="M3 승인 뒤 제공">Codex에 적용</button>
              <button type="button" disabled title="M3 승인 뒤 제공">복원</button>
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
