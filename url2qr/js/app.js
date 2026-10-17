/**
 * URL2QR - Application Logic
 * Pure Vanilla JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const appWrapper = document.getElementById('appWrapper');
  const logoBtn = document.getElementById('logoBtn');
  const urlForm = document.getElementById('urlForm');
  const urlInput = document.getElementById('urlInput');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const submitBtn = document.getElementById('submitBtn');
  const resetBtn = document.getElementById('resetBtn');
  const qrCanvas = document.getElementById('qrCanvas');
  const qrClickArea = document.getElementById('qrClickArea');
  const downloadJpgBtn = document.getElementById('downloadJpgBtn');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const urlDisplay = document.getElementById('urlDisplay');
  const quickTags = document.getElementById('quickTags');
  const toast = document.getElementById('toast');

  let currentUrl = '';
  let toastTimeout = null;

  // Initialize
  urlInput.focus();

  // URL Query Parameter 자동 입력 및 생성 지원 (?url=...)
  const urlParams = new URLSearchParams(window.location.search);
  const paramUrl = urlParams.get('url');
  if (paramUrl) {
    urlInput.value = paramUrl;
    clearInputBtn.style.display = 'inline-flex';
    setTimeout(() => {
      generateQRCode();
    }, 150);
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  // 1. URL Form Submit (확인 버튼 또는 Enter)
  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    generateQRCode();
  });

  // 2. Input change & clear button visibility
  urlInput.addEventListener('input', () => {
    if (urlInput.value.trim().length > 0) {
      clearInputBtn.style.display = 'inline-flex';
    } else {
      clearInputBtn.style.display = 'none';
    }
  });

  clearInputBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearInputBtn.style.display = 'none';
    urlInput.focus();
  });

  // 3. Quick Tag Chips (빠른 예시 클릭)
  if (quickTags) {
    quickTags.addEventListener('click', (e) => {
      const chip = e.target.closest('.tag-chip');
      if (!chip) return;
      const targetUrl = chip.getAttribute('data-url');
      if (targetUrl) {
        urlInput.value = targetUrl;
        clearInputBtn.style.display = 'inline-flex';
        generateQRCode();
      }
    });
  }

  // 4. QR Code Click -> JPG Download (요구사항 4)
  qrClickArea.addEventListener('click', () => {
    downloadAsJpg();
  });

  downloadJpgBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadAsJpg();
  });

  // 5. Copy URL Button
  copyUrlBtn.addEventListener('click', () => {
    if (!currentUrl) return;
    navigator.clipboard.writeText(currentUrl)
      .then(() => {
        showToast('📋 URL이 클립보드에 복사되었습니다.');
      })
      .catch(() => {
        // Fallback for older browsers
        const tempInput = document.createElement('input');
        tempInput.value = currentUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        showToast('📋 URL이 클립보드에 복사되었습니다.');
      });
  });

  // 6. Reset & Logo Click (처음 화면으로 복귀)
  logoBtn.addEventListener('click', resetToInitialState);
  resetBtn.addEventListener('click', resetToInitialState);

  // --------------------------------------------------------------------------
  // Core Functions
  // --------------------------------------------------------------------------

  /**
   * QR 코드 생성 및 화면 전환 처리
   */
  function generateQRCode() {
    let rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      showToast('⚠️ 변환할 URL을 입력해주세요.');
      urlInput.focus();
      return;
    }

    // URL 프로토콜 자동 보완 (http/https 등이 없으면 기본 https:// 추가)
    if (!/^https?:\/\//i.test(rawUrl) && !/^[a-zA-Z0-9_-]+:\/\//.test(rawUrl)) {
      rawUrl = 'https://' + rawUrl;
      urlInput.value = rawUrl;
    }

    currentUrl = rawUrl;

    try {
      // 1) qrcode 라이브러리를 통해 QR 매트릭스 생성
      // Type 0 (auto-detect size), ErrorCorrection Level 'M'
      const qr = qrcode(0, 'M');
      qr.addData(currentUrl);
      qr.make();

      // 2) 고화질 Canvas에 그리기 (다운로드 시에도 선명하도록 고해상도 지원)
      renderQrToCanvas(qr);

      // 3) URL 텍스트 갱신
      urlDisplay.textContent = currentUrl;

      // 4) 상태 전환 (중앙에서 하단으로 이동, QR카드 등장)
      appWrapper.classList.remove('state-initial');
      appWrapper.classList.add('state-generated');

      showToast('✨ QR코드가 생성되었습니다! 클릭하여 JPG로 저장하세요.');
    } catch (err) {
      console.error('QR code generation error:', err);
      showToast('❌ QR코드 생성 중 오류가 발생했습니다. URL을 확인해주세요.');
    }
  }

  /**
   * Canvas에 고해상도로 QR 코드 렌더링
   * (흰색 배경 및 Quiet Zone 여백 포함)
   */
  function renderQrToCanvas(qr) {
    const moduleCount = qr.getModuleCount();
    // 캔버스 크기 (고해상도 600x600)
    const canvasSize = 600;
    qrCanvas.width = canvasSize;
    qrCanvas.height = canvasSize;

    const ctx = qrCanvas.getContext('2d');

    // 1. JPG 호환을 위한 순백색 배경 칠하기 (중요: 투명 배경 방지)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // 2. 여백(Quiet Zone) 계산
    const margin = 40; // 픽셀 여백
    const availableSize = canvasSize - (margin * 2);
    const cellSize = availableSize / moduleCount;

    // 3. QR 모듈 그리기
    ctx.fillStyle = '#0F172A'; // 딥 차콜 블랙 (스캔 인식률 최적)

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          // 셀 간 미세 틈 방지를 위해 ceil/픽셀 정렬 보정
          const x = Math.round(margin + col * cellSize);
          const y = Math.round(margin + row * cellSize);
          const w = Math.ceil(cellSize);
          const h = Math.ceil(cellSize);
          ctx.fillRect(x, y, w, h);
        }
      }
    }
  }

  /**
   * 4. QR코드를 JPG 파일로 다운로드
   */
  function downloadAsJpg() {
    if (!currentUrl) return;

    try {
      // 캔버스에서 JPG DataURL 추출 (품질: 0.95)
      const jpgDataUrl = qrCanvas.toDataURL('image/jpeg', 0.95);

      // 파일명 생성: 도메인명 기반 (예: qrcode_naver_com.jpg)
      let filename = 'qrcode.jpg';
      try {
        const parsed = new URL(currentUrl);
        const hostClean = parsed.hostname.replace(/[^a-zA-Z0-9]/g, '_');
        filename = `qrcode_${hostClean}.jpg`;
      } catch (e) {
        const cleanText = currentUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
        filename = `qrcode_${cleanText}.jpg`;
      }

      // 가상 링크를 통한 다운로드 트리거
      const downloadLink = document.createElement('a');
      downloadLink.href = jpgDataUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      showToast(`💾 [${filename}] JPG 파일로 다운로드되었습니다!`);
    } catch (err) {
      console.error('Download error:', err);
      showToast('❌ 파일 다운로드 중 오류가 발생했습니다.');
    }
  }

  /**
   * 초기 화면으로 복귀
   */
  function resetToInitialState() {
    appWrapper.classList.remove('state-generated');
    appWrapper.classList.add('state-initial');
    urlInput.value = '';
    clearInputBtn.style.display = 'none';
    currentUrl = '';
    setTimeout(() => {
      urlInput.focus();
    }, 300);
  }

  /**
   * 상단 토스트 알림 표시
   */
  function showToast(message) {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    toast.textContent = message;
    toast.classList.add('show');

    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }
});
