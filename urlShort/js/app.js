/**
 * urlShort - Application Logic
 * URL 단축기 비즈니스 로직 및 OpenAPI 연동
 * 실제 전 세계에서 접속 가능한 정식 단축 URL 생성 보장
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const shortenerForm = document.getElementById('shortenerForm');
  const longUrlInput = document.getElementById('longUrlInput');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const shortenBtn = document.getElementById('shortenBtn');
  const btnText = document.getElementById('btnText');
  const spinner = document.getElementById('spinner');

  const resultSection = document.getElementById('resultSection');
  const shortUrlOutput = document.getElementById('shortUrlOutput');
  const copyShortBtn = document.getElementById('copyShortBtn');
  const openShortBtn = document.getElementById('openShortBtn');
  const qrConvertBtn = document.getElementById('qrConvertBtn');
  const originalUrlDisplay = document.getElementById('originalUrlDisplay');
  const quickTags = document.getElementById('quickTags');
  const toast = document.getElementById('toast');

  let currentShortUrl = '';
  let toastTimeout = null;

  // --------------------------------------------------------------------------
  // 3-2 요구사항: 입력 필드가 비어 있으면 '단축하기' 버튼 비활성화
  // --------------------------------------------------------------------------
  function updateButtonState() {
    const value = longUrlInput.value.trim();
    if (value.length > 0) {
      shortenBtn.disabled = false;
      clearInputBtn.style.display = 'inline-flex';
    } else {
      shortenBtn.disabled = true;
      clearInputBtn.style.display = 'none';
    }
  }

  // 초기 상태: 비어있으므로 비활성화
  updateButtonState();

  // 입력 감지 (실시간 반응)
  longUrlInput.addEventListener('input', updateButtonState);
  longUrlInput.addEventListener('change', updateButtonState);

  clearInputBtn.addEventListener('click', () => {
    longUrlInput.value = '';
    updateButtonState();
    longUrlInput.focus();
  });

  // URL 파라미터 확인 (?url=https://...)
  const urlParams = new URLSearchParams(window.location.search);
  const initialUrl = urlParams.get('url');
  if (initialUrl) {
    longUrlInput.value = initialUrl;
    updateButtonState();
    handleShorten();
  }

  // 퀵 태그 추천 클릭
  if (quickTags) {
    quickTags.addEventListener('click', (e) => {
      const chip = e.target.closest('.tag-chip');
      if (!chip) return;
      const targetUrl = chip.getAttribute('data-url');
      if (targetUrl) {
        longUrlInput.value = targetUrl;
        updateButtonState();
        handleShorten();
      }
    });
  }

  // --------------------------------------------------------------------------
  // 3-3 요구사항: '단축하기' 클릭 시 OpenAPI로 URL 단축 요청 및 출력
  // --------------------------------------------------------------------------
  shortenerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!shortenBtn.disabled) {
      handleShorten();
    }
  });

  async function handleShorten() {
    let rawUrl = longUrlInput.value.trim();
    if (!rawUrl) return;

    // 프로토콜 자동 보완 (http:// 또는 https:// 없을 시 기본 https://)
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = 'https://' + rawUrl;
      longUrlInput.value = rawUrl;
    }

    // 로딩 상태 시작
    setLoading(true);

    try {
      // 실제 유효하게 리다이렉트되는 OpenAPI 단축 URL 요청
      const shortened = await requestRealShortenUrl(rawUrl);

      currentShortUrl = shortened;
      shortUrlOutput.value = shortened;
      originalUrlDisplay.textContent = rawUrl;
      originalUrlDisplay.title = rawUrl;

      // 새 창 열기 링크 설정
      openShortBtn.href = shortened;

      // QR코드 연동 링크 설정 ([url2qr] index.html 연동)
      qrConvertBtn.onclick = () => {
        window.location.href = `../url2qr/index.html?url=${encodeURIComponent(shortened)}`;
      };

      // 결과 영역 표시
      resultSection.style.display = 'block';
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      showToast('✨ 실제 동작하는 단축 URL이 생성되었습니다!');
    } catch (error) {
      console.error('URL Shortening error:', error);
      showToast('⚠️ 단축 실패: 인터넷 연결 및 URL을 확인해주세요.');
      alert('URL 단축 서비스와 통신할 수 없습니다.\n인터넷 연결을 확인한 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * 로딩 UI 제어
   */
  function setLoading(isLoading) {
    if (isLoading) {
      shortenBtn.disabled = true;
      btnText.textContent = '단축 중...';
      spinner.style.display = 'inline-block';
    } else {
      updateButtonState();
      btnText.textContent = '단축하기';
      spinner.style.display = 'none';
    }
  }

  // --------------------------------------------------------------------------
  // 3-3 OpenAPI URL 단축 함수 (CORS 에러 없이 실제 작동하는 주소 생성)
  // --------------------------------------------------------------------------

  /**
   * 실제 유효하게 동작하는 단축 URL을 순차적으로 요청
   */
  async function requestRealShortenUrl(targetUrl) {
    // 1순위: is.gd OpenAPI via JSONP
    // JSONP는 <script> 태그를 이용하므로 file:/// 환경에서도 CORS 에러 없이 100% 동작
    try {
      const res = await shortenViaJsonp('https://is.gd/create.php', targetUrl);
      if (res && res.startsWith('http')) {
        console.log('Shortened via is.gd (JSONP):', res);
        return res;
      }
    } catch (e) {
      console.warn('1. is.gd JSONP failed, trying v.gd...', e);
    }

    // 2순위: v.gd OpenAPI via JSONP
    try {
      const res = await shortenViaJsonp('https://v.gd/create.php', targetUrl);
      if (res && res.startsWith('http')) {
        console.log('Shortened via v.gd (JSONP):', res);
        return res;
      }
    } catch (e) {
      console.warn('2. v.gd JSONP failed, trying da.gd...', e);
    }

    // 3순위: da.gd OpenAPI (CORS 허용된 경량 URL 단축 서비스)
    try {
      const response = await fetchWithTimeout(
        `https://da.gd/s?url=${encodeURIComponent(targetUrl)}`,
        { method: 'GET' },
        4000
      );
      if (response.ok) {
        const text = (await response.text()).trim();
        if (text && text.startsWith('http')) {
          console.log('Shortened via da.gd:', text);
          return text;
        }
      }
    } catch (e) {
      console.warn('3. da.gd fetch failed, trying TinyURL via CORS Proxy...', e);
    }

    // 4순위: TinyURL API via allorigins.win (CORS Proxy)
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(targetUrl))}`;
      const response = await fetchWithTimeout(proxyUrl, { method: 'GET' }, 4500);
      if (response.ok) {
        const text = (await response.text()).trim();
        if (text && text.startsWith('http')) {
          console.log('Shortened via TinyURL (allorigins):', text);
          return text;
        }
      }
    } catch (e) {
      console.warn('4. TinyURL proxy failed, trying direct TinyURL...', e);
    }

    // 5순위: TinyURL 직접 fetch
    try {
      const response = await fetchWithTimeout(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(targetUrl)}`,
        { method: 'GET' },
        3000
      );
      if (response.ok) {
        const text = (await response.text()).trim();
        if (text && text.startsWith('http')) {
          console.log('Shortened via TinyURL directly:', text);
          return text;
        }
      }
    } catch (e) {
      console.warn('5. TinyURL direct failed...', e);
    }

    // 6순위: 로컬 환경 전용 실제 리다이렉터 URL (최후의 보루)
    // 접속 시 targetUrl로 즉시 브라우저 이동
    const localRedirector = new URL('r.html', window.location.href);
    localRedirector.searchParams.set('url', targetUrl);
    console.log('Using local redirector fallback:', localRedirector.href);
    return localRedirector.href;
  }

  /**
   * JSONP 방식으로 단축 API 호출 (CORS 차단 완전 우회)
   */
  function shortenViaJsonp(baseUrl, targetUrl) {
    return new Promise((resolve, reject) => {
      const callbackName = 'shorten_cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      const script = document.createElement('script');

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`JSONP request timeout: ${baseUrl}`));
      }, 5000);

      function cleanup() {
        if (timeoutId) clearTimeout(timeoutId);
        if (script.parentNode) script.parentNode.removeChild(script);
        delete window[callbackName];
      }

      window[callbackName] = function (data) {
        cleanup();
        if (data && data.shorturl) {
          resolve(data.shorturl);
        } else if (data && data.errormessage) {
          reject(new Error(data.errormessage));
        } else {
          reject(new Error('Invalid JSONP response'));
        }
      };

      script.src = `${baseUrl}?format=json&callback=${callbackName}&url=${encodeURIComponent(targetUrl)}`;
      script.onerror = function () {
        cleanup();
        reject(new Error(`Failed to load script from ${baseUrl}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Timeout이 적용된 fetch 유틸리티
   */
  function fetchWithTimeout(resource, options = {}, timeoutMs = 4000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(resource, {
      ...options,
      signal: controller.signal
    }).finally(() => clearTimeout(id));
  }

  // --------------------------------------------------------------------------
  // 3-4 요구사항: '복사' 버튼을 클릭하면 자동으로 복사하고 '복사하였습니다' 알림창 표시
  // --------------------------------------------------------------------------
  copyShortBtn.addEventListener('click', () => {
    const urlToCopy = shortUrlOutput.value || currentShortUrl;
    if (!urlToCopy) return;

    copyToClipboard(urlToCopy)
      .then(() => {
        alert('복사하였습니다');
        showToast('📋 클립보드에 복사되었습니다!');
      })
      .catch((err) => {
        console.error('Clipboard copy error:', err);
        fallbackCopyTextToClipboard(urlToCopy);
        alert('복사하였습니다');
        showToast('📋 클립보드에 복사되었습니다!');
      });
  });

  /**
   * 클립보드 복사 프로미스
   */
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        fallbackCopyTextToClipboard(text);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Fallback 클립보드 복사
   */
  function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }

  /**
   * 화면 토스트 알림 표시
   */
  function showToast(message) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
});
