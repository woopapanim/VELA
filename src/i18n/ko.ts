import type { Dict } from './types';

export const ko: Dict = {
  // Language toggle
  'language.toggle': '언어',
  'language.en': 'English',
  'language.ko': '한국어',

  // Analytics — action buttons on insight cards
  'analytics.action.editZone': '존 편집',
  'analytics.action.editCapacity': '용량 편집',
  'analytics.action.editMedia': '미디어 편집',
  'analytics.action.viewHeatmap': '히트맵 보기',
  'analytics.action.viewFlow': '동선 보기',
  'analytics.action.checkZone': '존 확인',
  'analytics.action.viewDensity': '밀도 보기',

  // Analytics — static pre-sim insight (congestion warning)
  'analytics.staticInsight.title': '{zone}: 사전 면적 확장 권장',
  'analytics.staticInsight.cause':
    '예상 밀도 {density}m²/인 < 기준 2.5m²/인 — 병목 위험 {risk}',
  'analytics.staticInsight.rec': '→ 존 용량 상한 또는 면적 확장으로 사전 대응',

  // Zone Media Performance
  'zoneMedia.itemsSuffix': '개',

  // Flow vs Experience
  'flowVsExperience.rushThrough':
    'rush-through: 설치 미디어 대비 관람 깊이 25% 미만',

  // Completion Report
  'report.perPerson': '인',

  // Simulation — validation toasts
  'sim.toast.entryNeeded': 'ENTRY 노드가 필요합니다',
  'sim.toast.exitNeeded': 'EXIT 노드가 필요합니다',
  'sim.toast.edgeNeeded': 'Edge가 최소 1개 필요합니다',
  'sim.toast.nodesAndEdgesNeeded': 'Node와 Edge를 배치하세요',

  // Simulation — stop dialog
  'sim.stop.title': '시뮬레이션 중지',
  'sim.stop.body':
    '모든 에이전트, 미디어 통계, KPI 이력, 리플레이 프레임이 초기화됩니다.\n되돌릴 수 없습니다.',
  'sim.stop.cancel': '취소',
  'sim.stop.confirm': '초기화',

  // Build — waypoint node descriptions (tooltips)
  'build.node.entry.desc': '스폰 지점',
  'build.node.exit.desc': '퇴장 지점',
  'build.node.zone.desc': '전시 거점',
  'build.node.attractor.desc': '고인력 타겟',
  'build.node.hub.desc': '교차로/분기점',
  'build.node.rest.desc': '휴게/버퍼',

  // Build — hints
  'build.hint.placeNode': '캔버스 클릭하여 노드 배치',
  'build.hint.edgeMode.title': 'Edge 연결 모드',
  'build.hint.edgeMode.body': '첫 노드 클릭 → 두 번째 노드 클릭으로 연결',
  'build.hint.zoneArea': 'Zone = 미디어 배치 영역. 동선은 Node/Edge로.',

  // Zone / Media editor — polygon shape
  'editor.shape.done': '✓ 형태 완료',
  'editor.shape.edit': '형태 편집',

  // Waypoint inspector
  'waypoint.namePlaceholder': '노드 이름',

  // Project manager
  'project.toast.saved': '"{name}" v{version} 저장됨',
  'project.toast.invalid': '유효하지 않은 프로젝트 파일',
  'project.toast.opened': '"{name}" 열림',
  'project.toast.parseError': '파일 파싱 오류',
  'project.openTitle': 'JSON 파일 열기',

  // Zone templates
  'zoneTemplate.linear.desc': '일렬 동선 (입구→전시→출구)',
  'zoneTemplate.hub.desc': '중앙 홀 + 주변 전시실',
  'zoneTemplate.grid.desc': '격자형 부스 배치',
  'zoneTemplate.hall.desc': '대형 단일 전시 홀',

  // Scenario compare
  'scenario.compare.recommend': '추천',
  'scenario.compare.scenarioPrefix': '시나리오',
  'scenario.compare.equal': '동일',

  // Config fields
  'configFields.sumRequired': '합계: {total}% (100% 필요)',

  // Welcome screen
  'welcome.error.invalidFile':
    '유효하지 않은 파일입니다 (meta / zones / simulationConfig 누락)',
  'welcome.error.parseError': '파싱 오류: {message}',
  'welcome.error.jsonOnly': '.json 파일만 지원합니다',
  'welcome.drop.hint': 'JSON 파일을 여기에 놓으세요',
  'welcome.drag.hint': '또는 .json 파일을 화면에 드래그하여 열기',
  'welcome.projectName': '프로젝트 이름',

  // Property popover
  'popover.waypoint.namePlaceholder': '이름',
  'popover.capacity.autoCalc': '면적 기반 자동 계산: {count}명',
  'popover.media.outOfSpace': '공간이 부족합니다. 존을 늘리거나 기존 미디어를 이동해주세요.',

  // Visitor popover
  'visitor.state.idle': '대기',
  'visitor.state.moving': '이동',
  'visitor.state.watching': '관람',
  'visitor.state.waiting': '대기열',
  'visitor.state.exiting': '퇴장',

  // Context menu
  'context.delete': '삭제',
  'context.duplicate': '복제',
  'context.edit': '편집',

  // Main layout — zone list
  'mainLayout.dragHandle': '드래그하여 순서 변경',

  // Sensitivity panel — dynamic recommendations
  'sensitivity.rec.expandEntrance':
    '수용 인원을 {capacity}으로 확대 시 병목 {percent}% 감소 예상',
  'sensitivity.rec.reduceInflow':
    '유입률을 {rate}/s로 감소 시 전체 밀도 30% 개선 예상',
  'sensitivity.rec.addExhibitionZone':
    '전시 존 1개 추가 시 과밀 존 {before}개 → {after}개로 감소 예상',
  'sensitivity.rec.expandRest':
    '휴식 공간 50% 확장 시 평균 피로도 {before}% → {after}% 감소 예상',
  'sensitivity.rec.widenGate':
    '병목 존 게이트 폭 2배 확장 시 유출률 40% 향상 예상',

  // Insight engine — congestion
  'insight.congestion.critical.problem': '{zone}: 즉시 입장 제한 필요',
  'insight.congestion.critical.cause': '현재 {occupancy}명 / 적정 {capacity}명 ({pct}%)',
  'insight.congestion.critical.rec': '→ 게이트 추가 또는 존 면적 확장',
  'insight.congestion.warning.problem': '{zone}: 동선 분산 권장',
  'insight.congestion.warning.cause': '수용률 {pct}% — 여유 공간 부족',
  'insight.congestion.warning.rec': '→ 인접 존으로 관심 요소 재배치',

  // Insight engine — bottleneck
  'insight.bottleneck.group.problem': '{zone}: 단체 동선 분리 검토',
  'insight.bottleneck.critical.problem': '{zone}: 출구 게이트 확장 시급',
  'insight.bottleneck.warning.problem': '{zone}: 출구 흐름 개선 필요',
  'insight.bottleneck.cause':
    '유입 {flowIn}/s > 유출 {flowOut}/s — 병목 지수 {score}',
  'insight.bottleneck.group.rec': '→ 게이트 폭 확장 또는 투어 시간대 분산',
  'insight.bottleneck.nonGroup.rec': '→ 출구 게이트 추가 또는 미디어 배치 분산',

  // Insight engine — density
  'insight.density.problem': '{zone}: 면적 확장 또는 수용 상한 설정',
  'insight.density.cause':
    '밀도 {areaPerPerson}m²/인 < 기준 {standard}m²/인 ({occupancy}명 / {area}m²)',
  'insight.density.rec': '→ 상한 {safeCap}명 설정 또는 {expandM2}m² 확장',

  // Insight engine — skip
  'insight.skip.problem': '인기 미디어 복제 배치 검토',
  'insight.skip.cause': '전체 스킵률 {pct}% — 대기 시간 초과로 관람 포기',
  'insight.skip.rec.withHighSkip': '→ 고스킵 미디어 {count}개 다중 배치 또는 대기열 관리',
  'insight.skip.rec.default': '→ 복제 배치 또는 대기열 관리 시스템 도입',

  // Insight engine — fatigue
  'insight.fatigue.problem': '휴식 존 추가 필요',
  'insight.fatigue.cause': '방문객 P90 피로도 {pct}% 초과 — 휴식 공간 부족',
  'insight.fatigue.rec': '→ 중간 지점 휴식 존 배치 또는 동선 단축',

  // Insight engine — flow efficiency
  'insight.flow.problem': '핵심 전시물 재배치 권장',
  'insight.flow.cause': '완주율 {pct}% — 절반 이상 조기 이탈',
  'insight.flow.rec': '→ 초반 동선에 주요 콘텐츠 배치로 관람 동기 유지',

  // Insight engine — space ROI
  'insight.spaceRoi.low.problem': '{names}: 축소 또는 교체 검토',
  'insight.spaceRoi.low.cause': '공간 효율 평균의 {pct}% — 면적 대비 관람 시간 저조',
  'insight.spaceRoi.low.rec': '→ 크기 축소, 위치 변경, 또는 매력 콘텐츠로 교체',
  'insight.spaceRoi.high.problem': '{name}: 유사 콘텐츠 확대 배치',
  'insight.spaceRoi.high.cause': '공간 효율 평균의 {pct}% — 최고 관람 밀도 ({count}명)',
  'insight.spaceRoi.high.rec': '→ 접근성 강화 + 유사 콘텐츠 증설',

  // Insight engine — content mix
  'insight.contentMix.capacity.problem': '{category}: 수용량 증설 필요',
  'insight.contentMix.layout.problem': '{category}: 배치 구조 개선 필요',
  'insight.contentMix.cause':
    '스킵률 {pct}% ({count}개 / {skipCount}회 스킵, 평균 관람 {avgSec}초)',
  'insight.contentMix.capacity.rec': '→ 복제 배치 또는 동일 유형 추가',
  'insight.contentMix.layout.rec': '→ 간격 조정 또는 타 카테고리와 교차 배치',

  // Insight engine — category labels (content mix)
  'insight.category.analog': '아날로그',
  'insight.category.passive_media': '패시브 미디어',
  'insight.category.active': '액티브',
  'insight.category.immersive': '이머시브',

  // Insight engine — group impact
  'insight.groupImpact.tour.problem': '도슨트 전용 동선 검토',
  'insight.groupImpact.tour.cause':
    '투어 {tourPct}% 인원이 병목 {impactPct}% 유발 ({groupCount}개 그룹 / {tourCount}명)',
  'insight.groupImpact.tour.rec': '→ 투어 시간대 분산 또는 우회 경로 제공',
  'insight.groupImpact.fatigue.problem': '그룹 동선 휴식 존 추가',
  'insight.groupImpact.fatigue.cause':
    '그룹 피로도 {groupPct}% vs 솔로 {soloPct}% ({count}명 체류 배율 높음)',
  'insight.groupImpact.fatigue.rec': '→ 그룹 동선 중간 휴식 존 또는 콘텐츠 수 축소',

  // Insight engine — content fatigue
  'insight.contentFatigue.problem': '{category}: 타 카테고리와 교차 배치',
  'insight.contentFatigue.cause': '{count}개 연속 배치 — 스킵률 {pct}% (피로 누적)',
  'insight.contentFatigue.rec': '→ 사이에 다른 유형 콘텐츠 삽입으로 관람 리듬 변화',

  // Insight engine — fatigue category labels
  'insight.fatigueCategory.analog': '아날로그 전시물',
  'insight.fatigueCategory.screen': '스크린 미디어',
  'insight.fatigueCategory.interactive': '인터랙션 체험',
  'insight.fatigueCategory.immersive': '이머시브 체험',

  // Analytics panel — title tooltips
  'tooltip.summary':
    '현재 시뮬레이션 상태를 요약한 핵심 KPI 패널입니다. Active는 관내에 남아있는 방문객 수, Spawned와 Exited는 시작 시점부터의 누적 입장·퇴장 수, Fatigue는 전체 방문객 평균 피로도, Thru/min은 직전 1분간 퇴장 속도, Elapsed는 시뮬레이션 경과 시간, Peak Zone은 수용률이 가장 높은 존을 표시합니다.',
  'tooltip.agentDistribution':
    '현재 Active 방문객의 행동 분포를 비율 막대로 표시합니다. MOVING(존간 이동), WATCHING(미디어 관람), WAITING(대기열 대기), RESTING(휴식), EXITING(퇴장 중) 다섯 상태로 분류되며, 막대 길이는 Active 대비 해당 행동의 비중을 나타냅니다.',
  'tooltip.insights':
    '시뮬레이션 데이터를 분석해 자동 생성된 개선 권고 목록입니다. 심각도는 critical(빨강, 즉시 조치 필요), warning(주황, 검토 권장), info(파랑, 참고) 세 단계로 구분됩니다. 각 카드 하단의 액션 버튼을 누르면 문제가 발생한 존이나 미디어의 편집 화면으로 바로 이동합니다.',
  'tooltip.liveDashboard':
    '최근 구간의 추이를 스파크라인으로 함께 보여주는 실시간 지표 4종입니다. Active는 현재 관내 인원, Watching은 미디어 관람 중인 인원, Peak Util은 가장 혼잡한 존의 수용률, Fatigue는 전체 평균 피로도를 나타냅니다.',
  'tooltip.zoneRanking':
    '존별 혼잡도와 밀도를 비교하는 정렬형 테이블입니다. Occ은 현재 인원/정원, Util%는 수용률(100% = 정원 포화), m²/p는 1인당 차지 면적을 의미하며, 국제 권장 기준 2.5m² 미만일 경우 빨간색으로 경고합니다. 각 컬럼 헤더를 클릭해 해당 지표 기준으로 오름차순·내림차순 정렬할 수 있습니다.',
  'tooltip.nodeTraffic':
    '웨이포인트 그래프에서 각 노드를 거쳐간 방문객 수를 표시하는 통행량 패널입니다. Entry 노드는 방문객이 생성된 지점, Exit 노드는 퇴장한 지점, 그 외 노드는 경로상 통과한 횟수를 집계합니다. 막대 길이는 최대 통행 노드 대비 상대적 비율입니다.',
};
