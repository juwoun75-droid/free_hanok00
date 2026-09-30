/**
 * 안국동 무료 한옥 길잡이 (Anguk Hanok Guide) 인터랙션 로직
 */

// 정밀 한옥 SVG 아이콘 (단청 붉은색 기와지붕과 기둥 실루엣)
const HANOK_SVG_ICON = `
<svg viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <!-- 지붕 용마루 및 치미 -->
  <path d="M32 6 C28 6 22 9 8 13 C5 14 3 17 6 18 C11 19 20 20 32 20 C44 20 53 19 58 18 C61 17 59 14 56 13 C42 9 36 6 32 6 Z" />
  <!-- 곡선형 기와 처마 (Dancheong Curved Eaves) -->
  <path d="M4 17 C12 21 21 23 32 23 C43 23 52 21 60 17 C62 16 63 19 61 21 C53 27 43 29 32 29 C21 29 11 27 3 21 C1 19 2 16 4 17 Z" opacity="0.9" />
  <!-- 서까래 및 공포 라인 -->
  <rect x="14" y="27" width="36" height="4" rx="1.5" />
  <!-- 기둥 4개 (Pillars) -->
  <rect x="15" y="31" width="4" height="21" rx="1" />
  <rect x="25" y="31" width="3.5" height="21" rx="1" />
  <rect x="35.5" y="31" width="3.5" height="21" rx="1" />
  <rect x="45" y="31" width="4" height="21" rx="1" />
  <!-- 격자 전통 창살 문 (Latticed Korean Doors) -->
  <path d="M20 35 H24 V49 H20 Z M30 35 H34 V49 H30 Z M40 35 H44 V49 H40 Z" opacity="0.4" />
  <!-- 기단 및 댓돌 (Stone Foundation) -->
  <path d="M10 52 H54 C55.5 52 56 54 55 55 L52 58 C51.5 58.5 50.5 59 49.5 59 H14.5 C13.5 59 12.5 58.5 12 58 L9 55 C8 54 8.5 52 10 52 Z" />
</svg>
`;

// 지하철역 아이콘 SVG
const SUBWAY_SVG_ICON = `
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="4" y="3" width="16" height="16" rx="2" />
  <path d="M4 11h16" />
  <path d="M12 3v8" />
  <circle cx="8" cy="15" r="1" fill="currentColor" />
  <circle cx="16" cy="15" r="1" fill="currentColor" />
  <path d="M8 19l-2 3" />
  <path d="M16 19l2 3" />
</svg>
`;

let map = null;
let markerObjects = {};
let activeMarkerId = null;
let trailPolyline = null;
let trailVisible = false;
let userLocationMarker = null;

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  renderQuickChips();
  renderMarkers();
  setupEventListeners();
  initWalkingTrail();
});

/**
 * Leaflet 지도 초기화
 */
function initMap() {
  // 북촌 및 안국동 중심 좌표
  const centerLat = 37.5815;
  const centerLng = 126.9852;

  map = L.map('map', {
    center: [centerLat, centerLng],
    zoom: 16,
    minZoom: 14,
    maxZoom: 19,
    zoomControl: true
  });

  // 대한민국 공식 공간정보 국토교통부 브이월드(VWorld) 고해상도 한글 지도
  L.tileLayer('https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.vworld.kr" target="_blank" rel="noopener noreferrer">국토교통부 VWorld</a>',
    minZoom: 6,
    maxZoom: 19
  }).addTo(map);

  // 지도 빈 공간 클릭 시 상세창 닫기
  map.on('click', (e) => {
    // 마커 클릭이 아닐 경우 닫기
    if (e.originalEvent.target.closest('.hanok-marker-pin')) return;
    closeDetailPanel();
  });
}

/**
 * 상단 퀵 필터 칩 렌더링
 */
function renderQuickChips() {
  const container = document.getElementById('quickChips');
  if (!container) return;

  container.innerHTML = `
    <button class="chip-btn active" data-id="all">
      <span class="chip-indicator"></span>
      전체 한옥 보기 (4곳)
    </button>
  `;

  HANOK_DATA.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn';
    btn.dataset.id = item.id;
    btn.innerHTML = `
      <span class="chip-indicator"></span>
      ${item.name}
    `;
    btn.addEventListener('click', () => {
      selectHanok(item.id);
    });
    container.appendChild(btn);
  });

  const allBtn = container.querySelector('[data-id="all"]');
  allBtn.addEventListener('click', () => {
    resetMapView();
  });
}

/**
 * 시골쥐 캐릭터 커스텀 마커 생성
 */
function renderMarkers() {
  HANOK_DATA.forEach((item, index) => {
    // 시골쥐 캐릭터 커스텀 HTML 마커 요소 생성
    const customIcon = L.divIcon({
      className: 'hanok-custom-leaflet-icon',
      html: `
        <div class="hanok-marker-pin" id="marker-${item.id}" data-id="${item.id}">
          <div class="hanok-marker-container">
            <div class="hanok-badge-bubble">
              <span>${item.name}</span>
            </div>
            <div class="hanok-icon-body character-marker-avatar">
              <img src="character.png" alt="${item.name} 시골쥐 마커" class="marker-character-img">
            </div>
            <div class="hanok-marker-pulse"></div>
          </div>
        </div>
      `,
      iconSize: [86, 80],
      iconAnchor: [43, 76]
    });

    const marker = L.marker([item.lat, item.lng], {
      icon: customIcon,
      title: item.name,
      riseOnHover: true
    }).addTo(map);

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      selectHanok(item.id);
    });

    markerObjects[item.id] = marker;
  });

  // 안국역 3호선 참고 마커 (출발 거점)
  const stationIcon = L.divIcon({
    className: 'station-custom-leaflet-icon',
    html: `
      <div class="station-marker-container">
        <div class="station-badge">
          <span>🚇 3호선 안국역 (3번 출구)</span>
        </div>
      </div>
    `,
    iconSize: [140, 30],
    iconAnchor: [70, 15]
  });

  L.marker([ANGUK_STATION.lat, ANGUK_STATION.lng], {
    icon: stationIcon,
    interactive: true
  }).addTo(map).bindPopup(`
    <div style="font-family: Pretendard, sans-serif; padding: 4px;">
      <strong style="color: #FF7043;">🚇 3호선 안국역 (3번 출구)</strong>
      <p style="font-size: 0.8rem; color: #666; margin-top: 4px;">북촌 무료 한옥 산책의 가장 편리한 시작점입니다.</p>
    </div>
  `);
}

/**
 * 특정 한옥 선택 시 동작
 */
function selectHanok(id) {
  const item = HANOK_DATA.find(d => d.id === id);
  if (!item) return;

  activeMarkerId = id;

  // 마커 스타일 업데이트
  document.querySelectorAll('.hanok-marker-pin').forEach(el => {
    el.classList.toggle('is-active', el.dataset.id === id);
  });

  // 상단 칩 활성화 상태 업데이트
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === id);
  });

  // 지도 부드럽게 이동 & 줌
  // 모바일 화면에서는 바텀시트 공간을 고려해 살짝 위쪽을 중심으로
  const isMobile = window.innerWidth <= 768;
  const targetLat = isMobile ? item.lat - 0.0012 : item.lat;

  map.flyTo([targetLat, item.lng], 17, {
    duration: 0.8,
    easeLinearity: 0.25
  });

  // 상세 패널 내용 채우기 및 열기
  populateDetailPanel(item);

  // 기본 탭(한옥 안내)으로 활성화 리셋
  const defaultTabBtn = document.querySelector('.detail-tab-btn[data-tab="info"]');
  if (defaultTabBtn) {
    document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
    defaultTabBtn.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const infoPane = document.getElementById('pane-info');
    if (infoPane) infoPane.classList.add('active');
  }

  openDetailPanel();
}

/**
 * 상세 패널 내용 렌더링
 */
function populateDetailPanel(item) {
  const panel = document.getElementById('detailPanel');
  if (!panel) return;

  // 이미지
  const imgEl = panel.querySelector('#panelImage');
  imgEl.src = item.image;
  imgEl.alt = item.name;

  // 명칭 및 카테고리
  panel.querySelector('#panelHanja').textContent = item.hanja;
  panel.querySelector('#panelName').textContent = item.name;
  panel.querySelector('#panelBadgeCategory').textContent = item.category;

  // 주소
  panel.querySelector('#panelAddress').textContent = item.roadAddress || item.address;
  panel.querySelector('#copyAddressBtn').dataset.address = item.roadAddress || item.address;

  // 특징 (사용자가 제공한 핵심 문구 강조)
  panel.querySelector('#panelFeature').textContent = item.feature;

  // 주요 매력 포인트 목록
  const listEl = panel.querySelector('#panelDetailsList');
  listEl.innerHTML = item.details.map(d => `<li>${d}</li>`).join('');

  // 운영 시간 & 이용료 & 문의
  panel.querySelector('#panelHours').textContent = item.hours;
  panel.querySelector('#panelPhone').textContent = item.phone;
  panel.querySelector('#panelTip').textContent = item.tip;

  // 지도 바로가기 버튼 링크
  const naverBtn = panel.querySelector('#linkNaver');
  naverBtn.href = item.naverMapUrl;

  const kakaoBtn = panel.querySelector('#linkKakao');
  kakaoBtn.href = item.kakaoMapUrl;

  const googleBtn = panel.querySelector('#linkGoogle');
  googleBtn.href = item.officialUrl;

  // 공식/참고 링크
  const officialBtn = panel.querySelector('#linkOfficial');
  officialBtn.href = item.officialUrl;
  officialBtn.innerHTML = `
    <span>${item.linkText}</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  `;

  // 가는 길 소소한 재밋거리 렌더링
  renderFunSpots(item);

  // 방문자 경험담 & 꿀팁 렌더링
  renderStories(item.id);
}

/**
 * 가는 길 소소한 재밋거리 렌더링
 */
function renderFunSpots(item) {
  const container = document.getElementById('panelFunList');
  if (!container) return;

  if (!item.funSpots || item.funSpots.length === 0) {
    container.innerHTML = `<p style="font-size:0.82rem; color:#888; padding: 12px 0;">등록된 소소한 재밋거리 정보가 없습니다.</p>`;
    return;
  }

  container.innerHTML = item.funSpots.map(spot => `
    <div class="fun-spot-card">
      <div class="fun-spot-icon">${spot.icon}</div>
      <div class="fun-spot-text">
        <h4>${spot.title}</h4>
        <p>${spot.desc}</p>
      </div>
    </div>
  `).join('');
}

/**
 * 방문자 경험담 데이터 가져오기 (localStorage 연동)
 */
function getStories(spotId) {
  const storageKey = 'hanok_stories_' + spotId;
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse stories from localStorage:', e);
    }
  }

  // 초기 기본값 세팅
  const item = HANOK_DATA.find(d => d.id === spotId);
  const initial = item && item.initialStories ? [...item.initialStories] : [];
  localStorage.setItem(storageKey, JSON.stringify(initial));
  return initial;
}

/**
 * 방문자 경험담 데이터 저장하기
 */
function saveStories(spotId, stories) {
  const storageKey = 'hanok_stories_' + spotId;
  localStorage.setItem(storageKey, JSON.stringify(stories));
}

/**
 * 방문자 경험담 피드 렌더링
 */
function renderStories(spotId) {
  const feed = document.getElementById('storiesFeed');
  const badge = document.getElementById('storyCountBadge');
  if (!feed) return;

  const stories = getStories(spotId);

  if (badge) {
    badge.textContent = stories.length;
  }

  if (stories.length === 0) {
    feed.innerHTML = `
      <div style="text-align: center; padding: 28px 16px; color: #8C96A3; font-size: 0.84rem; background: #faf8f5; border-radius: 12px;">
        아직 등록된 경험담이 없습니다.<br>이 한옥을 방문하고 첫 번째 이야기를 남겨보세요! ✨
      </div>
    `;
    return;
  }

  feed.innerHTML = stories.map(story => {
    const initialChar = (story.author || '익명').charAt(0);
    const isLiked = story.liked ? 'liked' : '';

    return `
      <div class="story-card" id="story-${story.id}">
        <div class="story-card-top">
          <div class="story-author-group">
            <div class="author-avatar">${escapeHtml(initialChar)}</div>
            <div class="author-meta">
              <span class="author-name">${escapeHtml(story.author || '익명')}</span>
              <span class="story-date">${story.date}</span>
            </div>
          </div>
          <span class="story-tag-pill">${escapeHtml(story.tag || '🌿 고즈넉한 쉼')}</span>
        </div>
        <p class="story-content-text">${escapeHtml(story.content)}</p>
        <div class="story-card-bottom">
          <button class="story-like-btn ${isLiked}" onclick="toggleStoryLike('${spotId}', '${story.id}')" title="공감하기">
            <svg viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <span>공감</span>
            <strong>${story.likes || 0}</strong>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 경험담 공감(좋아요) 토글
 */
function toggleStoryLike(spotId, storyId) {
  const stories = getStories(spotId);
  const story = stories.find(s => s.id === storyId);
  if (!story) return;

  if (story.liked) {
    story.liked = false;
    story.likes = Math.max(0, (story.likes || 1) - 1);
  } else {
    story.liked = true;
    story.likes = (story.likes || 0) + 1;
    showToast('따뜻한 공감을 남겼습니다 ❤️');
  }

  saveStories(spotId, stories);
  renderStories(spotId);
}

/**
 * XSS 방지용 HTML 이스케이프
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 상세 정보창 열기
 */
function openDetailPanel() {
  const panel = document.getElementById('detailPanel');
  if (panel) {
    panel.classList.add('open');
  }
}

/**
 * 상세 정보창 닫기
 */
function closeDetailPanel() {
  const panel = document.getElementById('detailPanel');
  if (panel) {
    panel.classList.remove('open');
  }

  // 마커 선택 해제
  document.querySelectorAll('.hanok-marker-pin').forEach(el => {
    el.classList.remove('is-active');
  });

  // 상단 칩 초기화
  const allChip = document.querySelector('.chip-btn[data-id="all"]');
  if (allChip) {
    document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
    allChip.classList.add('active');
  }

  activeMarkerId = null;
}

/**
 * 전체 4곳이 한눈에 보이도록 지도 리셋
 */
function resetMapView() {
  closeDetailPanel();

  const bounds = L.latLngBounds(HANOK_DATA.map(d => [d.lat, d.lng]));
  bounds.extend([ANGUK_STATION.lat, ANGUK_STATION.lng]);

  map.fitBounds(bounds, {
    padding: [80, 80],
    maxZoom: 16
  });

  showToast('전체 4곳의 무료 한옥 위치를 한눈에 표시합니다.');
}

/**
 * 추천 도보 코스 폴리라인 초기화
 */
function initWalkingTrail() {
  trailPolyline = L.polyline(WALKING_TRAIL, {
    color: '#C92A2A',
    weight: 4,
    opacity: 0.85,
    dashArray: '8, 10',
    lineCap: 'round',
    lineJoin: 'round'
  });
}

/**
 * 도보 코스 보이기 / 숨기기 토글
 */
function toggleWalkingTrail() {
  const toggleBtn = document.getElementById('toggleTrailBtn');
  const bannerBtn = document.getElementById('bannerTrailBtn');

  if (!trailVisible) {
    trailPolyline.addTo(map);
    trailVisible = true;
    if (toggleBtn) toggleBtn.classList.add('active');
    if (bannerBtn) bannerBtn.textContent = '코스 숨기기';

    showToast('🚶 안국역에서 출발하는 추천 도보 순환 코스(약 1.8km)가 표시되었습니다.');
  } else {
    map.removeLayer(trailPolyline);
    trailVisible = false;
    if (toggleBtn) toggleBtn.classList.remove('active');
    if (bannerBtn) bannerBtn.textContent = '코스 선 보기';

    showToast('추천 도보 코스 표시를 해제했습니다.');
  }
}

/**
 * 내 위치 확인 (GPS)
 */
function findMyLocation() {
  if (!navigator.geolocation) {
    showToast('사용 중인 브라우저에서 위치 정보를 지원하지 않습니다.');
    return;
  }

  showToast('📍 현재 위치를 탐색 중입니다...');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
      }

      const userIcon = L.divIcon({
        className: 'user-location-pin',
        html: `
          <div style="width: 20px; height: 20px; background: #007AFF; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 10px rgba(0,122,255,0.6);"></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      userLocationMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map)
        .bindPopup('<strong>내 현재 위치</strong>')
        .openPopup();

      map.flyTo([lat, lng], 17);
      showToast('현재 위치를 찾았습니다!');
    },
    (err) => {
      console.warn('Geolocation error:', err);
      showToast('위치 권한이 거부되었거나 위치를 가져올 수 없습니다.');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

/**
 * 토스트 메시지 띄우기
 */
function showToast(message) {
  let toast = document.getElementById('toastNotice');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotice';
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${message}</span>
  `;

  toast.classList.add('show');

  if (toast.timer) clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

/**
 * 이벤트 리스너 세팅
 */
function setupEventListeners() {
  // 닫기 버튼
  const closeBtn = document.getElementById('closePanelBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDetailPanel);
  }

  // 주소 복사 버튼
  const copyBtn = document.getElementById('copyAddressBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const address = copyBtn.dataset.address || '';
      if (address) {
        navigator.clipboard.writeText(address).then(() => {
          showToast('주소가 클립보드에 복사되었습니다.');
        }).catch(() => {
          showToast('주소: ' + address);
        });
      }
    });
  }

  // 도보 코스 토글 버튼들
  const toggleTrailBtn = document.getElementById('toggleTrailBtn');
  if (toggleTrailBtn) {
    toggleTrailBtn.addEventListener('click', toggleWalkingTrail);
  }

  const bannerTrailBtn = document.getElementById('bannerTrailBtn');
  if (bannerTrailBtn) {
    bannerTrailBtn.addEventListener('click', toggleWalkingTrail);
  }

  // 전체보기 버튼
  const resetViewBtn = document.getElementById('resetViewBtn');
  if (resetViewBtn) {
    resetViewBtn.addEventListener('click', resetMapView);
  }

  // 내 위치 버튼
  const myLocationBtn = document.getElementById('myLocationBtn');
  if (myLocationBtn) {
    myLocationBtn.addEventListener('click', findMyLocation);
  }

  // ESC 키로 패널 닫기
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetailPanel();
    }
  });

  // 탭 전환 이벤트 리스너
  const tabBtns = document.querySelectorAll('.detail-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
      });

      const targetPane = document.getElementById('pane-' + targetTab);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });

  // 경험담 등록 폼 이벤트 리스너
  const storyForm = document.getElementById('storyForm');
  const storyContent = document.getElementById('storyContent');
  const charCount = document.getElementById('charCount');

  if (storyContent && charCount) {
    storyContent.addEventListener('input', () => {
      charCount.textContent = `${storyContent.value.length}/300자`;
    });
  }

  if (storyForm) {
    storyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!activeMarkerId) {
        showToast('한옥을 먼저 지도에서 선택해주세요.');
        return;
      }

      const authorInput = document.getElementById('storyAuthor');
      const tagSelect = document.getElementById('storyTag');
      const author = authorInput.value.trim();
      const tag = tagSelect.value;
      const content = storyContent.value.trim();

      if (!author || !content) {
        showToast('닉네임과 경험담 내용을 모두 입력해주세요.');
        return;
      }

      const newStory = {
        id: 'st-' + Date.now(),
        author: author,
        date: new Date().toISOString().slice(0, 10),
        tag: tag,
        content: content,
        likes: 1,
        liked: true
      };

      const stories = getStories(activeMarkerId);
      stories.unshift(newStory);
      saveStories(activeMarkerId, stories);

      renderStories(activeMarkerId);

      storyForm.reset();
      if (charCount) charCount.textContent = '0/300자';

      showToast('소중한 한옥 경험담이 등록되었습니다! ✨');
    });
  }

  // 첫 화면(Landing Screen) 인터랙션 로직
  const landingScreen = document.getElementById('landingScreen');
  const openMapBtn = document.getElementById('openMapBtn');
  const homeBtn = document.getElementById('homeBtn');
  const brandTitle = document.getElementById('brandTitle');

  function openMap(targetId = null) {
    if (landingScreen) {
      landingScreen.classList.add('hidden');
    }
    setTimeout(() => {
      if (map) {
        map.invalidateSize();
      }
      if (targetId) {
        selectHanok(targetId);
      }
    }, 200);
    setTimeout(() => {
      if (map) {
        map.invalidateSize();
      }
    }, 450);
    showToast('시골쥐와 함께하는 안국동 한옥 지도가 열렸습니다! 🗺️');
  }

  function showLanding() {
    closeDetailPanel();
    if (landingScreen) {
      landingScreen.classList.remove('hidden');
    }
  }

  if (openMapBtn) {
    openMapBtn.addEventListener('click', () => openMap());
  }

  // 4곳 한옥 미리보기 카드 클릭 시 바로 해당 한옥으로 이동
  const previewCards = document.querySelectorAll('.preview-item');
  const hanokIds = ['bukchon-cheong', 'baeryeom-house', 'bukchon-village', 'gallery-hanok'];
  previewCards.forEach((card, idx) => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const targetId = hanokIds[idx];
      openMap(targetId);
    });
  });

  if (homeBtn) {
    homeBtn.addEventListener('click', showLanding);
  }

  if (brandTitle) {
    brandTitle.addEventListener('click', showLanding);
  }
}
