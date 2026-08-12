import type { ThemeRecord } from '../../shared/theme';
import { previewAdapter } from '../adapters/PreviewAdapter';

interface ThemePreviewProps {
  theme: ThemeRecord;
}

export function ThemePreview({ theme }: ThemePreviewProps) {
  return (
    <section
      className="theme-preview"
      style={previewAdapter.createPreviewVariables(theme)}
      aria-label="테마 실시간 미리보기"
    >
      <div className="preview-backdrop" aria-hidden="true">
        {theme.image ? (
          <img src={theme.image.url} alt="" style={previewAdapter.createImageStyle(theme)} />
        ) : (
          <div className="preview-placeholder" />
        )}
        <div className="preview-overlay" />
      </div>

      <header className="preview-titlebar">
        <span className="preview-logo">F</span>
        <span>Frostline Preview</span>
        <div className="window-controls" aria-hidden="true"><i /><i /><i /></div>
      </header>

      <div className="preview-layout">
        <aside className="preview-sidebar">
          <button className="new-task" type="button"><span>＋</span> 새 작업</button>
          <nav aria-label="미리보기 메뉴">
            <a className="active" href="#preview">◫ <span>테마 작업실</span></a>
            <a href="#preview">⌕ <span>작업 검색</span></a>
            <a href="#preview">▱ <span>보관함</span></a>
          </nav>
          <div className="preview-history">
            <small>오늘</small>
            <p>배경 이미지 다듬기</p>
            <p>강조색 비교하기</p>
          </div>
          <div className="preview-profile"><span>FL</span><div>로컬 작업 공간<small>미리보기 전용</small></div></div>
        </aside>

        <main className="preview-main">
          <div className="preview-copy">
            <span className="eyebrow">THEME PREVIEW</span>
            <h2>차가운 빛으로<br />작업 공간을 디자인하세요.</h2>
            <p>사진과 표면 색상이 실제 데스크톱 UI 위에서 어떻게 어울리는지 바로 확인할 수 있습니다.</p>
            <div className="preview-chips"><span>로컬 전용</span><span>실시간 반영</span><span>안전한 미리보기</span></div>
          </div>
          <div className="preview-composer">
            <div><span className="plus">＋</span><span>Frostline에 메시지 보내기</span></div>
            <div className="composer-actions"><span>로컬</span><button type="button">↑</button></div>
          </div>
        </main>
      </div>
    </section>
  );
}

