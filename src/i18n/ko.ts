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
    '현재 프로젝트의 에이전트, 미디어 통계, KPI 기록, 리플레이 데이터가 모두 초기화됩니다.\n한 번 초기화하면 복구할 수 없습니다. 진행하시겠습니까?',
  'sim.stop.cancel': '취소',
  'sim.stop.confirm': '초기화',

  // Simulation — visitor load (검증 tier 인라인 입력)
  'sim.visitorLoad.label': '방문객 수',
  'sim.visitorLoad.unit': '명',
  'sim.visitorLoad.useRecommendedTooltip': '면적 기반 권장값으로 되돌리기',
  'sim.visitorLoad.hint': '이 인원이 다 다녀가면 시뮬 종료. 면적이 클수록 권장값도 큼.',
  'sim.visitorLoad.recommendBasis': '면적 {area}㎡ 기반 권장: {count}명',
  'sim.visitorLoad.recommendApplied': '추천 방문객 수가 적용되었습니다',
  'sim.visitorLoad.recommendCta': '면적 기반 권장 {count}명',

  // Build — waypoint node descriptions (tooltips)
  'build.node.entry.desc': '스폰 지점',
  'build.node.exit.desc': '퇴장 지점',
  'build.node.zone.desc': '전시 거점',
  'build.node.attractor.desc': '고인력 타겟',
  'build.node.hub.desc': '교차로/분기점',
  'build.node.rest.desc': '휴게/버퍼',
  'build.node.portal.desc': '층/동 간 이동 허브 (shaft로 그룹화)',

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
  'scenario.compare.modeMismatch': '⚠️ 종료 기준이 다른 시나리오 비교 (A: {modeA}, B: {modeB}) — 직접 비교 어려움. 같은 모드로 재실행 권장.',
  'scenario.compare.modeTime': '시간 기준',
  'scenario.compare.modePerson': '사람 기준',

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

  // Sensitivity panel — UI labels
  'sensitivity.title': '민감도 분석',
  'sensitivity.current': '현재',
  'sensitivity.impact.high': 'HIGH',
  'sensitivity.impact.medium': 'MEDIUM',
  'sensitivity.impact.low': 'LOW',
  'sensitivity.factor.entranceCapacity': '입구 수용 인원',
  'sensitivity.factor.spawnRate': '유입률',
  'sensitivity.factor.exhibitionArea': '전시 공간',
  'sensitivity.factor.restCapacity': '휴식 공간 수용 인원',
  'sensitivity.factor.gateWidth': '게이트 폭',
  'sensitivity.unit.visitors': '명',
  'sensitivity.unit.perSec': '/초',
  'sensitivity.unit.zones': '개',
  'sensitivity.unit.seats': '석',
  'sensitivity.unit.px': 'px',

  // Insight engine — congestion
  'insight.congestion.critical.problem': '{zone}: 즉시 입장 제한 필요',
  'insight.congestion.critical.cause': '현재 {occupancy}명 / 적정 {capacity}명 ({pct}%)',
  'insight.congestion.critical.rec': '→ 게이트 추가 또는 존 면적 확장',
  'insight.congestion.warning.problem': '{zone}: 동선 분산 권장',
  'insight.congestion.warning.cause': '수용률 {pct}% — 여유 공간 부족',
  'insight.congestion.warning.rec': '→ 인접 존으로 관심 요소 재배치',

  // Insight engine — bottleneck
  'insight.bottleneck.group.problem': '{zone}: 단체 방문 집중으로 병목',
  'insight.bottleneck.critical.problem': '{zone}: 출구 처리 한계 초과',
  'insight.bottleneck.warning.problem': '{zone}: 출구 흐름 지연',
  'insight.bottleneck.cause':
    '유입 {flowIn}/s > 유출 {flowOut}/s — 병목 지수 {score}',
  'insight.bottleneck.group.rec': '→ 투어 타임슬롯 분산 또는 단체 비율 축소',
  'insight.bottleneck.nonGroup.rec': '→ 출구 게이트 추가 또는 존 용량 상향',

  // Insight engine — density
  'insight.density.problem': '{zone}: 면적 확장 또는 수용 상한 설정',
  'insight.density.cause':
    '밀도 {areaPerPerson}m²/인 < 기준 {standard}m²/인 ({occupancy}명 / {area}m²)',
  'insight.density.rec': '→ 상한 {safeCap}명 설정 또는 {expandM2}m² 확장',

  // Insight engine — skip
  'insight.skip.problem': '인기 미디어 복제 배치 검토',
  'insight.skip.problem.withNames': '고스킵 미디어 복제 배치 검토 — {names}',
  'insight.skip.cause': '전체 스킵률 {pct}% — 대기 시간 초과로 관람 포기',
  'insight.skip.rec.withHighSkip': '→ 해당 미디어 복제 배치 또는 수용량 상향 ({count}개: {names})',
  'insight.skip.rec.default': '→ 동일 미디어 복제 배치 또는 수용량 상향',

  // Insight engine — fatigue
  'insight.fatigue.problem': '휴식 존 추가 필요',
  'insight.fatigue.cause': '방문객 P90 피로도 {pct}% 초과 — 휴식 공간 부족',
  'insight.fatigue.rec': '→ 중간 지점 휴식 존 배치 또는 동선 단축',

  // Insight engine — flow efficiency
  'insight.flow.problem': '고몰입 콘텐츠 초반 배치 권장',
  'insight.flow.problem.withNames': '고몰입 콘텐츠 초반 배치 권장 — {names}',
  'insight.flow.cause': '완주율 {pct}% — 절반 이상 조기 이탈',
  'insight.flow.rec': '→ 초반 동선에 관람 동기를 유발할 고몰입 콘텐츠 배치',
  'insight.flow.rec.withNames': '→ 고몰입 콘텐츠({names})를 초반 동선에 배치해 관람 동기 유지',

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
  'insight.groupImpact.tour.rec': '→ 투어 타임슬롯 분산 또는 단체 비율 축소',
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
    '현재 Active 방문객의 행동 분포를 비율 막대로 표시합니다. MOVING(노드간 이동), WATCHING(미디어 관람), WAITING(대기열 대기), RESTING(휴식), EXITING(퇴장 중) 다섯 상태로 분류되며, 막대 길이는 Active 대비 해당 행동의 비중을 나타냅니다.',
  'tooltip.insights':
    '시뮬레이션 데이터를 분석해 자동 생성된 개선 권고 목록입니다. 심각도는 critical(빨강, 즉시 조치 필요), warning(주황, 검토 권장), info(파랑, 참고) 세 단계로 구분됩니다. 각 카드 하단의 액션 버튼을 누르면 문제가 발생한 존이나 미디어의 편집 화면으로 바로 이동합니다.',
  'tooltip.liveDashboard':
    '최근 구간의 추이를 스파크라인으로 함께 보여주는 실시간 지표 4종입니다. Active는 현재 관내 인원, Watching은 미디어 관람 중인 인원, Peak Util은 가장 혼잡한 존의 수용률, Fatigue는 전체 평균 피로도를 나타냅니다.',
  'tooltip.zoneRanking':
    '존별 혼잡도와 밀도를 비교하는 정렬형 테이블입니다. Occ은 현재 인원/정원, Util%는 수용률(100% = 정원 포화), m²/p는 1인당 차지 면적을 의미하며, 국제 권장 기준 2.5m² 미만일 경우 빨간색으로 경고합니다. 각 컬럼 헤더를 클릭해 해당 지표 기준으로 오름차순·내림차순 정렬할 수 있습니다.',
  'tooltip.nodeTraffic':
    '웨이포인트 그래프에서 각 노드를 거쳐간 방문객 수를 표시하는 통행량 패널입니다. Entry 노드는 방문객이 생성된 지점, Exit 노드는 퇴장한 지점, 그 외 노드는 경로상 통과한 횟수를 집계합니다. 막대 길이는 최대 통행 노드 대비 상대적 비율입니다.',

  // Left panel — section tooltips
  'tooltip.project':
    '프로젝트 관리 패널입니다. 새로운 시나리오를 생성하거나, 현재 작업 중인 프로젝트를 버전 메타데이터와 함께 JSON 파일로 저장하거나, 기존 프로젝트 파일을 불러올 수 있습니다. 하단 목록에는 최근 사용한 프로젝트가 표시되어 빠르게 접근할 수 있습니다.',
  'tooltip.simulation':
    '시뮬레이션 제어 패널입니다. 에이전트 기반 시뮬레이션을 시작·일시정지·중지하고 히트맵 오버레이를 전환합니다. 실행 중에는 현재 Phase와 경과 시간, 활성 에이전트 수가 함께 표시됩니다.',
  'tooltip.spawn':
    '방문객 생성 설정 패널입니다.\n• 분당 생성률(Spawn Rate /min): Entry 노드에서 1분당 새로 들어오는 평균 방문객 수.\n• Duration(min): 시뮬레이션 총 길이. time-mode 일 때 종료 기준이 됩니다.\n• 관람 예산(분, 자동): 방문객 1명이 평균적으로 머무는 권장 시간. 자동 모드는 zone/미디어 수에 따라 추정.\n• 시간대별 슬롯: 1시간 단위 등으로 spawn rate / profile 구성을 다르게 줄 때 사용.',
  'tooltip.visitors':
    '방문객 프로필 설정 패널입니다. 시뮬레이션 인구의 인구학적 비율, 참여도, 그룹 크기 분포, 인내심과 보행 속도 같은 행동 파라미터를 조정합니다.',
  'tooltip.zones':
    '존 목록입니다. 클릭해서 편집 대상으로 선택할 수 있습니다. 입출구는 zone 이 아니라 waypoint graph 의 Entry/Exit 노드로 정의됩니다 (좌측 Build 도구에서 Node 추가). 괄호 안의 숫자는 전체 존 개수입니다.',

  // Left panel — domain section headers
  'mainLayout.section.build': '공간 빌드',
  'mainLayout.section.operations': '운영 시나리오',

  // AnalyticsPanel — tab group labels (Live / Post)
  'analytics.group.live': '실시간',
  'analytics.group.post': '회고 / 비교',

  // LivePulse — Simulate 단계 우측 패널 (분석 깊이 X, 모니터링만)
  'pulse.idle': '시뮬레이션을 시작하면 실시간 진행 상황이 여기에 표시됩니다.',
  'pulse.progress.title': '진행도',
  'pulse.progress.running': '실행 중',
  'pulse.progress.paused': '일시정지',
  'pulse.progress.personSub': '입장 {spawned} · 퇴장 {exited} / {total}명',
  'pulse.progress.timeSub': '{elapsed} / {total}',
  'pulse.kpi.active': '현재 관람객',
  'pulse.kpi.activeSub': '관람 {watching} · 대기 {waiting}',
  'pulse.kpi.peak': '최고 혼잡',
  'pulse.kpi.fatigue': '평균 피로도',
  'pulse.kpi.skip': 'Skip률',
  'pulse.status.ok': '정상 — 큰 문제 없이 흐르고 있습니다.',
  'pulse.status.crowded': '주의 — {zone} {pct}% 까지 차오름',
  'pulse.status.bottleneck': '병목 {n}곳 — Analyze 에서 위치 확인',
  'pulse.hint.afterEnd': '시뮬레이션이 끝나면 자동으로 분석 화면으로 전환됩니다.',
  'pulse.zones.title': '혼잡 영역 TOP',
  'pulse.zones.empty': '아직 점유된 영역이 없습니다',
  'pulse.media.title': '관람 중 TOP',
  'pulse.media.empty': '아직 관람 중인 전시물이 없습니다',
  'pulse.media.viewers': '{n}명',

  // CanvasToolbar — sim context chips
  'canvasToolbar.heatmap': '히트맵',
  'canvasToolbar.heatmap.replayDisabled': '리플레이 중에는 사용할 수 없습니다',
  'canvasToolbar.pin': '순간 기록',

  // MainLayout — mode badge tooltip
  'mainLayout.modeBadge.tooltip': '클릭해서 Setup 으로 이동 — 모드 변경',

  // AnalyticsPanel — Action tab (validation tier CTA)
  'analytics.action.validation.title': '결과 요약 + 다음 행동',
  'analytics.action.validation.desc':
    '이 결과가 만족스러우면 그대로 저장하고, 다른 안을 시험하려면 변형을 만들어 Build 에서 수정하세요.',
  'analytics.action.validation.kpi.bottleneck': '병목',
  'analytics.action.validation.kpi.dwell': '평균체험',
  'analytics.action.validation.kpi.skip': '스킵률',
  'analytics.action.validation.saveBtn': '이대로 저장',
  'analytics.action.validation.forkBtn': '변형 만들기',
  'analytics.action.validation.saved': '"{{name}}" 저장됨',

  // AnalyticsPanel — Action 탭 상단 핫스팟 (어디가 막혔나 / 어디로 흘렀나)
  'analytics.action.hotspots.title': '핫스팟',
  'analytics.action.hotspots.bottleneckTitle': '병목 영역',
  'analytics.action.hotspots.bottleneckEmpty': '심각한 병목이 발견되지 않았습니다',
  'analytics.action.hotspots.mediaTitle': '가장 많이 본 전시물',
  'analytics.action.hotspots.mediaEmpty': '관람 데이터가 없습니다',
  'analytics.action.hotspots.score': '점수 {n}',
  'analytics.action.hotspots.watchCount': '{n}회',

  // MainLayout — Simulate 단계 완료 후 분석으로 이동 CTA
  'mainLayout.goAnalyze.title': '시뮬레이션 완료 — 분석으로 이동',
  'mainLayout.goAnalyze.sub': 'KPI · 변형 비교 · 핀 · 리포트 전체 보기',

  // Toast — 단계 전환 알림
  'toast.simCompleted': '시뮬레이션 완료. 분석 단계로 이동했어요.',

  // AnalyzeLayout — 좌측 요약 패널
  'analyze.summary.title': '시뮬 결과 요약',
  'analyze.summary.visitors': '입퇴장',
  'analyze.summary.completion': '완주율',
  'analyze.summary.avgDwell': '평균체류',
  'analyze.summary.peak': '최고혼잡',
  'analyze.summary.fatigue': '평균피로',
  'analyze.summary.skip': '스킵률',
  'analyze.summary.bottleneck': '병목 {{n}}건 — Pin 탭에서 시점별 확인',

  // Media editor — field tooltips
  'tooltip.media.orientation':
    '미디어의 정면 방향입니다(0°=위, 90°=오른쪽, 180°=아래, 270°=왼쪽). 방문객이 모여 관람하는 영역의 위치를 결정합니다.',
  'tooltip.media.interaction':
    '상호작용 유형입니다. Passive는 원거리 관람형(예: 미디어 월), Active는 박스 안에 들어가서 체험(예: 키오스크), Staged는 정해진 간격으로 그룹이 함께 입장하는 세션형(예: VR), Analog는 박스 외부 근접 위치에서 관람하는 실물 전시입니다.',
  'tooltip.media.omnidirectional':
    '활성화하면 방문객이 360° 어느 방향에서나 접근할 수 있으며, 유물이나 조각처럼 중앙에 배치된 전시에 적합합니다. 비활성화하면 Orientation 방향을 기준으로 미디어 앞쪽에 모여 관람합니다.',
  'tooltip.media.stageInterval':
    'Staged 타입에서 한 세션과 다음 세션 사이의 간격입니다. 방문객들은 입구 지점에서 대기하다가 다음 세션이 시작되면 그룹으로 함께 입장합니다.',
  'tooltip.media.capacity':
    '동시 관람 가능한 최대 인원입니다. Active와 Staged 타입은 슬롯 할당을 통해 엄격한 상한을 적용하고, Passive 타입은 약간의 초과를 허용하는 소프트 상한으로 동작합니다.',
  'tooltip.media.engagement':
    '한 명의 방문객이 해당 미디어에 머무는 평균 관람 시간입니다. 실제 체류 시간은 방문객 프로필, 참여도, 현재 피로도에 따라 달라집니다.',
  'tooltip.media.viewDistance':
    '방문객이 관람을 위해 미디어로부터 떨어져 서는 거리입니다. 값이 클수록 멀리 떨어져 관람하며(예: 미디어 월), 값이 작을수록 전시에 가깝게 붙어 관람합니다.',
  'tooltip.media.attractiveness':
    '방문객이 해당 미디어를 선택할 가능성을 0~1 척도로 나타낸 값입니다. 값이 높을수록 더 많은 방문객을 끌어당기고 전체 동선 패턴이 이 미디어 쪽으로 이동합니다.',
  'tooltip.media.queueBehavior':
    '수용 인원이 가득 찼을 때의 대기 방식입니다. None은 해당 미디어를 건너뛰고 다음 목적지로 이동, Linear는 단일 줄로 대기, Area는 미디어 주변 지정 영역 안에서 대기하는 방식입니다.',
  'tooltip.media.groupFriendly':
    '방문객 그룹이 함께 미디어를 체험할 수 있는지 여부입니다. 활성화하면 그룹 구성원이 관람 시간을 공유하며 하나의 단위로 함께 입장·퇴장합니다.',

  // Visitor config — skip threshold
  'tooltip.skipFormula':
    '방문객이 대기 중인 미디어를 포기하고 다른 목적지로 이동하는 조건을 정의합니다. 실제 대기 시간이 Patience × Attractiveness × Skip Multiplier × Max Wait를 초과하면 방문객이 해당 미디어를 건너뛰고 이동합니다. 값이 클수록 방문객의 대기 인내 한도가 커지고, 값이 작을수록 더 일찍 포기합니다.',

  // Zone editor — capacity semantics
  'tooltip.zone.capacity':
    '존 전체가 수용 가능한 공간적 인원수입니다. 면적과 국제 밀도 기준(2.5 m²/인)으로 자동 계산되며, 이 값을 초과하면 해당 존으로 향하는 경로가 감점되어 방문객이 덜 몰립니다.',

  // Node (waypoint) inspector — field tooltips
  'tooltip.node.attraction':
    '경로 선택 Score 공식의 가중치입니다(0~1). 값이 높을수록 이 노드로 더 많은 방문객이 유입되며, attractor/rest 같은 거점의 인기도를 조절할 때 사용합니다.',
  'tooltip.node.dwell':
    '이 노드에서 최초 방문 시 머무르는 시간입니다. rest/attractor 타입에만 적용되며, 동선 상의 잠깐 쉬어가는 지점이나 대표 전시물의 체류 시간을 조절합니다.',
  'tooltip.node.capacity':
    'POI 혼잡도 한도입니다(이 한 지점에 동시에 몰리는 방문객 수 기준). 존의 공간 수용량과 달리 Score 공식의 군집 페널티 계산에 쓰이며, 작을수록 이 노드가 빨리 "혼잡" 판정을 받아 다른 후보로 분산됩니다.',
  'tooltip.node.spawnWeight':
    '여러 Entry 노드 중 이 지점에서 방문객이 스폰될 확률 가중치입니다. 값이 클수록 전체 인구가 이 입구에서 더 많이 나타납니다.',

  // Experience tab — panel tooltips
  'tooltip.experience.timeSpent':
    '방문객이 전시관에 머문 시간(입장부터 퇴장까지, 분 단위)의 분포를 보여줍니다. 초록 막대는 이미 퇴장한 방문객의 최종 체류 시간이고, 파란 막대는 아직 관내에 있는 방문객의 현재까지 경과 시간입니다. 막대 구간 너비는 관측된 최장 체류 시간에 맞춰 자동으로 조정됩니다.',
  'tooltip.experience.quality':
    '현재 관내 방문객의 체험 품질을 나타냅니다. Depth는 한 명이 관람한 미디어 수를 0개/1–2개/3–5개/6개 이상으로 분포 표시하고, Avg Fatigue는 평균 피로도(60% 초과 빨강, 40% 초과 주황)를, High Fatigue는 피로도 70%를 넘는 방문객 비율을 보여줍니다. 피로도가 높으면 과잉 자극이나 과도한 체류를 의심해야 합니다.',
  'tooltip.experience.zoneMedia':
    '존별 미디어 성과 패널입니다. 각 행은 해당 존에 속한 미디어들의 집계치(관람 수 w, 스킵률 %, 평균 관람 시간, 피크 관람 인원/총 수용량)를 보여줍니다. 행을 펼치면 개별 미디어 단위로 확인할 수 있고, 오른쪽에는 실시간 상태 표시(● 관람 중, ↻ 대기 중)가 나타납니다.',
  'tooltip.experience.flowVsExperience':
    '존별로 관람 밀도와 체험 깊이의 균형을 보여줍니다. Pop은 현재 체류 인원, Depth는 평균 관람 미디어 수(관람/전체) — 0.5 미만이면 빨간색 경고, Fatigue는 해당 존 방문객의 평균 피로도입니다. 방문객이 관람 없이 통과하는 경우 ⟿ 아이콘으로 rush-through 존을 표시합니다.',

  // Experience tab — Time Spent chart labels
  'experience.timeSpent.title': '체류 시간 분포',
  'experience.timeSpent.exited': '퇴장',
  'experience.timeSpent.ongoing': '체류 중',
  'experience.timeSpent.avg': '평균',

  // VELA Report — toolbar
  'vela.toolbar.export': 'PDF 내보내기',
  'vela.toolbar.exporting': '내보내는 중...',
  'vela.foot.product': 'VELA — 공간 시뮬레이션 & 동선 분석 · 리포트 v5',
  'vela.foot.generated': '생성일 {date}',
  'vela.loadScenario': '먼저 시나리오를 불러와 주세요.',
  'vela.noSimTitle': '시뮬레이션 데이터 없음',
  'vela.noSimBody': '이 시나리오는 아직 실행되지 않았습니다.\n▶ 시뮬레이션을 실행한 후 다시 여세요.',

  // VELA Report — Hero
  'vela.hero.brand': 'VELA · 공간 시뮬레이션 리포트',
  'vela.hero.line': '리포트 · {runId} · {date}',
  'vela.hero.titleA': '공간',
  'vela.hero.titleB': '리포트',
  'vela.hero.subtitleA': '우리는 ‘얼마나 많이’가 아니라, ‘',
  'vela.hero.subtitleEm': '어떻게 경험되는가',
  'vela.hero.subtitleB': '’를 측정합니다.',
  'vela.hero.kGenerated': '생성일',
  'vela.hero.kDuration': '시뮬레이션',
  'vela.hero.kVisitors': '방문객',
  'vela.hero.visitorsFmt': '{count}명',
  'vela.hero.kRunId': 'Run ID',
  'spawn.mode.label': '종료 기준',
  'spawn.mode.time': '시간 기준',
  'spawn.mode.person': '사람 기준',
  'spawn.mode.timeHint': 'Duration 도달 시 종료. 운영 검토용 — 시간당 수용 인원·피크 분석.',
  'spawn.mode.personHint': '모든 관람객 퇴장 시 종료 (Duration은 safety cap). 설계 검증용 — 체류·완주율 분석.',
  'spawn.mode.lockedByPolicy': '입장 정책 활성 시 시간 모드만 사용 가능 (사람 모드는 totalCount 도달 시 스폰 정지 → 정책 sweep 불가).',
  'spawn.policyActiveHint': '입장 정책 활성 — 지속 도착 모드 (Total/Max Concurrent 무시). Duration 동안 무한 도착, 정책의 동시수용/슬롯이 실제 cap.',
  'spawn.recStay.label': '관람 예산 (분)',
  'spawn.recStay.labelAuto': '관람 예산 (분, 자동)',
  'spawn.recStay.switchAuto': '자동 계산으로 전환',
  'spawn.recStay.switchManual': '수동 입력으로 전환',
  'spawn.recStay.hint': '방문자별 체류 시간 한도. 자동: 30분 + 존 {zones}개×3분 + 미디어 {media}개×2분, 최대 180분.',

  // ── Phase 1: 운영 정책 (Operations Policy) ──
  'ops.title': '입장 정책',
  'ops.modeLabel': '정책 모드',
  'ops.mode.unlimited': '무제한',
  'ops.mode.unlimited.desc': '도착 즉시 입장. 정책 미적용 (기본).',
  'ops.mode.concurrent-cap': '동시 수용 제한',
  'ops.mode.concurrent-cap.desc': '내부 인원 < N 일 때만 입장.',
  'ops.mode.rate-limit': '시간당 입장 제한',
  'ops.mode.rate-limit.desc': '롤링 1시간 동안 N 명까지만.',
  'ops.mode.time-slot': '예약 슬롯',
  'ops.mode.time-slot.desc': '슬롯 (예: 30분) 당 K 명, 슬롯 만료 시 reset.',
  'ops.mode.hybrid': '하이브리드',
  'ops.mode.hybrid.desc': '동시 수용 + 슬롯 동시 적용 (대형 시설).',
  'ops.field.maxConcurrent': '동시 수용 (명)',
  'ops.field.maxPerHour': '시간당 입장 (명/h)',
  'ops.field.slotDurationMin': '슬롯 길이 (분)',
  'ops.field.perSlotCap': '슬롯당 입장 (명)',
  'ops.field.maxWaitMin': '인내심 (최대 대기 시간, 이 시간을 넘으면 이탈)',
  'ops.live.title': '라이브 큐',
  'ops.live.queueLength': '대기 인원',
  'ops.live.oldestWait': '최장 대기',
  'ops.live.totalAbandoned': '누적 포기',
  'ops.live.empty': '대기 0명 — 도착 즉시 입장 중.',
  'ops.lockedHint': '시뮬 진행 중에는 정책을 변경할 수 없습니다.',

  'ops.patienceGuide':
    '🎟️ 인내심 = 한 사람이 외부 큐에서 견디는 한계 시간.\n\n' +
    '현실 기준 (Wharton 큐잉 연구 + 미술관 평균):\n' +
    '• 무료 walk-in: 10–15분\n' +
    '• 유료 일반 전시: 30–45분 ← 표준\n' +
    '• 블록버스터 (Klimt, Van Gogh 류): 45–60분\n' +
    '• 테마파크 헤드라이너: 60–90분\n' +
    '• 사전예약 timed-entry: 30–60분\n\n' +
    '⚠️ 너무 짧으면 (예: 3분) 모든 cap 케이스가 saturated → sweep 의미 사라짐.',
  'ops.patienceModelLabel': '인내심 분포',
  'ops.patienceModelHint':
    '🎲 분포 모델:\n\n' +
    '• 균일 (fixed): 모두 같은 인내심 — 빠른 비교용\n' +
    '• 정규분포 (normal): 사람마다 다름 (현실 모델)\n\n' +
    '📏 σ (표준편차) 설정 가이드 — 전시 성격에 맞게 직접 결정:\n' +
    '• 무료 walk-in: σ ≈ 평균의 50% (commitment 폭 큼)\n' +
    '• 유료 일반 전시: σ ≈ 평균의 30% (어느정도 commit)\n' +
    '• 블록버스터: σ ≈ 평균의 20% (모두 줄설 각오)\n' +
    '• 어린이 체험: σ ≈ 평균의 50% (컨디션 변동 큼)\n' +
    '• 기술/컨퍼런스: σ ≈ 평균의 30%\n\n' +
    '※ σ 는 평균과 독립 — 평균을 바꿔도 자동 변경 안 됨.',
  'ops.patienceModel.fixed': '균일',
  'ops.patienceModel.normal': '정규분포',
  'ops.field.patienceStdMin': '표준편차 σ (분)',
  'ops.field.patienceStdPct': '표준편차 σ (평균의 %)',
  'ops.useModifiersLabel': '프로필/참여도별 다르게 (선택)',
  'ops.useModifiersHint':
    '체크하면 visitor mix 의 프로필 분포에 따라 평균 인내심이 달라짐.\n' +
    'VIP / 어린이 / 깊은체험 등 사람마다 평균 자체가 이동.\n\n' +
    '⚠️ 자기 전시에 해당 프로필이 거의 없으면 (예: 기술 컨퍼런스 → 어린이 0%) 효과 미미. 단순 모델 (체크 해제) 권장.',
  'ops.patienceProfileNote':
    '프로필 배수 (visitor mix 에 해당 프로필 있을 때만 발동):\n' +
    '• VIP ×1.3 (사전 commit, 유료)\n' +
    '• 일반 ×1.0 (기준)\n' +
    '• 어린이 ×0.6 (지루함 빨리 느낌) ※ 어린이 전용 시설은 ×1.0 권장\n' +
    '• 노약자/장애 ×0.85 (서있기 어려움)\n\n' +
    '참여도 배수: 깊은체험 ×1.4 / 둘러보기 ×1.0 / 가벼운 ×0.7.\n\n' +
    '※ 자기 전시에 없는 프로필 줄은 무시. 배수가 안 맞다고 판단되면 spawn 패널의 visitor mix 비율로 조정.',

  // 모드 선택 화면 — 새 프로젝트 만든 직후 첫 진입 설문 (v2 IA 재구성 2026-04-28)
  'modeSelect.title': '어떤 시나리오를 시뮬레이션할까요?',
  'modeSelect.subtitle': '선택한 방향에 따라 입력해야 할 정보와 결과 리포트가 달라집니다.',
  'modeSelect.skip': '건너뛰기 — 기본값으로 시작',
  'modeSelect.back': '← 뒤로',

  // 4-step 워크플로우 indicator
  'workflow.step1': 'Setup',
  'workflow.step1.sub': '시나리오 선택',
  'workflow.step2': 'Build',
  'workflow.step2.sub': '공간 구성',
  'workflow.step3': 'Simulate',
  'workflow.step3.sub': '시뮬레이션 실행',
  'workflow.step4': 'Analyze',
  'workflow.step4.sub': '결과 분석',
  // stepper 잠금 사유 — 미충족 시 tooltip 으로 노출
  'step.lock.setup': '모드 변경은 새 프로젝트 또는 변형 fork 로만',
  'step.lock.build': '먼저 모드를 선택하세요',
  'step.lock.simulate': '영역과 전시물을 1개 이상 배치하세요',
  'step.lock.analyze': '시뮬레이션을 먼저 실행하세요',

  // Build 단계 (공간 구성) — task accordion 4개
  'build.task.region.label': '공간',
  'build.task.region.sub': '관람 공간(리전)을 만들고 — 도면은 옵션',
  'build.task.zones.label': '영역',
  'build.task.zones.sub': '관람 공간을 그리기',
  'build.task.exhibits.label': '전시물',
  'build.task.exhibits.sub': '작품·미디어 배치',
  'build.task.flow.label': '동선',
  'build.task.flow.sub': '관람 흐름 연결',
  'build.next': '시뮬레이션으로 →',
  'build.next.needZones': '먼저 영역을 그려야 진행할 수 있어요',
  'build.next.needExhibits': '전시물을 1개 이상 배치하면 진행할 수 있어요',

  // Build 도구 모드 (task accordion 안 토글)
  'build.mode.select': '선택',
  'build.mode.zone': '영역',
  'build.mode.exhibit': '전시물',
  'build.mode.node': '노드',
  'build.mode.edge': '연결',

  // Build task 안 안내문
  'build.hint.selectZoneFirstShort': '먼저 영역을 선택하세요',
  'build.list.zonesEmpty': '아직 영역이 없습니다. 위에서 영역을 추가하세요.',
  'build.list.exhibitsEmpty': '이 영역에 전시물이 없습니다. 카테고리에서 추가하세요.',
  'build.exhibit.tooLarge': '이 전시물이 선택한 영역보다 큽니다. 영역을 키우거나 더 작은 전시물을 선택하세요.',
  'build.list.zonesTitle': '영역 ({n})',
  'build.list.exhibitsTitle': '전시물 ({n})',
  'build.list.nodesTitle': '노드 ({n})',
  'build.list.edgesTitle': '연결 ({n})',
  'build.list.flowEmpty': '아직 노드가 없습니다. 좌측 "노드" 도구로 캔버스에 추가하세요.',
  'build.list.edgesEmpty': '연결이 없습니다. "연결" 도구로 노드를 이어주세요.',
  'build.right.empty': '캔버스에서 객체를 선택하면 여기서 편집할 수 있어요.',
  'build.right.flowEmpty': '동선은 캔버스에서 노드를 클릭하거나 자동 연결을 사용하세요.',
  'build.right.regionEmpty': '왼쪽에서 공간(리전)을 선택하면 여기서 정보를 볼 수 있어요. 도면 첨부는 옵션입니다.',

  // Build > 공간(Region) task
  'build.region.leftHint': '관람 공간(리전)을 추가하고, 우측 리스트에서 선택해 도면을 첨부할 수 있어요. 도면은 옵션입니다.',
  'build.region.addAction': '공간 추가',
  'build.region.arrangeAction': '여러 층 자동 정렬',
  'build.region.rightEmpty': '아직 공간이 없습니다. 좌측에서 "공간 추가" 를 눌러 시작하세요.',
  'build.region.overlayLabel': '도면 (옵션)',
  'build.region.overlayOn': '도면 첨부됨',
  'build.region.overlayHidden': '도면 첨부됨 (숨김)',
  'build.region.overlayOff': '도면 없음',
  'build.region.add': '추가',
  'build.region.addFirst': '+ 공간 추가',
  'build.region.arrange': '자동 정렬',
  'build.region.listTitle': '공간 ({n})',
  'build.region.zone': '영역',
  'build.region.zones': '영역',
  'build.region.editOverlay': '도면 편집',
  'build.region.addOverlay': '도면 추가',
  'build.region.show': '보이기',
  'build.region.hide': '숨김',
  'build.region.moveUp': '위로',
  'build.region.moveDown': '아래로',
  'build.region.rename': '이름 변경',
  'build.region.delete': '삭제',
  'build.region.confirmDelete': '"{name}" 공간을 삭제할까요? 이 공간의 영역, 전시물, 동선이 모두 사라집니다.',

  // Build > 도면 (Region 안의 옵션)
  'build.floor.upload': '도면 업로드',
  'build.floor.dropHint': '도면 이미지를 끌어 놓거나 클릭해서 업로드',
  'build.floor.scale': '스케일',
  'build.floor.replace': '교체',
  'build.floor.removeAria': '제거',
  'build.floor.addLevel': '+ 여러 층 추가',
  'build.floor.edit': '편집',
  'build.floor.done': '완료',
  'build.floor.hide': '숨김',
  'build.floor.show': '보기',
  'build.floor.reset': '초기화',
  'build.floor.arrange': '층 자동 정렬',
  'build.floor.editHint': '캔버스에서 도면을 끌어 이동, 모서리로 크기 조정, 상단 핸들로 회전',
  'build.floor.rotation': '회전',
  'build.floor.cal.start': '5m 캘리브레이션',
  'build.floor.cal.title': '5m 기준선 — 길이 맞추기',
  'build.floor.cal.hint': '캔버스의 양 끝점을 도면 위 알려진 5m 구간(예: 출입문 폭, 표시된 길이)에 맞춰 끌어주세요. 적용을 누르면 도면 스케일이 자동 보정됩니다.',
  'build.floor.cal.apply': '적용',
  'build.floor.cal.cancel': '취소',

  // Build 하단 inspector 빈 상태 통계 (BuildLayout 재작성 시 제거 예정)
  'build.bottom.empty': '편집할 객체를 선택하거나, 위에서 작업을 계속하세요.',
  'build.bottom.statsFloors': '{f}개 층',
  'build.bottom.statsZones': '{z}개 영역',
  'build.bottom.statsExhibits': '{m}개 전시물',

  // Setup 1단계: 큰 binary 분기
  'modeSelect.branch.validation.label': '공간 디자인 평가',
  'modeSelect.branch.validation.tagline': '동선·배치가 효과적인지',
  'modeSelect.branch.operations.label': '운영 시뮬레이션',
  'modeSelect.branch.operations.tagline': '실제 방문 시 무슨 일이 벌어질지',
  'modeSelect.branch.pickOne': '둘 중 하나를 골라주세요',
  'modeSelect.branch.changeBranch': '← 다른 방향 선택',

  // Setup 2단계: 워싱된 sub-mode 한 줄 카피 (jargon 없음)
  'modeSelect.sub.layout_validation': '공간 디자인이 좋은지',
  'modeSelect.sub.curation_validation': '전시 순서가 효과적인지',
  'modeSelect.sub.media_experience': '미디어가 잘 소비되는지',
  'modeSelect.sub.free_admission': '그냥 자유 입장하면 어떻게 될지',
  'modeSelect.sub.free_with_throttle': '평소 자유, 폭주 시만 통제',
  'modeSelect.sub.timed_reservation': '시간 예약제로 운영',
  'modeSelect.sub.controlled_admission': '동시 인원 제한',
  'modeSelect.sub.group_visit': '단체 + 개인 섞임',
  'modeSelect.sub.lockedSoon': '곧',

  // Setup 우측 가이드
  'modeSelect.guide.firstTime': '처음이세요?',
  'modeSelect.guide.watchIntro': '1분 가이드 ▶',
  'modeSelect.guide.comingSoon': '가이드 영상 준비 중',

  // ── Phase 1 UX: 체험 모드 (Experience Modes, 2026-04-26) ──
  'experienceMode.title': '체험 모드',
  'experienceMode.titleHint':
    '🎯 무엇을 검증/예측할지 먼저 고르세요.\n\n' +
    '체험 모드는 입장 정책·만족도 가중치·리포트 관점을 자동으로 맞춰주는 _상위_ 설정입니다.\n\n' +
    '• 검증 (Validation): 변형 간 비교를 위한 baseline (큐 미발생)\n' +
    '• 운영 예상 (Operations): 단일 시나리오 시간대별 추이 + 권장',
  'experienceMode.question': '무엇을 검증/예측하시나요?',
  'experienceMode.lockedHint': '시뮬 진행 중에는 모드를 변경할 수 없습니다.',
  'experienceMode.changeConfirm':
    '체험 모드를 바꾸면 입장 정책과 만족도 가중치가 새 모드의\n기본값으로 재설정됩니다. 진행할까요?',
  'experienceMode.disabledHint': '이 모드는 {phase} 에서 활성화됩니다.',
  'experienceMode.disabledLine': '🔒 {phase} 에서 활성화 예정',

  // 2-tier 헤더
  'experienceMode.tier.validation': '분석 — 이 설계가 좋은가',
  'experienceMode.tier.operations': '운영 예상 — 이렇게 운영하면',

  // 8 모드 라벨 + 짧은 설명
  'experienceMode.layout_validation.label': '공간 설계 분석',
  'experienceMode.layout_validation.desc': '동선, 공간 구성, 체류 흐름을 기반으로\n설계 품질 분석.',
  'experienceMode.curation_validation.label': '큐레이션 분석',
  'experienceMode.curation_validation.desc': '작품 위치·순서·시리즈 응집의 변형 비교.',
  'experienceMode.media_experience.label': '미디어 경험 분석',
  'experienceMode.media_experience.desc': '컨텐츠 길이·재생 방식·capacity 의 변형 비교.',
  'experienceMode.free_admission.label': '자유 관람',
  'experienceMode.free_admission.desc': '방문자 유입에 따른 시간대별 혼잡도와\n밀집도를 분석.',
  'experienceMode.free_with_throttle.label': '자유 관람 + 통제',
  'experienceMode.free_with_throttle.desc': '평소 자유 관람, 공간 수용인원을 초과할 경우\n입장 제한 시뮬레이션.',
  'experienceMode.timed_reservation.label': '시간제 예약 관람',
  'experienceMode.timed_reservation.desc': '시간 단위 예약 운영 시 방문자 분포와 공간 활용\n효율을 분석.',
  'experienceMode.controlled_admission.label': '통제 입장',
  'experienceMode.controlled_admission.desc': '입장 인원을 제한하여 쾌적도를 유지하는\n운영 방식을 시뮬레이션.',
  'experienceMode.group_visit.label': '단체 관람',
  'experienceMode.group_visit.desc': '단체 + 개인 혼합 운영. 그룹 충돌·도슨트 활용.',

  // 페르소나 + 핵심 질문 (모드 선택 카드 — 2026-04-28)
  'experienceMode.layout_validation.persona': '공간 디자이너',
  'experienceMode.layout_validation.question': '이 레이아웃이 좋은가?',
  'experienceMode.curation_validation.persona': '큐레이터',
  'experienceMode.curation_validation.question': '이 큐레이션 순서가 잘 작동하는가?',
  'experienceMode.media_experience.persona': '컨텐츠 매니저',
  'experienceMode.media_experience.question': '이 미디어 구성이 의미 있게 소비되는가?',
  'experienceMode.free_admission.persona': '시설 운영팀',
  'experienceMode.free_admission.question': '자유롭게 열면 시간대별로 얼마나 붐비는가?',
  'experienceMode.free_with_throttle.persona': '시설 운영팀',
  'experienceMode.free_with_throttle.question': '평소엔 자유, 폭주 시 통제 — 어디서 발동되나?',
  'experienceMode.timed_reservation.persona': '시설 운영팀',
  'experienceMode.timed_reservation.question': '시간제 예약이면 슬롯이 잘 채워지는가?',
  'experienceMode.controlled_admission.persona': '시설주 / 투자자',
  'experienceMode.controlled_admission.question': '쾌적도와 처리량을 어떻게 균형 잡는가?',
  'experienceMode.group_visit.persona': '단체 운영 담당',
  'experienceMode.group_visit.question': '단체와 개인이 섞여도 운영 가능한가?',

  // KPI 미리보기 칩 라벨 (모드 선택 카드 — 2026-04-28)
  'experienceMode.kpi.density': '평균 밀도',
  'experienceMode.kpi.congestionMin': '혼잡 시간',
  'experienceMode.kpi.flowEfficiency': '동선 효율',
  'experienceMode.kpi.variantAbc': 'A/B/C 비교',
  'experienceMode.kpi.orderFidelity': '의도 순서 충실도',
  'experienceMode.kpi.seriesCompletion': '시리즈 완주율',
  'experienceMode.kpi.heroReach': '대표작 도달률',
  'experienceMode.kpi.backtrack': '역행 비율',
  'experienceMode.kpi.meaningfulCompletion': '의미있는 완주',
  'experienceMode.kpi.throughput': '처리량',
  'experienceMode.kpi.contentSkip': '컨텐츠 스킵률',
  'experienceMode.kpi.capacityUtil': 'capacity 활용',
  'experienceMode.kpi.concurrentTimeline': '동시 체류 추이',
  'experienceMode.kpi.satisfaction': '만족도',
  'experienceMode.kpi.crowdAccum': '혼잡 누적',
  'experienceMode.kpi.recommendedCap': '권장 cap',
  'experienceMode.kpi.outsideQueue': '외부 큐',
  'experienceMode.kpi.avgWait': '평균 대기',
  'experienceMode.kpi.abandonRate': '포기율',
  'experienceMode.kpi.slotIntake': '슬롯별 입장',
  'experienceMode.kpi.slotUtil': '슬롯 활용',
  'experienceMode.kpi.interSlotWait': '슬롯간 대기',
  'experienceMode.kpi.throughputTradeoff': '처리량 trade-off',
  'experienceMode.kpi.recommendedCapRange': '권장 cap 범위',
  'experienceMode.kpi.groupCohesion': '그룹 응집도',
  'experienceMode.kpi.groupConflict': '그룹 충돌',
  'experienceMode.kpi.docentUtil': '도슨트 활용',
  'experienceMode.kpi.vipImpact': 'VIP 영향도',

  // 모드 선택 카드 공통 라벨 (2026-04-28)
  'modeSelect.previewKpiLabel': '주요 분석 결과',
  'modeSelect.lockedCta': '미리보기',
  'modeSelect.lockedModalTitle': '{phase} 에서 활성화 예정',
  'modeSelect.lockedModalIntro': '이 모드가 켜지면 다음을 보게 됩니다:',
  'modeSelect.lockedModalClose': '닫기',
  'modeSelect.lockedModalShortIntro': '아직 준비 중인 시나리오입니다.',

  // ── Experience 탭의 입장 대기 카드 (Phase 1+, 2026-04-26) ──
  'experience.queue.title': '입장 대기 (외부 큐)',
  'experience.queue.titleHint':
    '입장 정책이 활성화된 경우의 외부 대기열 현황.\n' +
    '"셋팅"(좌측) 에서 정책을 입력하고, 그 결과를 여기서 분석합니다.',
  'experience.queue.unlimited': '입장 정책이 무제한 — 외부 대기열 없음. 좌측 체험 모드에서 정책 있는 모드 선택 시 KPI 표시됨.',
  'experience.queue.idleHint': '시뮬 시작 전 — Start 누르면 도착/입장 카운터 채워집니다.',
  'experience.queue.arrived': '도착',
  'experience.queue.admitted': '입장',
  'experience.queue.abandoned': '포기',
  'experience.queue.queued': '대기 중',
  'experience.queue.avgQueueWait': '평균 대기',
  'experience.queue.avgQueueWaitHint':
    '지금 큐에 서 있는 모든 사람의 대기 시간 평균.\n' +
    '큐 부하의 라이브 지표 — 늘어나면 cap/처리량 부족 신호.',
  'experience.queue.recentAdmitWait': '최근 입장 평균',
  'experience.queue.recentAdmitWaitHint':
    '최근 100명 입장자의 외부 대기 시간 평균 (rolling).\n' +
    '운영 결정의 핵심 KPI: "이 정책이면 평균 X분 기다린다."',
  'experience.queue.oldestWait': '최장 대기',
  'experience.queue.abandonRate': '포기율',
  'experience.queue.abandonRateHint':
    '도착 인원 중 인내심 초과로 떠난 비율.\n' +
    '> 20%: 빨강 (정책 너무 빡빡), 10-20%: 노랑, < 10%: 녹색.',
  'experience.queue.throughputPerHour': '시간당 입장',
  'experience.queue.throughputPerHourHint': '누적 입장 / 경과 시간 → 시간당 환산. 처리량 추정.',
  'vela.hero.modeTime': '🕐 시간 기준',
  'vela.hero.modePerson': '👥 사람 기준',
  'vela.hero.modeTimeHint': '운영시간 동안 방문객 수용을 측정',
  'vela.hero.modePersonHint': '정해진 관람객 수가 완주하는 것을 측정',
  'vela.hero.trimWarn': '⚠️ 미완료 상태로 Duration 도달 — 마지막 {active}명 관람 중 강제 종료. 평균 체류·완주율 값 주의.',
  'vela.hero.trimWarnPerson': '⚠️ Max Duration safety cap 발동 — {active}명 미퇴장. 설계 검증용 지표가 왜곡되었을 수 있음 (stuck agent 가능성 확인).',

  // VELA Report — TL;DR
  'vela.tldr.eyebrow': '핵심 인사이트',
  'vela.tldr.headlineA': '답은 사람을 분산시키는 것이 아니라 —',
  'vela.tldr.headlineB': '경험을 분산시키는 것입니다.',

  // VELA Report — Data-derived Key Verdict
  'vela.verdict.over.a': '{zone}이(가) 정원의 {pct}%까지 차올랐습니다.',
  'vela.verdict.over.b': '설계 정원을 넘어선 구간 — 물리적 안전 한계가 침범되었습니다.',
  'vela.verdict.group.a': '병목 {count}곳 중 {induced}곳이 그룹 동선에서 발생했습니다.',
  'vela.verdict.group.b': '단체와 개인 동선이 같은 게이트를 공유하는 신호입니다.',
  'vela.verdict.skip.a': '관람객 {pct}%가 콘텐츠를 건너뛰었습니다.',
  'vela.verdict.skip.b': '노출은 되었으나 관람으로 이어지지 못한 비중입니다.',
  'vela.verdict.fatigue.a': '상위 10% 관람객의 피로도가 {pct}%에 달했습니다.',
  'vela.verdict.fatigue.b': '동선 후반부의 체험 품질이 급격히 저하됩니다.',
  'vela.verdict.completion.a': '3개 이상 존 방문은 전체의 {pct}%에 그쳤습니다.',
  'vela.verdict.completion.b': '핵심 콘텐츠 도달 전 이탈이 광범위합니다.',
  'vela.verdict.activation.a': '전체 미디어 중 {pct}%만 실제로 사용되었습니다.',
  'vela.verdict.activation.b': '절반 이상의 콘텐츠가 동선의 사각지대에 있습니다.',
  'vela.verdict.balanced.a': '피크 {peak}% · 활성률 {activation}% · Skip {skip}%',
  'vela.verdict.balanced.b': '주요 지표가 모두 임계치 안에 머물렀습니다.',

  // VELA Report — Mode Perspective (Phase 1 UX, 2026-04-26)
  // 본문 11 섹션 위에 덧대는 모드 관점 overlay. 모드 의도 기준 KPI/총평 클로즈업.
  'vela.persp.title': '모드 관점',
  'vela.persp.tier.validation': '분석 관점',
  'vela.persp.tier.operations': '운영 예상 관점',
  'vela.persp.verdict.eyebrow': '이 모드의 평가',
  'vela.persp.priorityRecos': '이 모드 의도와 직결되는 권고',

  // mode hint — 모드 배지 옆 1줄 설명
  'vela.persp.modeHint.layout_validation': '공간 레이아웃이 의도한 동선을 유도하는가?',
  'vela.persp.modeHint.curation_validation': '작품 순서가 의도대로 전달되는가?',
  'vela.persp.modeHint.media_experience': '각 미디어 체험이 완주되는가?',
  'vela.persp.modeHint.free_admission': '통제 없는 상태에서 혼잡이 어디에 형성되는가?',
  'vela.persp.modeHint.free_with_throttle': '통제는 켰지만 실제로 얼마나 발동하는가?',
  'vela.persp.modeHint.timed_reservation': '슬롯 크기가 도착 패턴에 적절한가?',
  'vela.persp.modeHint.controlled_admission': '캡이 대기 시간을 허용 범위에 잘 잡고 있는가?',
  'vela.persp.modeHint.group_visit': '단체 vs 개인 동선의 충돌',

  // pivot KPI 라벨 + 보조 설명
  'vela.persp.kpi.completion': '완주율',
  'vela.persp.kpi.completion.note': '존의 80% 이상 방문',
  'vela.persp.kpi.activation': '미디어 활성률',
  'vela.persp.kpi.activation.note': '한 번 이상 사용된 미디어',
  'vela.persp.kpi.skip': 'Skip 률',
  'vela.persp.kpi.skip.note': '접근했지만 건너뜀',
  'vela.persp.kpi.peak': '피크 점유율',
  'vela.persp.kpi.peak.note': '최고 혼잡 존의 용량 대비',
  'vela.persp.kpi.wait': '평균 외부 대기',
  'vela.persp.kpi.wait.note': '최근 100명 입장 기준',
  'vela.persp.kpi.abandon': '포기율',
  'vela.persp.kpi.abandon.note': '입장 전 큐 이탈',

  // verdict 신호 — {mode} (모드 라벨) + {pct} (해당 지표 %)
  'vela.persp.verdict.balanced.a': '{mode}: 모든 지표가 임계치 안.',
  'vela.persp.verdict.balanced.b': '이 모드 기준 critical 신호 없음.',
  'vela.persp.verdict.peak.a': '피크 점유율 {pct}%.',
  'vela.persp.verdict.peak.b': '이 모드의 핵심 이슈는 혼잡입니다.',
  'vela.persp.verdict.fatigue.a': '상위 10% 피로도 {pct}%.',
  'vela.persp.verdict.fatigue.b': '자유 동선이 후반부에 부하를 집중시킵니다.',
  'vela.persp.verdict.activation.a': '전체 미디어 중 {pct}%만 사용됨.',
  'vela.persp.verdict.activation.b': '레이아웃이 절반 이상의 콘텐츠로 시선을 안 보냅니다.',
  'vela.persp.verdict.completion.a': '완주율 {pct}%에 그침.',
  'vela.persp.verdict.completion.b': '의도된 동선이 실제로 따라지지 않습니다.',
  'vela.persp.verdict.skip.a': '{pct}% 방문객이 콘텐츠를 건너뜀.',
  'vela.persp.verdict.skip.b': '노출은 됐지만 체험으로 이어지지 않습니다.',
  'vela.persp.verdict.abandon.a': '도착 인원의 {pct}%가 큐를 포기.',
  'vela.persp.verdict.abandon.b': '인내심 정책이 너무 빡빡하거나 처리량이 부족합니다.',

  // ── VELA Report — Comparison [F1] (검증 tier 변형 매트릭스) ──
  'vela.compare.title': '변형 비교',
  'vela.compare.variantCount': '변형 {count}개',
  'vela.compare.recommended': '추천',
  'vela.compare.recommendedHint': '— 모드 가중 점수에서 1위.',
  'vela.compare.tied': '변형 간 격차가 미미합니다 — 명확한 우위 없음.',
  'vela.compare.col.metric': '지표',
  'vela.compare.currentBadge': '현재',
  'vela.compare.unrunBadge': '시뮬레이션 결과 없음',
  'vela.compare.higherBetter': '높을수록 좋음',
  'vela.compare.lowerBetter': '낮을수록 좋음',
  'vela.compare.metric.completion': '완주율',
  'vela.compare.metric.peak': '피크 점유',
  'vela.compare.metric.skip': '스킵률',
  'vela.compare.metric.fatigue': '상위 10% 피로도',
  'vela.compare.note.unrun': '변형 {count}개에 시뮬 결과가 없습니다 — 실행해서 비교하세요.',

  // VELA Report — Executive
  'vela.exec.eyebrow': '핵심 요약',
  'vela.exec.titleA': '핵심',
  'vela.exec.titleB': '요약',
  'vela.exec.meta': '방문객 {visitors}명',
  'vela.exec.safeLimit': '0 · 100% 안전 한계 · ',
  'vela.sev.critical': '심각',
  'vela.sev.warning': '경고',
  'vela.sev.info': '정보',

  // VELA Report — Density
  'vela.density.eyebrow': '공간 밀도',
  'vela.density.titleA': '피크 시점 공간',
  'vela.density.titleB': '밀도',
  'vela.density.titleC': '',
  'vela.density.metaWithPeak': '피크 @ {moment} · P90 {p90}%',
  'vela.density.metaNoPeak': 'P90 {p90}%',
  'vela.density.introWithMoment': ' (피크-피로도 시점 {moment} 기준)',
  'vela.density.intro':
    '층별 존 밀도{introMoment}. 셀은 수용량 대비 점유율(%)이며, 붉을수록 혼잡합니다.',
  'vela.density.lg.lt30': '30% 미만',
  'vela.density.lg.range1': '30–60%',
  'vela.density.lg.range2': '60–85%',
  'vela.density.lg.range3': '85–100%',
  'vela.density.lg.over': '수용 초과',

  // VELA Report — Timeline
  'vela.tl.eyebrow': '',
  'vela.tl.titleA': '시간대별 변화',
  'vela.tl.titleEm': '추이',
  'vela.tl.metaPeak': '{start} — {end} · 피크 {peak}',
  'vela.tl.metaRange': '{start} — {end}',
  'vela.tl.intro':
    '시뮬레이션 전체 구간의 최대 혼잡도, 평균 피로도, 동시 활성 방문객 수 변화.',
  'vela.tl.chartTitle': '혼잡 · 피로 · 활성 방문객',
  'vela.tl.l.peak': '최대 혼잡도 %',
  'vela.tl.l.fatigue': '평균 피로도 %',
  'vela.tl.l.active': '활성 방문객',
  'vela.tl.callout.label': '피크 시점 · {moment}',
  'vela.tl.callout.reached': '{zone}이(가) 수용량의 {pct}%에 도달',
  'vela.tl.callout.structural': '. 일시적인 사건이 아닌 구조적 혼잡으로 관찰됨.',
  'vela.tl.callout.dot': '.',
  'vela.tl.callout.supp': '이 시점 활성 관람객 {active}명, 평균 피로도 {fatigue}% — 동시 수용력과 체험 밀도가 함께 정점을 찍은 구간.',
  'vela.tl.exit.title': '누적 퇴장',
  'vela.tl.exit.hint': '시간에 따른 누적 퇴장자 수 (총 {total}명 완료) — 시설이 비워지는 속도를 보여줍니다.',
  'vela.tl.rank.title': '{moment} 시점 존 랭킹',
  'vela.tl.rank.titleNoPeak': '피크 존 랭킹',
  'vela.tl.rank.hint': '피크 순간에 용량 대비 점유율이 높은 존들 — 동시 압박 패턴을 보여줍니다.',

  // VELA Report — System overview
  'vela.sys.eyebrow': '공간 구성',
  'vela.sys.titleA': '공간',
  'vela.sys.titleB': '구성 및 분포',
  'vela.sys.meta': '존 {zones}개 · 미디어 {media}개 · {area} m²',
  'vela.sys.col.visitDist': '존별 체류시간 분포',
  'vela.sys.col.composition': '구성',
  'vela.sys.donut.visits': '방문 횟수',
  'vela.sys.donut.dwellMin': '체류 (분)',
  'vela.sys.donut.noData': '데이터 없음',
  'vela.sys.donut.note': '{count}개 존 · 누적 체류 {total}분',
  'vela.sys.kv.zones': '존',
  'vela.sys.kv.media': '미디어',
  'vela.sys.kv.area': '총 면적',
  'vela.sys.kv.capacity': '총 수용량',
  'vela.sys.kv.mediaCap': '미디어 수용량',
  'vela.sys.kv.avgCrowd': '평균 혼잡도',
  'vela.sys.kv.avgDwell': '평균 체류 시간',
  'vela.sys.kv.throughput': '처리량',
  'vela.sys.kv.throughput.spawnNote': '스폰 {rate}명/분',
  'vela.sys.kv.unitCount': '개',
  'vela.sys.kv.unitPeople': '명',
  'vela.sys.th.zone': '존',
  'vela.sys.th.areaCap': '면적 / 수용량',
  'vela.sys.th.peak': '피크',
  'vela.sys.th.util': '점유율',
  'vela.sys.th.density': 'm²/인',
  'vela.sys.th.stay': '평균 체류',
  'vela.sys.th.trend': '추이',
  'vela.sys.th.bottleneck': '병목',
  'vela.sys.th.grade': '등급',
  'vela.sys.td.capPrefix': '수용',
  'vela.sys.td.stayUnit': '분',
  'vela.sys.interpLabel': '해석',
  'vela.sys.interp.over':
    '시스템이 설계 수용량을 초과했습니다. {zone}이(가) 수용량의 {pct}%에 도달 — 일시적 현상이 아닌 구조적 혼잡.',
  'vela.sys.interp.near':
    '{zone}이(가) 피크 시점 수용량의 {pct}%에 도달 — 포화 임박.',

  // VELA Report — Flow
  'vela.flow.eyebrow': '동선과 병목',
  'vela.flow.titleA': '동선 &',
  'vela.flow.titleB': '병목',
  'vela.flow.meta': '완주 {completed}명 · 병목 {bottlenecks}건',
  'vela.flow.col.kpi': '동선 KPI',
  'vela.flow.col.dist': '완주 분포',
  'vela.flow.kv.completed': '완주 방문객',
  'vela.flow.kv.avgTotal': '평균 총 체류',
  'vela.flow.kv.throughput': '처리량',
  'vela.flow.kv.completion': '완주율 (퇴장자 중 ≥{n}개 존, 70%+)',
  'vela.flow.kv.exit': '조기 이탈률 (퇴장자 중 ≤{n}개 존, 20%-)',
  'vela.flow.kv.overallExit': '퇴장률 (전체 스폰 대비)',
  'vela.flow.kv.group': '그룹 유발 병목',
  'vela.flow.groupTip': '단체 입장 그룹이 같은 시점에 같은 게이트를 공유해 발생한 병목 비중입니다. 높을수록 그룹 진입 시간 분리 또는 전용 동선 분기가 필요합니다.',
  'vela.flow.routes.title': '가장 많이 선택된 동선',
  'vela.flow.routes.hint': '관람객이 실제로 이동한 존 순서(visitedZoneIds) 기준 상위 5개 — 자유동선에서도 특정 경로가 몰리는지 확인하세요.',
  'vela.flow.dwell.title': '체류 시간 분포',
  'vela.flow.dwell.hint': '퇴장 완료 관람객의 총 체류 시간(분) 분포. 중앙값 {median}m · P90 {p90}m · P99 {p99}m — 러싱과 몰입의 비율을 확인하세요.',
  'vela.flow.dwell.axisLabel': '분포 (분)',
  'vela.flow.entry.title': '진입 게이트 분포',
  'vela.flow.entry.hint': 'entry 노드별 실제 스폰 횟수. 가중치 대비 편향이 있으면 시뮬 초반 밀집 원인이 됩니다.',
  'vela.flow.entry.empty': '진입 데이터 없음',
  'vela.flow.exit.title': '퇴장 게이트 분포',
  'vela.flow.exit.hint': 'exit 노드별 실제 퇴장 횟수. 한 곳에 과집중되면 종료 병목 신호입니다.',
  'vela.flow.exit.empty': '퇴장 데이터 없음',
  'vela.flow.active.title': '미퇴장 {n}명 현황',
  'vela.flow.active.hint': '시뮬 종료 시점에 아직 장내에 남아있는 방문자의 상태 · 위치. Entry vs Exit 차이의 실체를 보여줍니다.',
  'vela.flow.active.action.col': '상태별',
  'vela.flow.active.zone.col': '현재 존별',
  'vela.flow.active.action.moving': '이동 중 (MOVING)',
  'vela.flow.active.action.watching': '관람 중 (WATCHING)',
  'vela.flow.active.action.waiting': '대기 중 (WAITING)',
  'vela.flow.active.action.resting': '휴식 중 (RESTING)',
  'vela.flow.active.action.idle': '대기 (IDLE)',
  'vela.flow.active.action.exiting': '퇴장 중 (EXITING)',
  'vela.flow.active.zone.outside': '구역 밖 (Transit)',
  'vela.flow.trans.title': '존 전환 매트릭스',
  'vela.flow.trans.hint': '행(출발 존)에서 각 열(도착 존)로 이동한 관람객 수와 해당 존에서 나간 총량 중 비율(%). 색이 짙을수록 해당 출발점에서 선택이 집중된 동선.',
  'vela.flow.note':
    '유의미한 병목은 감지되지 않음 — 이탈은 대기 정체가 아닌 콘텐츠 이탈에 기인.',
  'vela.flow.dist.zero': '0개 존 (즉시 이탈)',
  'vela.flow.dist.low': '1–{max}개 존 (조기 이탈)',
  'vela.flow.dist.mid': '{lo}–{hi}개 존 (부분)',
  'vela.flow.dist.high': '{min}개 이상 (완주)',

  // VELA Report — Behavior
  'vela.bhv.eyebrow': '관람객 행동',
  'vela.bhv.titleA': '관람객',
  'vela.bhv.titleB': '행동',
  'vela.bhv.meta': '피로도 P90 {p90}% · P99 {p99}%',
  'vela.bhv.col.fatigue': '피로도 분포',
  'vela.bhv.col.composition': '방문객 구성',
  'vela.bhv.note.headline':
    'P90이 80%를 넘으면 후반부 존의 체험 품질이 구조적으로 저하됩니다.',
  'vela.bhv.note.stats':
    '평균 {avg}% · 중간값 {median}% · P99 {p99}%',
  'vela.bhv.group':
    '전체 동선에 영향을 주는 그룹 방문객은 {count}팀으로, 감지된 병목 중 {pct}%가 그룹에서 발생했습니다.',
  'vela.bhv.h.avg': '평균 {pct}%',
  'vela.bhv.h.median': '중간값 {pct}%',
  'vela.bhv.h.p90': 'P90 {pct}%',
  'vela.bhv.h.p99': 'P99',

  // VELA Report — Media
  'vela.media.eyebrow': '미디어 경험',
  'vela.media.titleA': '미디어',
  'vela.media.titleB': '경험',
  'vela.media.meta': '미디어 {count}개 · 활성화율 {activation}%',
  'vela.media.perf': '콘텐츠 성과',
  'vela.media.th.media': '미디어',
  'vela.media.th.zone': '존',
  'vela.media.th.peakCap': '피크/수용',
  'vela.media.th.viewsSkip': '관람/스킵',
  'vela.media.th.engagement': '몰입도',
  'vela.media.pick.topTitle': '최상위 · 최고 몰입도',
  'vela.media.pick.topNote': '몰입도 ≥ 70%',
  'vela.media.pick.lowTitle': '하위 · 개선 필요',
  'vela.media.pick.lowNote': '몰입도 < 60% 또는 높은 스킵률',
  'vela.media.tot.views': '총 관람 수',
  'vela.media.tot.skips': '총 스킵 수',
  'vela.media.tot.time': '총 관람 시간',
  'vela.media.tot.activation': '콘텐츠 활성화율',
  'vela.media.u.views': '관람',
  'vela.media.u.skips': '스킵',
  'vela.media.u.min': '분',

  // VELA Report — Recommendations
  'vela.recos.eyebrow': '개선 권장사항',
  'vela.recos.title': '개선 권장사항',
  'vela.recos.meta': '{count}건 · 우선순위 정렬',
  'vela.recos.evidence': '근거 · {metric} · {value} · 임계값 {threshold}',
  'vela.recos.actionH': '권장 조치',

  // VELA Report — Appendix
  'vela.appendix.eyebrow': '부록',
  'vela.appendix.title': '용어 해설',
  'vela.appendix.meta': '용어 해설',

  // VELA Report — KPIs (Executive)
  'vela.kpi.peak.label': '피크 점유율',
  'vela.kpi.peak.note': '{zone} · 설계 수용량 대비 피크 점유',
  'vela.kpi.visitors.label': '총 방문객',
  'vela.kpi.visitors.note': '체류 {active} · 퇴장 {exited}',
  'vela.kpi.stay.label': '평균 체류',
  'vela.kpi.stay.unit': '분',
  'vela.kpi.stay.note': '완주율 {pct}%',
  'vela.kpi.fatigue.label': '평균 피로도',
  'vela.kpi.fatigue.note': 'P90 {pct}%',
  'vela.kpi.skip.label': '스킵률',
  'vela.kpi.skip.note': '관람 {watches}회 · 스킵 {skips}회',
  'vela.kpi.bottleneck.label': '병목',
  'vela.kpi.bottleneck.note': '그룹 유발 {count}건',
  'vela.kpi.throughput.label': '처리량',
  'vela.kpi.throughput.unit': '명/분',
  'vela.kpi.throughput.note': '퇴장자 ÷ 경과 분',

  // VELA Report — Evidence labels
  'vela.ev.peak.label': '피크 점유율',
  'vela.ev.peak.noteOver': '{zone} — 수용 초과',
  'vela.ev.peak.note': '{zone}',
  'vela.ev.fatigue.label': '피로도 P90',
  'vela.ev.fatigue.note': '하위 10% 방문객 기준',
  'vela.ev.activation.label': '미디어 활성화',
  'vela.ev.activation.note': '미디어 {total}개 중 {active}개 활성',
  'vela.ev.skip.label': '스킵률',
  'vela.ev.skip.note': '관람 {views}회 / 스킵 {skips}회',

  // VELA Report — Glossary terms
  'vela.gl.peak.term': '피크 점유율 (Peak Utilization)',
  'vela.gl.peak.def': '관측 기간 중 한 존의 동시 최대 점유 인원 ÷ 설계 수용량.',
  'vela.gl.density.term': 'm²/인 (공간 등급)',
  'vela.gl.density.def': '존 면적 ÷ 피크 점유 인원. 2.5 m²/인(국제 기준) 이상이면 안전.',
  'vela.gl.bottleneck.term': '병목 지수 (Bottleneck Score)',
  'vela.gl.bottleneck.def': '유입-유출 차이와 대기 시간으로 산출한 0–1 정제 지수. 0.5 초과 시 병목.',
  'vela.gl.completion.term': '완주율',
  'vela.gl.completion.def': '정상 퇴장한 방문객 비율 (퇴장자 ÷ 전체 방문객).',
  'vela.gl.skip.term': '스킵률',
  'vela.gl.skip.def': '미디어에 도달했으나 관람하지 않고 지나친 방문객의 비율.',
  'vela.gl.engagement.term': '몰입도 (Engagement Rate)',
  'vela.gl.engagement.def': '미디어 관람 수 ÷ 총 접근 수 (관람 + 스킵).',
  'vela.gl.fatigue.term': '피로도 P90 / P99',
  'vela.gl.fatigue.def': '방문객 피로도의 상위 10% / 1% 값.',
  'vela.gl.group.term': '그룹 유발 병목',
  'vela.gl.group.def': '그룹 방문객이 혼잡의 50% 이상을 차지한 병목.',

  // Completion modal
  'completionModal.title': '시뮬레이션 완료',
  'completionModal.duration': '{mins}분 시뮬레이션됨',
  'completionModal.close': '닫기',
  'completionModal.dismiss': '나중에',
  'completionModal.nextStep': '다음으로 무엇을 하시겠어요?',
  'completionModal.viewReport': '상세 리포트 보기',
  'completionModal.viewReportHint': 'KPI 분석, 인사이트, 공간 등급 전체 보기',
  'completionModal.viewCompare': 'A/B/C 정책 비교 ({count}개 결과)',
  'completionModal.viewCompareHint': '저장된 슬롯 결과를 한눈에 비교',
  'completionModal.compareDisabled': '정책 비교 (슬롯 더 필요)',
  'completionModal.compareNeedMore': '비교하려면 {remaining}개 결과를 더 저장하세요',
  'completionModal.continueAnalysis': '슬롯 {slot} 로 분석 계속 (cap={cap})',
  'completionModal.continueAnalysisHint': '추천 cap 으로 다음 슬롯 자동 활성화 — Start 만 누르면 됩니다',

  // Completion Report panel
  'completionReport.title': '리포트',
  'completionReport.viewFull': '전체 리포트 보기 (PDF)',
  'completionReport.runHint': '시뮬레이션을 실행하면 리포트가 생성됩니다.',
  'completionReport.analyzing': '분석중입니다.',

  // Pinpoint analysis
  'pinpoint.tab.label': 'Pin',
  'pinpoint.action.pin': '지금 핀',
  'pinpoint.action.remove': '삭제',
  'pinpoint.action.clear': '전체 삭제',
  'pinpoint.action.compare': '비교',
  'pinpoint.action.viewOnCanvas': '캔버스에 표시',
  'pinpoint.shortcut.hint': 'P 키로 핀 생성',
  'pinpoint.toast.created': '{time} 시점에 핀 저장',
  'pinpoint.toast.maxCompare': '비교는 최대 {max}개까지 가능',
  'pinpoint.toast.noSnapshot': '시뮬레이션이 시작되어야 핀을 만들 수 있습니다',
  'regions.tooltip': '각 층(region)을 관리합니다. 활성 층 = 새 zone/waypoint 배치 기본 대상. 눈 아이콘으로 층을 숨겨 편집 집중. 이미지 아이콘으로 층별 플로어플랜 오버레이 관리.',
  'pinpoint.defaultLabel': '{time} 핀',
  'pinpoint.empty.title': '아직 핀이 없습니다',
  'pinpoint.empty.hint': '시뮬 중에 P 키 또는 "지금 핀" 버튼으로 순간을 저장하세요',
  'pinpoint.timeline.title': 'PINS',
  'pinpoint.list.editLabel': '라벨 편집',
  'pinpoint.detail.title': '{label}',
  'pinpoint.detail.meta': '{time} · {zones}존 / {media}미디어',
  'pinpoint.detail.kpi.active': '활성',
  'pinpoint.detail.kpi.throughput': '처리량/분',
  'pinpoint.detail.kpi.fatigue': '평균 피로도',
  'pinpoint.detail.zones': '존 현황',
  'pinpoint.detail.media': '미디어 현황',
  'pinpoint.detail.th.zone': '존',
  'pinpoint.detail.th.occCap': '점유/용량',
  'pinpoint.detail.th.ratio': '비율',
  'pinpoint.detail.th.comfort': '쾌적도',
  'pinpoint.detail.th.watching': '관람',
  'pinpoint.detail.th.waiting': '대기',
  'pinpoint.detail.th.media': '미디어',
  'pinpoint.detail.th.viewers': '관객',
  'pinpoint.detail.th.queue': '대기열',
  'pinpoint.detail.th.skips': '누적 SKIP',
  'pinpoint.detail.delta': '이전 핀 대비',
  'pinpoint.detail.noPrev': '첫 핀',
  'pinpoint.compare.title': '핀 비교',
  'pinpoint.compare.metric.throughput': '처리량/분',
  'pinpoint.compare.metric.avgFatigue': '평균 피로도',
  'pinpoint.compare.metric.peakZone': '피크 존',
  'pinpoint.compare.metric.avgComfort': '평균 쾌적도',

  // ── 정책 A/B/C 비교 (cap 값 수동 비교) ──
  'policyCompare.title': '정책 비교 (A/B/C)',
  'policyCompare.intro': '서로 다른 동시 수용 cap 값으로 시뮬을 돌려 결과를 비교합니다. 각 슬롯은 독립된 풀 시뮬레이션 결과를 저장합니다.',
  'policyCompare.lockedHint': '시뮬 진행 중에는 슬롯을 변경할 수 없습니다.',
  'policyCompare.mode.preset': '선시험 (한꺼번에 정의)',
  'policyCompare.mode.preset.desc': 'A/B/C cap 값을 모두 정해두고 차례대로 실행합니다.',
  'policyCompare.mode.progressive': '점진 (실행하며 정의)',
  'policyCompare.mode.progressive.desc': 'A 를 먼저 돌려 결과를 본 뒤 B/C 추천을 받아 진행합니다.',
  'policyCompare.slot.label': '슬롯 {id}',
  'policyCompare.slot.capLabel': '동시 수용 cap',
  'policyCompare.slot.empty': '비어있음',
  'policyCompare.slot.configured': '대기',
  'policyCompare.slot.captured': '결과 저장됨',
  'policyCompare.slot.activeBadge': '활성',
  'policyCompare.slot.capturedAt': '{time} 캡처',
  'policyCompare.activate': '이 슬롯으로 시뮬 실행',
  'policyCompare.activateHint': '활성 슬롯: {id} — Start 누르면 결과가 자동으로 슬롯 {id} 에 저장됩니다.',
  'policyCompare.activatedToast': '✓ 슬롯 {id} 활성화 (cap={cap}) — Start 누르면 시뮬 시작',
  'policyCompare.deactivate': '활성 해제',
  'policyCompare.runHint': '시뮬을 시작하려면 위쪽의 Start 버튼을 누르세요.',
  'policyCompare.clear': '초기화',
  'policyCompare.clearAll': '전체 초기화',
  'policyCompare.viewCompare': '비교 보기 ({count}개 결과)',
  'policyCompare.compareDisabled': '결과가 2개 이상일 때 비교 가능',
  'policyCompare.modalTitle': '정책 비교 결과',
  'policyCompare.close': '닫기',
  'policyCompare.recommendTitle': '슬롯 {id} 결과 기반 추천',
  'policyCompare.recommendApply': 'B={B}, C={C} 로 채우기',
  'policyCompare.recommendDismiss': '추천 닫기',
  'policyCompare.recommendation.tooManyAbandons': '포기율 {rate}% — cap 부족 신호. 더 큰 cap 을 시도해 보세요.',
  'policyCompare.recommendation.lowPeak': '피크 {peak}% — cap 여유 충분. 더 작게 줄여 capex 검증해 보세요.',
  'policyCompare.recommendation.bracket': '균형점 근처 — 양쪽으로 ±15% 브래킷.',
  'policyCompare.recommendation.lowSatisfaction': '만족도 {sat}% — cap 외 요인일 수 있으나 양쪽 탐색 권장.',
  'policyCompare.col.satisfaction': '만족도',
  'policyCompare.col.complete': '완주%',
  'policyCompare.col.peak': '피크%',
  'policyCompare.col.abandon': '포기%',
  'policyCompare.col.wait': '평균 대기',
  'policyCompare.winnerBadge': '★ 최고',
  'policyCompare.noResults': '아직 캡처된 결과가 없습니다.',

  // ── Phase 0 (2026-04-25): Exhibit 용어 ───────────
  // 상위 개념
  'exhibit.label': '전시물',
  'exhibit.label.plural': '전시물',
  'exhibit.add': '전시물 추가',
  'exhibit.outOfSpace': '공간 부족 — 존이 가득 찼습니다',

  // 카테고리 (큐레이터 관점)
  'exhibit.kind.artwork': '작품',
  'exhibit.kind.artwork.desc': '회화, 조각, 사진 등 정적 전시물',
  'exhibit.kind.digital': '디지털 미디어',
  'exhibit.kind.digital.desc': '영상, 프로젝션, 미디어월',
  'exhibit.kind.interactive': '인터랙티브',
  'exhibit.kind.interactive.desc': '터치테이블, 키오스크, 핸즈온',
  'exhibit.kind.immersive': '이머시브',
  'exhibit.kind.immersive.desc': 'VR/AR, 몰입형 룸, 4D',

  // Artwork 속성
  'exhibit.artwork.section': '작품 속성',
  'exhibit.artwork.curatorialOrder': '시리즈 내 순서',
  'exhibit.artwork.curatorialOrder.hint': '의도된 관람 순서 (1, 2, 3...)',
  'exhibit.artwork.series': '시리즈',
  'exhibit.artwork.series.placeholder': '예: 조선시대 회화',
  'exhibit.artwork.series.none': '시리즈 없음',
  'exhibit.artwork.significance': '비중',
  'exhibit.artwork.significance.hero': '대표작 (Hero)',
  'exhibit.artwork.significance.support': '핵심 지지',
  'exhibit.artwork.significance.context': '보조 맥락',
  'exhibit.artwork.significance.hint': '대표작은 KPI 가중 + 캔버스 강조',

  // Digital Media 속성
  'exhibit.digital.section': '디지털 미디어 속성',
  'exhibit.digital.contentDuration': '컨텐츠 길이',
  'exhibit.digital.contentDuration.hint': '영상/프로젝션 전체 재생 시간',
  'exhibit.digital.minWatch': '의미있는 체험',
  'exhibit.digital.minWatch.hint': '이 시간 이상 머물러야 의미있는 체험으로 인정',
  'exhibit.digital.loopable': '루프 재생',
  'exhibit.digital.loopable.hint': '관람객이 들어오는 어느 시점에든 재생 시작',
  'exhibit.digital.interactivityLevel': '인터랙션 수준',
  'exhibit.digital.interactivityLevel.viewOnly': '시청 전용',
  'exhibit.digital.interactivityLevel.chapterSelect': '챕터 선택 가능',
  'exhibit.digital.interactivityLevel.fullInteractive': '풀 인터랙티브',
  'exhibit.digital.warning.shortMinWatch': '의미있는 체험이 컨텐츠 길이의 20% 이하 — 실 효과 의문',

  // Interactive 속성
  'exhibit.interactive.section': '인터랙티브 속성',
  'exhibit.interactive.sessionMode': '세션 모드',
  'exhibit.interactive.sessionMode.slot': '슬롯 (시간 분할)',
  'exhibit.interactive.sessionMode.queue': '대기열',
  'exhibit.interactive.sessionMode.free': '자유',
  'exhibit.interactive.interactionDepth': '인터랙션 깊이',
  'exhibit.interactive.interactionDepth.hint': '0=단순 터치, 1=풀 인터랙션',
};
